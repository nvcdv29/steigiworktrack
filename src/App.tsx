import React, { useState, useEffect } from 'react';
import { WorkEntry, UserSettings, MonthSummary } from './types';
import {
  isSupabaseConfigured,
  loadSettings,
  saveSettings,
  loadEntries,
  saveEntry,
  deleteEntry,
  importEntries,
  subscribeToChanges,
  formatSupabaseError,
} from './lib/supabase';
import { calculateMonthlySummaries, DEFAULT_USER_SETTINGS, isPlannedEntry } from './lib/calculus';

import { Clock, DollarSign, Briefcase, AlertTriangle, RefreshCw } from 'lucide-react';
import { FormattedNumber } from './components/FormattedNumber';
import { Header } from './components/Header';
import { AdvanceCalculusCard } from './components/AdvanceCalculusCard';
import { TargetBufferPlanner } from './components/TargetBufferPlanner';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { WorkEntriesTable } from './components/WorkEntriesTable';
import { TimerWidget } from './components/TimerWidget';
import { WorkEntryModal } from './components/WorkEntryModal';
import { SettingsModal } from './components/SettingsModal';
import { CalculusGuideModal } from './components/CalculusGuideModal';

const LOCAL_STORAGE_ENTRIES_KEY = 'minijob_tracker_work_entries';
const LOCAL_STORAGE_SETTINGS_KEY = 'minijob_tracker_user_settings';

function getLocalEntries(): WorkEntry[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_ENTRIES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLocalEntries(entries: WorkEntry[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save entries to localStorage:', err);
  }
}

function getLocalSettings(): UserSettings {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_USER_SETTINGS;
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function saveLocalSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(getLocalSettings);
  const [entries, setEntries] = useState<WorkEntry[]>(getLocalEntries);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCalculusGuideOpen, setIsCalculusGuideOpen] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function fetchData() {
      try {
        setIsLoading(true);
        setSupabaseError(null);

        if (!isSupabaseConfigured()) {
          setSupabaseError('Supabase is not configured yet. Operating in local storage mode.');
          setIsLoading(false);
          return;
        }

        const [fetchedSettings, fetchedEntries] = await Promise.all([
          loadSettings(),
          loadEntries(),
        ]);

        setSettings(fetchedSettings);
        saveLocalSettings(fetchedSettings);

        setEntries(fetchedEntries);
        saveLocalEntries(fetchedEntries);

        // Enable real-time cross-device / cross-tab synchronization
        try {
          unsubscribe = subscribeToChanges(
            () => {
              loadEntries().then((updated) => {
                setEntries(updated);
                saveLocalEntries(updated);
              }).catch((err) => console.error('Realtime entries refresh error:', err));
            },
            () => {
              loadSettings().then((updated) => {
                setSettings(updated);
                saveLocalSettings(updated);
              }).catch((err) => console.error('Realtime settings refresh error:', err));
            }
          );
        } catch (rtErr) {
          console.warn('Realtime subscription error (non-fatal):', rtErr);
        }
      } catch (err: any) {
        console.error('Failed to load data from Supabase:', err);
        const errorMessage = formatSupabaseError(err);
        setSupabaseError(`Offline / Local Mode Active: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Recalculate monthly summaries and advance calculus
  const monthlySummaries: MonthSummary[] = calculateMonthlySummaries(entries, settings);

  // Computed metrics for Top Tier (2 Tiles: Already Earned vs Predicted Total)
  const pastWorkedEntries = entries.filter((e) => !isPlannedEntry(e));
  const futurePlannedEntries = entries.filter((e) => isPlannedEntry(e));

  const alreadyEarnedIncome = pastWorkedEntries.reduce(
    (sum, e) => sum + e.netHours * settings.hourlyWage,
    0
  );
  const alreadyWorkedHours = pastWorkedEntries.reduce((sum, e) => sum + e.netHours, 0);

  const futurePlannedEarnings = futurePlannedEntries.reduce(
    (sum, e) => sum + e.netHours * settings.hourlyWage,
    0
  );
  const totalPredictedEarnings = alreadyEarnedIncome + futurePlannedEarnings;
  const totalHoursAll = entries.reduce((sum, e) => sum + e.netHours, 0);

  // Handlers
  const handleSaveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveLocalSettings(newSettings);
    try {
      if (isSupabaseConfigured()) {
        await saveSettings(newSettings);
        setActionError(null);
      }
    } catch (err: any) {
      const errMsg = formatSupabaseError(err);
      setActionError(`Settings saved locally in your browser. Could not sync with Supabase: ${errMsg}`);
    }
  };

  const handleSaveEntry = async (entryToSave: WorkEntry) => {
    const exists = entries.some((e) => e.id === entryToSave.id);
    let updated: WorkEntry[];
    if (exists) {
      updated = entries.map((e) => (e.id === entryToSave.id ? entryToSave : e));
    } else {
      updated = [entryToSave, ...entries];
    }
    
    setEntries(updated);
    saveLocalEntries(updated);
    setIsAddModalOpen(false);
    setEditingEntry(null);

    try {
      if (isSupabaseConfigured()) {
        await saveEntry(entryToSave);
        setActionError(null);
      }
    } catch (err: any) {
      const errMsg = formatSupabaseError(err);
      setActionError(`Entry saved locally in your browser. Could not sync with Supabase: ${errMsg}`);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveLocalEntries(updated);

    try {
      if (isSupabaseConfigured()) {
        await deleteEntry(id);
        setActionError(null);
      }
    } catch (err: any) {
      const errMsg = formatSupabaseError(err);
      setActionError(`Entry removed locally in your browser. Could not sync with Supabase: ${errMsg}`);
    }
  };

  const handleImportEntries = async (importedList: WorkEntry[]) => {
    setEntries(importedList);
    saveLocalEntries(importedList);

    try {
      if (isSupabaseConfigured()) {
        await importEntries(importedList);
        setActionError(null);
      }
    } catch (err: any) {
      const errMsg = formatSupabaseError(err);
      setActionError(`Entries imported locally in your browser. Could not sync with Supabase: ${errMsg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="flex justify-center">
            <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Synchronizing with Supabase...</h2>
            <p className="mt-1.5 text-sm text-slate-500">Retrieving your latest work logs and settings directly from the cloud backend.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white pb-6">
      {/* Header Bar */}
      <Header
        settings={settings}
        activeTimer={isTimerOpen}
        onOpenTimer={() => setIsTimerOpen(true)}
        onOpenAddModal={() => {
          setEditingEntry(null);
          setIsAddModalOpen(true);
        }}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenCalculusGuide={() => setIsCalculusGuideOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 sm:space-y-5">
        
        {/* Supabase Connection Warning (Only if missing environment credentials) */}
        {!isSupabaseConfigured() && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-950 shadow-sm space-y-3">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-950 text-base">Supabase Environment Variables Required</h3>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed max-w-3xl">
              To keep your data synchronized in real-time, please define <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-semibold">VITE_SUPABASE_URL</code> and <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-semibold">VITE_SUPABASE_ANON_KEY</code> in your Netlify or project environment settings.
            </p>
          </div>
        )}

        {supabaseError && isSupabaseConfigured() && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-950 shadow-sm flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{supabaseError}</span>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center space-x-1 border border-rose-200 bg-rose-100/50 px-2.5 py-1 rounded-lg transition-colors shrink-0 ml-4"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {actionError && (
          <div className="bg-rose-500 text-white rounded-xl px-4 py-3 shadow-md flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-white shrink-0" />
              <span>{actionError}</span>
            </div>
            <button 
              onClick={() => setActionError(null)}
              className="text-white hover:text-rose-100 font-bold ml-4 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Tier: KPI Overview (2 Tiles: Already Earned vs Predicted Total) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Tile 1: Already Earned Income */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-900 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <div className="flex items-center space-x-1.5">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span>Already Earned Income</span>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold px-2 py-0.5 rounded-full">
                Past Worked Shifts
              </span>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-700 tracking-tight">
                <FormattedNumber value={alreadyEarnedIncome} suffix={` ${settings.currency}`} />
              </p>
              <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-slate-400 inline shrink-0" />
                <span>
                  <FormattedNumber value={alreadyWorkedHours} decimals={1} /> hrs worked ({pastWorkedEntries.length} shifts)
                </span>
              </p>
            </div>
          </div>

          {/* Tile 2: Predicted Earnings */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-900 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <div className="flex items-center space-x-1.5">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                <span>Predicted Earnings</span>
              </div>
              <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 font-extrabold px-2 py-0.5 rounded-full">
                Includes Future Shifts
              </span>
            </div>
            <div>
              <p className="text-3xl font-black text-indigo-700 tracking-tight">
                <FormattedNumber value={totalPredictedEarnings} suffix={` ${settings.currency}`} />
              </p>
              <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-indigo-400 inline shrink-0" />
                <span>
                  <FormattedNumber value={totalHoursAll} decimals={1} /> total hrs
                  {futurePlannedEarnings > 0 && (
                    <span className="text-purple-700 font-bold ml-1">
                      (+{futurePlannedEarnings.toFixed(2)} {settings.currency} planned)
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Minijob Advance Calculus Highlight */}
        <AdvanceCalculusCard
          settings={settings}
          monthlySummaries={monthlySummaries}
          onOpenGuide={() => setIsCalculusGuideOpen(true)}
        />

        {/* Section 1B: Runway & Target Builder (Target & Buffer Planner) */}
        <TargetBufferPlanner
          entries={entries}
          settings={settings}
          monthlySummaries={monthlySummaries}
          onAddPlannedShift={() => {
            setEditingEntry(null);
            setIsAddModalOpen(true);
          }}
          onDeleteEntry={handleDeleteEntry}
        />

        {/* Section 2: Analytics & Visual Trends */}
        <AnalyticsDashboard
          settings={settings}
          monthlySummaries={monthlySummaries}
        />

        {/* Section 3: Work Log Entries Table */}
        <WorkEntriesTable
          entries={entries}
          settings={settings}
          onEdit={(entry) => {
            setEditingEntry(entry);
            setIsAddModalOpen(true);
          }}
          onDelete={handleDeleteEntry}
          onAddNew={() => {
            setEditingEntry(null);
            setIsAddModalOpen(true);
          }}
          onAddNewForDate={(dateStr) => {
            setEditingEntry({
              id: '',
              date: dateStr,
              startTime: '08:00',
              endTime: '17:00',
              pauseMinutes: 30,
              grossHours: 8.5,
              netHours: 8.0,
              notes: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            setIsAddModalOpen(true);
          }}
        />
      </main>

      {/* Modals & Overlays */}
      {isTimerOpen && (
        <TimerWidget
          settings={settings}
          onSaveEntry={handleSaveEntry}
          onClose={() => setIsTimerOpen(false)}
        />
      )}

      {isAddModalOpen && (
        <WorkEntryModal
          initialEntry={editingEntry}
          settings={settings}
          onSave={handleSaveEntry}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEntry(null);
          }}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onClose={() => setIsSettingsModalOpen(false)}
          onImportEntries={handleImportEntries}
          allEntries={entries}
        />
      )}

      {isCalculusGuideOpen && (
        <CalculusGuideModal
          settings={settings}
          onClose={() => setIsCalculusGuideOpen(false)}
        />
      )}
    </div>
  );
}

