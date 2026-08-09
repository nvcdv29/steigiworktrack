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
} from './lib/supabase';
import { calculateMonthlySummaries, DEFAULT_USER_SETTINGS } from './lib/calculus';

import { Clock, DollarSign, Briefcase, AlertTriangle, Database, RefreshCw, Copy, Info } from 'lucide-react';
import { FormattedNumber } from './components/FormattedNumber';
import { Header } from './components/Header';
import { AdvanceCalculusCard } from './components/AdvanceCalculusCard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { WorkEntriesTable } from './components/WorkEntriesTable';
import { TimerWidget } from './components/TimerWidget';
import { WorkEntryModal } from './components/WorkEntryModal';
import { SettingsModal } from './components/SettingsModal';
import { CalculusGuideModal } from './components/CalculusGuideModal';

const SQL_INITIALIZER_SCRIPT = `-- --- SUPABASE INITIALIZER & MIGRATION SCRIPT ---
-- Paste this entire script into your Supabase SQL Editor and click 'Run'.
-- It will safely create the tables if they don't exist, OR repair missing columns and NOT NULL constraints if they already exist!

-- 1. Create Tables (using standard snake_case to prevent PostgreSQL casing bugs)
CREATE TABLE IF NOT EXISTS "work_entries" (
  "id" TEXT PRIMARY KEY,
  "date" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "pause_minutes" INTEGER NOT NULL,
  "gross_hours" NUMERIC NOT NULL,
  "net_hours" NUMERIC NOT NULL,
  "notes" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" TEXT PRIMARY KEY,
  "hourly_wage" NUMERIC NOT NULL,
  "currency" TEXT NOT NULL DEFAULT '€',
  "minijob_cap" NUMERIC NOT NULL DEFAULT 538.00,
  "fixed_costs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "deferred_months" JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 2. Safe migrations for existing databases to add missing columns & fix constraints
DO $$
BEGIN
    -- user_settings migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='hourly_wage') THEN
        ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "hourly_wage" NUMERIC DEFAULT 12.41;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='hourlyWage') THEN
            UPDATE "user_settings" SET "hourly_wage" = "hourlyWage";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='minijob_cap') THEN
        ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "minijob_cap" NUMERIC DEFAULT 538.00;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='minijobCap') THEN
            UPDATE "user_settings" SET "minijob_cap" = "minijobCap";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='fixed_costs') THEN
        ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "fixed_costs" JSONB DEFAULT '[]'::jsonb;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='fixedCosts') THEN
            UPDATE "user_settings" SET "fixed_costs" = "fixedCosts";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='deferred_months') THEN
        ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "deferred_months" JSONB DEFAULT '[]'::jsonb;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='deferredMonths') THEN
            UPDATE "user_settings" SET "deferred_months" = "deferredMonths";
        END IF;
    END IF;

    -- work_entries migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='start_time') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "start_time" TEXT;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='startTime') THEN
            UPDATE "work_entries" SET "start_time" = "startTime";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='end_time') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "end_time" TEXT;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='endTime') THEN
            UPDATE "work_entries" SET "end_time" = "endTime";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='pause_minutes') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "pause_minutes" INTEGER DEFAULT 0;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='pauseMinutes') THEN
            UPDATE "work_entries" SET "pause_minutes" = "pauseMinutes";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='gross_hours') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "gross_hours" NUMERIC;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='grossHours') THEN
            UPDATE "work_entries" SET "gross_hours" = "grossHours";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='net_hours') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "net_hours" NUMERIC;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='netHours') THEN
            UPDATE "work_entries" SET "net_hours" = "netHours";
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='created_at') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='createdAt') THEN
            UPDATE "work_entries" SET "created_at" = "createdAt";
        ELSE
            UPDATE "work_entries" SET "created_at" = "date" || 'T12:00:00Z';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='updated_at') THEN
        ALTER TABLE "work_entries" ADD COLUMN IF NOT EXISTS "updated_at" TEXT;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='updatedAt') THEN
            UPDATE "work_entries" SET "updated_at" = "updatedAt";
        ELSE
            UPDATE "work_entries" SET "updated_at" = "date" || 'T12:00:00Z';
        END IF;
    END IF;

    -- Drop NOT NULL constraints from legacy camelCase columns to prevent constraint errors
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='createdAt') THEN
        ALTER TABLE "work_entries" ALTER COLUMN "createdAt" DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='updatedAt') THEN
        ALTER TABLE "work_entries" ALTER COLUMN "updatedAt" DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='startTime') THEN
        ALTER TABLE "work_entries" ALTER COLUMN "startTime" DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_entries' AND column_name='endTime') THEN
        ALTER TABLE "work_entries" ALTER COLUMN "endTime" DROP NOT NULL;
    END IF;
END $$;

-- 3. Enable Row Level Security (RLS) safely
ALTER TABLE "work_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;

-- 4. Create Public Access Policies safely (dropping them first to avoid "already exists" errors)
DROP POLICY IF EXISTS "Allow public read/write on work_entries" ON "work_entries";
CREATE POLICY "Allow public read/write on work_entries" ON "work_entries" FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on user_settings" ON "user_settings";
CREATE POLICY "Allow public read/write on user_settings" ON "user_settings" FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Force reload PostgREST schema cache to ensure immediate synchronization!
NOTIFY pgrst, 'reload schema';
`;

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [sqlScript, setSqlScript] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCalculusGuideOpen, setIsCalculusGuideOpen] = useState(false);

  const triggerDbErrorSetup = (errorMessage: string) => {
    setSupabaseError(errorMessage);
    setSqlScript(SQL_INITIALIZER_SCRIPT);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setSupabaseError(null);
        setSqlScript(null);

        if (!isSupabaseConfigured()) {
          setSupabaseError('Supabase is not configured yet. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your project secrets.');
          setIsLoading(false);
          return;
        }

        const [fetchedSettings, fetchedEntries] = await Promise.all([
          loadSettings(),
          loadEntries(),
        ]);

        setSettings(fetchedSettings);
        setEntries(fetchedEntries);
      } catch (err: any) {
        console.error('Failed to load data from Supabase:', err);
        const errorMessage = err?.message || String(err);
        triggerDbErrorSetup(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
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
      triggerDbErrorSetup(errMsg);
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
      triggerDbErrorSetup(errMsg);
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
      triggerDbErrorSetup(errMsg);
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
      triggerDbErrorSetup(errMsg);
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
        
        {/* Supabase Status / Action Alerts */}
        {!isSupabaseConfigured() && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-950 shadow-sm space-y-3">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-950 text-base">Supabase Connection Required</h3>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed max-w-3xl">
              To keep your data synchronized in real-time across all environments (Previews, Shared Apps, and Deployed containers), you must configure your Supabase credentials. LocalStorage has been disabled as requested to enforce cloud-only synchronization.
            </p>
            <div className="text-sm text-amber-800 space-y-1.5 bg-amber-100/40 p-3 rounded-lg border border-amber-200/50">
              <p>Please define these environment variables in your <strong>Google AI Studio Secrets</strong> panel:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono text-xs">
                <li>SUPABASE_URL</li>
                <li>SUPABASE_ANON_KEY</li>
              </ul>
            </div>
          </div>
        )}

        {supabaseError && isSupabaseConfigured() && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-950 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <Database className="h-5 w-5 text-rose-600 shrink-0" />
                <h3 className="font-bold text-rose-950 text-base">Database Setup Required</h3>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center space-x-1 border border-rose-200 bg-rose-100/50 px-2 py-1 rounded-md transition-colors"
              >
                <RefreshCw className="h-3 w-3 animate-spin-hover" />
                <span>Retry Connection</span>
              </button>
            </div>
            <p className="text-sm text-rose-800 leading-relaxed max-w-3xl">
              {supabaseError}
            </p>
            {sqlScript && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-950 uppercase tracking-wider">SQL Initializer Script</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sqlScript);
                    }}
                    className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center space-x-1 bg-white hover:bg-rose-100/30 px-2 py-1 rounded border border-rose-200 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy SQL</span>
                  </button>
                </div>
                <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto max-h-60 leading-normal border border-slate-800 shadow-inner">
                  {sqlScript}
                </pre>
              </div>
            )}
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

