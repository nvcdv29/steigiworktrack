import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, FileText, Check } from 'lucide-react';
import { WorkEntry, UserSettings } from '../types';
import { calculateHours, calculateEntryEarnings } from '../lib/calculus';

interface WorkEntryModalProps {
  initialEntry?: WorkEntry | null;
  settings: UserSettings;
  onSave: (entry: WorkEntry) => void;
  onClose: () => void;
}

export const WorkEntryModal: React.FC<WorkEntryModalProps> = ({
  initialEntry,
  settings,
  onSave,
  onClose,
}) => {
  const [date, setDate] = useState<string>(
    initialEntry?.date || new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState<string>(initialEntry?.startTime || '09:00');
  const [endTime, setEndTime] = useState<string>(initialEntry?.endTime || '17:00');
  const [pauseMinutes, setPauseMinutes] = useState<number>(initialEntry?.pauseMinutes ?? 30);
  const [notes, setNotes] = useState<string>(initialEntry?.notes || '');

  // Live calculated state
  const { grossHours, netHours } = calculateHours(startTime, endTime, pauseMinutes);
  const tempEntry: WorkEntry = {
    id: initialEntry?.id || 'temp',
    date,
    startTime,
    endTime,
    pauseMinutes,
    grossHours,
    netHours,
    notes,
    createdAt: initialEntry?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const { grossEarnings } = calculateEntryEarnings(tempEntry, settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const entryToSave: WorkEntry = {
      id: initialEntry?.id || `entry-${Date.now()}`,
      date,
      startTime,
      endTime,
      pauseMinutes: Number(pauseMinutes) || 0,
      grossHours,
      netHours,
      notes: notes.trim(),
      createdAt: initialEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(entryToSave);
  };

  const handlePausePreset = (mins: number) => {
    setPauseMinutes(mins);
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 text-slate-900 shadow-xl space-y-4 my-auto animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              {initialEntry ? 'Edit Work Entry' : 'Log New Work Hours'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <span>Work Date</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          {/* Start and End Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Pause Minutes & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Pause / Break Time (minutes)
              </label>
              <div className="flex space-x-1 text-xs">
                {[0, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handlePausePreset(mins)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition border ${
                      pauseMinutes === mins
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min="0"
              max="720"
              value={pauseMinutes}
              onChange={(e) => setPauseMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          {/* Live Hours & Earnings Summary Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <div>
              <p className="text-slate-500 font-medium">Total Duration:</p>
              <p className="text-xs font-extrabold text-slate-900">
                {netHours} hrs{' '}
                <span className="text-slate-500 font-normal">
                  (Gross: {grossHours}h, Pause: {pauseMinutes}m)
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 font-medium">Estimated Earnings:</p>
              <p className="text-xs font-extrabold text-emerald-700">
                {grossEarnings.toFixed(2)} {settings.currency}
              </p>
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
              <FileText className="h-3.5 w-3.5 text-indigo-600" />
              <span>Notes & Task Details</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on? E.g., Frontend bug fixes, client meeting..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{initialEntry ? 'Update Entry' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
