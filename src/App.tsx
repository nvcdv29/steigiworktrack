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
} from './lib/supabase';
import { calculateMonthlySummaries, DEFAULT_USER_SETTINGS } from './lib/calculus';

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

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
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
          setSupabaseError('Supabase is not configured yet. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are defined.');
          setIsLoading(false);
          return;
        }

        const [fetchedSettings, fetchedEntries] = await Promise.all([
          loadSettings(),
          loadEntries(),
        ]);

        setSettings(fetchedSettings);
        setEntries(fetchedEntries);

        // Enable real-time cross-device / cross-tab synchronization
        try {
          unsubscribe = subscribeToChanges(
            () => {
              loadEntries().then(setEntries).catch((err) => console.error('Realtime entries refresh error:', err));
            },
            () => {
              loadSettings().then(setSettings).catch((err) => console.error('Realtime settings refresh error:', err));
            }
          );
        } catch (rtErr) {
          console.warn('Realtime subscription error (non-fatal):', rtErr);
        }
      } catch (err: any) {
        console.error('Failed to load data from Supabase:', err);
        const errorMessage = err?.message || String(err);
        setSupabaseError(`Failed to sync with Supabase: ${errorMessage}`);
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

  // Computed metrics for Top Tier
  const totalNetHours = monthlySummaries.reduce((sum, m) => sum + m.totalNetHours, 0);
  const totalGrossEarnings = monthlySummaries.reduce((sum, m) => sum + m.grossEarnings, 0);
  const totalFixedCosts = monthlySummaries.reduce((sum, m) => sum + m.fixedCostDeducted, 0);
  const totalNetEarnings = monthlySummaries.reduce((sum, m) => sum + m.netEarnings, 0);

  // Handlers
  const handleSaveSettings = async (newSettings: UserSettings) => {
    const previousSettings = settings;
    setSettings(newSettings);
    try {
      if (isSupabaseConfigured()) {
        await saveSettings(newSettings);
      }
    } catch (err: any) {
      setSettings(previousSettings);
      const errMsg = err?.message || String(err);
      setActionError(`Failed to save settings to Supabase: ${errMsg}`);
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
    
    const previousEntries = entries;
    setEntries(updated);
    setIsAddModalOpen(false);
    setEditingEntry(null);

    try {
      if (isSupabaseConfigured()) {
        await saveEntry(entryToSave);
      }
    } catch (err: any) {
      setEntries(previousEntries);
      const errMsg = err?.message || String(err);
      setActionError(`Failed to save work entry to Supabase: ${errMsg}`);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const previousEntries = entries;
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);

    try {
      if (isSupabaseConfigured()) {
        await deleteEntry(id);
      }
    } catch (err: any) {
      setEntries(previousEntries);
      const errMsg = err?.message || String(err);
      setActionError(`Failed to delete work entry from Supabase: ${errMsg}`);
    }
  };

  const handleImportEntries = async (importedList: WorkEntry[]) => {
    const previousEntries = entries;
    setEntries(importedList);

    try {
      if (isSupabaseConfigured()) {
        await importEntries(importedList);
      }
    } catch (err: any) {
      setEntries(previousEntries);
      const errMsg = err?.message || String(err);
      setActionError(`Failed to import entries into Supabase: ${errMsg}`);
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

        {/* Top Tier: KPI Overview (3 Tiles) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tile 1: Total Worked Hours */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-900 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-sm text-slate-500 font-medium mb-2">
              <span>Total Worked Hours</span>
              <Clock className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              <FormattedNumber value={totalNetHours} suffix="hrs" decimals={1} />
            </p>
          </div>

          {/* Tile 2: Total Gross Income */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-900 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-sm text-slate-500 font-medium mb-2">
              <span>Total Gross Income</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              <FormattedNumber value={totalGrossEarnings} suffix={` ${settings.currency}`} />
            </p>
          </div>

          {/* Tile 3: Net Earnings */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-900 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-sm text-slate-500 font-medium mb-2">
              <span>Detected Net Earnings</span>
              <Briefcase className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex flex-col">
              <p className="text-3xl font-extrabold text-indigo-700 tracking-tight">
                <FormattedNumber value={totalNetEarnings} suffix={` ${settings.currency}`} />
              </p>
              {totalFixedCosts > 0 && (
                <div className="mt-1 text-xs font-medium text-rose-500 flex items-center space-x-1">
                  <FormattedNumber value={-totalFixedCosts} suffix={` ${settings.currency}`} />
                  <span>fixed costs</span>
                </div>
              )}
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

