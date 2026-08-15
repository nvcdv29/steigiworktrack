import { createClient } from '@supabase/supabase-js';
import { UserSettings, WorkEntry } from '../types';
import { DEFAULT_USER_SETTINGS, SAMPLE_WORK_ENTRIES } from './calculus';

function getEnvVar(keys: string[]): string {
  // 1. Try import.meta.env (Vite standard)
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv) {
      for (const key of keys) {
        if (metaEnv[key]) return metaEnv[key];
      }
    }
  } catch {
    // Ignore
  }

  // 2. Try process.env safely
  try {
    if (typeof process !== 'undefined' && process.env) {
      for (const key of keys) {
        if (process.env[key]) return process.env[key];
      }
    }
  } catch {
    // Ignore
  }

  return '';
}

const supabaseUrl = getEnvVar(['VITE_SUPABASE_URL', 'SUPABASE_URL', 'REACT_APP_SUPABASE_URL']);
const supabaseAnonKey = getEnvVar(['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_KEY', 'SUPABASE_KEY', 'REACT_APP_SUPABASE_ANON_KEY']);

export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl.startsWith('http');
}

export const supabase = (function () {
  if (!isSupabaseConfigured()) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return null;
  }
})();

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const name = (err.name || '').toLowerCase();
  const details = typeof err.details === 'string' ? err.details.toLowerCase() : '';
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('cors') ||
    name.includes('fetch') ||
    name === 'typeerror' ||
    details.includes('fetch')
  );
}

export function formatSupabaseError(error: any): string {
  if (!error) return 'Unknown error';
  if (isNetworkError(error)) {
    return `Connection failed (${error.message || 'TypeError: Failed to fetch'}). Please check your internet connection, verify your Supabase service status, or check CORS settings in your Supabase project dashboard.`;
  }
  const code = error.code ? `[Code: ${error.code}] ` : '';
  const msg = error.message ? error.message : String(error);
  const detailsStr =
    error.details && typeof error.details === 'string' && !error.details.includes('at ')
      ? `. Details: ${error.details}`
      : '';
  const hintStr = error.hint ? `. Hint: ${error.hint}` : '';

  return `${code}${msg}${detailsStr}${hintStr}`;
}

/**
 * Loads user settings from Supabase.
 * If not configured, or if there is no row in the DB, it returns defaults.
 */
export async function loadSettings(): Promise<UserSettings> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row doesn't exist yet, insert DEFAULT_USER_SETTINGS
      await saveSettings(DEFAULT_USER_SETTINGS);
      return DEFAULT_USER_SETTINGS;
    }
    // If it's a "relation does not exist" error (code '42P01')
    if (error.code === '42P01') {
      throw new Error('The "user_settings" table does not exist in your Supabase database.');
    }
    console.error('Error loading settings from Supabase:', error);
    throw new Error(`Error loading settings from Supabase: ${formatSupabaseError(error)}`);
  }

  // Support both snake_case (new) and camelCase (old) for graceful migration
  const hourlyWage = data.hourly_wage !== undefined ? Number(data.hourly_wage) : Number(data.hourlyWage || DEFAULT_USER_SETTINGS.hourlyWage);
  const currency = data.currency || DEFAULT_USER_SETTINGS.currency;
  const minijobCap = data.minijob_cap !== undefined ? Number(data.minijob_cap) : Number(data.minijobCap || DEFAULT_USER_SETTINGS.minijobCap);
  
  let fixedCosts = [];
  if (data.fixed_costs !== undefined) {
    fixedCosts = Array.isArray(data.fixed_costs) ? data.fixed_costs : [];
  } else if (data.fixedCosts !== undefined) {
    fixedCosts = Array.isArray(data.fixedCosts) ? data.fixedCosts : [];
  }

  let deferredMonths = [];
  if (data.deferred_months !== undefined) {
    deferredMonths = Array.isArray(data.deferred_months) ? data.deferred_months : [];
  } else if (data.deferredMonths !== undefined) {
    deferredMonths = Array.isArray(data.deferredMonths) ? data.deferredMonths : [];
  }

  return {
    hourlyWage,
    currency,
    minijobCap,
    fixedCosts,
    deferredMonths,
  };
}

/**
 * Saves user settings to Supabase.
 */
export async function saveSettings(settings: UserSettings): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }

  const candidates = [
    // Candidate 1: Standard snake_case
    {
      id: 'global',
      hourly_wage: settings.hourlyWage,
      currency: settings.currency,
      minijob_cap: settings.minijobCap,
      fixed_costs: settings.fixedCosts,
      deferred_months: settings.deferredMonths || [],
    },
    // Candidate 2: Both snake_case and camelCase
    {
      id: 'global',
      hourly_wage: settings.hourlyWage,
      hourlyWage: settings.hourlyWage,
      currency: settings.currency,
      minijob_cap: settings.minijobCap,
      minijobCap: settings.minijobCap,
      fixed_costs: settings.fixedCosts,
      fixedCosts: settings.fixedCosts,
      deferred_months: settings.deferredMonths || [],
      deferredMonths: settings.deferredMonths || [],
    },
    // Candidate 3: Pure camelCase
    {
      id: 'global',
      hourlyWage: settings.hourlyWage,
      currency: settings.currency,
      minijobCap: settings.minijobCap,
      fixedCosts: settings.fixedCosts,
      deferredMonths: settings.deferredMonths || [],
    },
  ];

  let lastError: any = null;

  for (const payload of candidates) {
    try {
      const { error } = await supabase.from('user_settings').upsert(payload as any);
      if (!error) return;
      lastError = error;
      if (error.code === '42P01') {
        throw new Error('The "user_settings" table does not exist in your Supabase database.');
      }
      if (isNetworkError(error)) break;
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) break;
    }
  }

  console.error('Error saving settings to Supabase:', lastError);
  throw new Error(`Error saving settings to Supabase: ${formatSupabaseError(lastError)}`);
}

/**
 * Loads work entries from Supabase.
 * If no entries exist, seeds with SAMPLE_WORK_ENTRIES.
 */
export async function loadEntries(): Promise<WorkEntry[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }

  const { data, error } = await supabase
    .from('work_entries')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      throw new Error('The "work_entries" table does not exist in your Supabase database.');
    }
    console.error('Error loading entries from Supabase:', error);
    throw new Error(`Error loading entries from Supabase: ${formatSupabaseError(error)}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Map to WorkEntry frontend model supporting snake_case, camelCase, and lowercase
  return data.map((item: any) => ({
    id: item.id,
    date: item.date,
    startTime: item.start_time !== undefined ? item.start_time : (item.startTime !== undefined ? item.startTime : item.starttime),
    endTime: item.end_time !== undefined ? item.end_time : (item.endTime !== undefined ? item.endTime : item.endtime),
    pauseMinutes: item.pause_minutes !== undefined ? Number(item.pause_minutes) : Number(item.pauseMinutes || item.pauseminutes || 0),
    grossHours: item.gross_hours !== undefined ? Number(item.gross_hours) : Number(item.grossHours || item.grosshours || 0),
    netHours: item.net_hours !== undefined ? Number(item.net_hours) : Number(item.netHours || item.nethours || 0),
    notes: item.notes,
    isPlanned: item.is_planned !== undefined ? Boolean(item.is_planned) : (item.isPlanned !== undefined ? Boolean(item.isPlanned) : (item.isplanned !== undefined ? Boolean(item.isplanned) : (item.notes && item.notes.startsWith('[PLANNED]')))),
    createdAt: item.created_at !== undefined ? item.created_at : (item.createdAt !== undefined ? item.createdAt : item.createdat),
    updatedAt: item.updated_at !== undefined ? item.updated_at : (item.updatedAt !== undefined ? item.updatedAt : item.updatedat),
  })) as WorkEntry[];
}

/**
 * Saves or updates a work entry in Supabase.
 */
export async function saveEntry(entry: WorkEntry): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }

  const isPlannedVal = entry.isPlanned || false;

  const candidates = [
    // Candidate 1: Standard snake_case with is_planned
    {
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      is_planned: isPlannedVal,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    },
    // Candidate 2: Standard snake_case without is_planned
    {
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    },
    // Candidate 3: Mixed (snake_case work fields + camelCase timestamps)
    {
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      isPlanned: isPlannedVal,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    // Candidate 3: Both snake_case and camelCase timestamps
    {
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      created_at: entry.createdAt,
      createdAt: entry.createdAt,
      updated_at: entry.updatedAt,
      updatedAt: entry.updatedAt,
    },
    // Candidate 4: Pure camelCase
    {
      id: entry.id,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      pauseMinutes: entry.pauseMinutes,
      grossHours: entry.grossHours,
      netHours: entry.netHours,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    // Candidate 5: Minimal snake_case (no timestamps)
    {
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
    },
    // Candidate 6: Minimal camelCase (no timestamps)
    {
      id: entry.id,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      pauseMinutes: entry.pauseMinutes,
      grossHours: entry.grossHours,
      netHours: entry.netHours,
      notes: entry.notes,
    },
  ];

  let lastError: any = null;

  for (const payload of candidates) {
    try {
      const { error } = await supabase.from('work_entries').upsert(payload as any);
      if (!error) return;
      lastError = error;
      if (error.code === '42P01') {
        throw new Error('The "work_entries" table does not exist in your Supabase database.');
      }
      if (isNetworkError(error)) break;
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) break;
    }
  }

  console.error('Error saving entry to Supabase:', lastError);
  throw new Error(`Error saving entry to Supabase: ${formatSupabaseError(lastError)}`);
}

/**
 * Deletes a work entry from Supabase.
 */
export async function deleteEntry(id: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }

  const { error } = await supabase
    .from('work_entries')
    .delete()
    .eq('id', id);

  if (error) {
    if (error.code === '42P01') {
      throw new Error('The "work_entries" table does not exist in your Supabase database.');
    }
    console.error('Error deleting entry from Supabase:', error);
    throw new Error(`Error deleting entry from Supabase: ${formatSupabaseError(error)}`);
  }
}

/**
 * Subscribes to real-time changes on work_entries and user_settings in Supabase.
 */
export function subscribeToChanges(
  onEntriesChange: () => void,
  onSettingsChange: () => void
): () => void {
  if (!supabase) return () => {};

  // Use a unique channel ID per subscription instance to avoid "cannot add postgres_changes callbacks after subscribe()" error
  const channelId = `app-realtime-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_entries' },
        () => {
          onEntriesChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings' },
        () => {
          onSettingsChange();
        }
      );

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('Supabase Realtime Channel Error:', err);
      }
    });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // Ignore cleanup error
      }
    };
  } catch (err) {
    console.warn('Failed to initialize Supabase realtime subscription:', err);
    return () => {};
  }
}

/**
 * Bulk imports work entries into Supabase.
 */
export async function importEntries(entries: WorkEntry[]): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.');
  }

  if (entries.length === 0) return;

  const candidatePayloadGenerators = [
    // Generator 1: Pure snake_case
    (items: WorkEntry[]) => items.map((entry) => ({
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    })),
    // Generator 2: Mixed (snake_case work fields + camelCase timestamps)
    (items: WorkEntry[]) => items.map((entry) => ({
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    // Generator 3: Both snake_case and camelCase timestamps
    (items: WorkEntry[]) => items.map((entry) => ({
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
      created_at: entry.createdAt,
      createdAt: entry.createdAt,
      updated_at: entry.updatedAt,
      updatedAt: entry.updatedAt,
    })),
    // Generator 4: Pure camelCase
    (items: WorkEntry[]) => items.map((entry) => ({
      id: entry.id,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      pauseMinutes: entry.pauseMinutes,
      grossHours: entry.grossHours,
      netHours: entry.netHours,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    // Generator 5: Minimal snake_case (no timestamps)
    (items: WorkEntry[]) => items.map((entry) => ({
      id: entry.id,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      pause_minutes: entry.pauseMinutes,
      gross_hours: entry.grossHours,
      net_hours: entry.netHours,
      notes: entry.notes,
    })),
    // Generator 6: Minimal camelCase (no timestamps)
    (items: WorkEntry[]) => items.map((entry) => ({
      id: entry.id,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      pauseMinutes: entry.pauseMinutes,
      grossHours: entry.grossHours,
      netHours: entry.netHours,
      notes: entry.notes,
    })),
  ];

  let lastError: any = null;

  for (const gen of candidatePayloadGenerators) {
    try {
      const payload = gen(entries);
      const { error } = await supabase.from('work_entries').upsert(payload as any);
      if (!error) return;
      lastError = error;
      if (error.code === '42P01') {
        throw new Error('The "work_entries" table does not exist in your Supabase database. Please run the SQL setup script to create it.');
      }
      if (isNetworkError(error)) break;
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) break;
    }
  }

  console.error('Error importing entries to Supabase:', lastError);
  throw new Error(`Error importing entries to Supabase: ${formatSupabaseError(lastError)}`);
}
