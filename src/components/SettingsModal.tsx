import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Download,
  Upload,
  Check,
  Calendar,
} from 'lucide-react';
import { UserSettings, WorkEntry } from '../types';

interface SettingsModalProps {
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  onClose: () => void;
  onImportEntries: (entries: WorkEntry[]) => void;
  allEntries: WorkEntry[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSaveSettings,
  onClose,
  onImportEntries,
  allEntries,
}) => {
  const [hourlyWage, setHourlyWage] = useState<number>(settings.hourlyWage);
  const currency = '€'; // Fixed to Euro (€)
  const [minijobCap, setMinijobCap] = useState<number>(settings.minijobCap);

  const [deferredMonthInput, setDeferredMonthInput] = useState<string>('');
  const [deferredMonths, setDeferredMonths] = useState<string[]>(
    settings.deferredMonths || []
  );

  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleAddDeferredMonth = () => {
    if (deferredMonthInput && !deferredMonths.includes(deferredMonthInput)) {
      setDeferredMonths((prev) => [...prev, deferredMonthInput].sort());
      setDeferredMonthInput('');
    }
  };

  const handleRemoveDeferredMonth = (month: string) => {
    setDeferredMonths((prev) => prev.filter((m) => m !== month));
  };

  const handleSaveAllSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: UserSettings = {
      ...settings,
      hourlyWage: Number(hourlyWage) || 0,
      currency,
      minijobCap: Number(minijobCap) || 0,
      fixedCosts: [],
      deferredMonths,
    };

    onSaveSettings(updated);
    onClose();
  };

  // Export JSON backup
  const handleExportJSON = () => {
    const backupData = {
      settings: {
        ...settings,
        hourlyWage,
        currency,
        minijobCap,
      },
      entries: allEntries,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `work_hours_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback('Data backup exported successfully!');
    setTimeout(() => setFeedback(''), 3000);
  };

  // Import JSON backup
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.entries && Array.isArray(json.entries)) {
          onImportEntries(json.entries);
        }
        if (json.settings) {
          const s = json.settings;
          if (s.hourlyWage) setHourlyWage(s.hourlyWage);
          if (s.minijobCap) setMinijobCap(s.minijobCap);
        }
        setFeedback('Backup imported successfully!');
        setTimeout(() => setFeedback(''), 3000);
      } catch (err) {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-4 sm:p-5 text-slate-900 shadow-xl space-y-4 my-auto animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Application Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {feedback && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
            {feedback}
          </div>
        )}

        <form onSubmit={handleSaveAllSettings} className="space-y-4">
          {/* Core Wage & Cap Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hourly Wage
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  required
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Minijob Cap / Mo
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={minijobCap}
                  onChange={(e) => setMinijobCap(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Deferred Payout Months */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center space-x-1.5">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900">
                Deferred Payout Months
              </h3>
            </div>
            <p className="text-[10px] text-slate-500">
              Months where you worked but did not receive a payout (100% of income rolls over to the buffer).
            </p>
            
            <div className="flex items-center space-x-2">
              <input
                type="month"
                value={deferredMonthInput}
                onChange={(e) => setDeferredMonthInput(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddDeferredMonth}
                disabled={!deferredMonthInput}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-100 transition"
              >
                Add Month
              </button>
            </div>

            {deferredMonths.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {deferredMonths.map((month) => {
                  const [y, m] = month.split('-');
                  const formattedMonth = m && y ? `${m}/${y.slice(-2)}` : month;
                  return (
                    <div key={month} className="flex items-center space-x-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700">
                      <span className="font-semibold">{formattedMonth}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDeferredMonth(month)}
                        className="text-slate-400 hover:text-rose-500 focus:outline-none"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Backup Data Import / Export */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <h3 className="text-xs font-bold text-slate-900">Data Backup & Export</h3>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-indigo-600" />
                <span>Export Backup</span>
              </button>

              <label className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition">
                <Upload className="h-3.5 w-3.5 text-indigo-600" />
                <span>Import Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Save & Close */}
          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
