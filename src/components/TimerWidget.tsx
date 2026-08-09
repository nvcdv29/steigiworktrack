import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, Save, X, RefreshCw } from 'lucide-react';
import { WorkEntry, UserSettings } from '../types';
import { calculateHours } from '../lib/calculus';

interface TimerWidgetProps {
  settings: UserSettings;
  onSaveEntry: (entry: WorkEntry) => void;
  onClose: () => void;
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  settings,
  onSaveEntry,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTimeStr, setStartTimeStr] = useState<string>('');
  const [endTimeStr, setEndTimeStr] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (isRunning && isPaused) {
      interval = setInterval(() => {
        setPauseSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleStart = () => {
    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    setStartTimeStr(timeFormatted);
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    setEndTimeStr(timeFormatted);
    setIsRunning(false);
    setIsPaused(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setPauseSeconds(0);
    setStartTimeStr('');
    setEndTimeStr('');
  };

  const formatHMS = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(
      2,  '0'
    )}:${String(s).padStart(2, '0')}`;
  };

  const grossMin = Math.floor(elapsedSeconds / 60);
  const pauseMin = Math.floor(pauseSeconds / 60);
  const netMin = Math.max(0, grossMin - pauseMin);
  const netHours = Math.round((netMin / 60) * 100) / 100;
  const estimatedGrossEarnings =
    Math.round(netHours * settings.hourlyWage * 100) / 100;

  const handleSave = () => {
    const startToUse =
      startTimeStr ||
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const endToUse =
      endTimeStr ||
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const hoursCalc = calculateHours(startToUse, endToUse, pauseMin);

    const newEntry: WorkEntry = {
      id: `timer-${Date.now()}`,
      date: entryDate,
      startTime: startToUse,
      endTime: endToUse,
      pauseMinutes: pauseMin,
      grossHours: hoursCalc.grossHours || Math.round((grossMin / 60) * 100) / 100,
      netHours: hoursCalc.netHours || netHours,
      notes: notes.trim() || 'Timer session entry',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveEntry(newEntry);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 text-slate-900 shadow-xl space-y-4 my-auto animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Live Clock-In Timer</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Big Timer Display */}
        <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {isRunning
              ? isPaused
                ? 'Paused - Pause Duration'
                : 'Working - Elapsed Time'
              : 'Timer Ready'}
          </p>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {formatHMS(elapsedSeconds)}
          </p>
          {pauseSeconds > 0 && (
            <p className="text-xs text-amber-700 mt-1 font-bold">
              Pause Time: {formatHMS(pauseSeconds)} ({pauseMin} mins)
            </p>
          )}
          <div className="mt-2.5 flex items-center justify-center space-x-3 text-xs text-slate-600 font-medium">
            <span>
              Net Hours: <strong className="text-indigo-700">{netHours} hrs</strong>
            </span>
            <span>•</span>
            <span>
              Earnings: <strong className="text-emerald-700">{estimatedGrossEarnings.toFixed(2)} {settings.currency}</strong>
            </span>
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center space-x-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="flex-1 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-xs transition"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Start Work</span>
            </button>
          ) : (
            <>
              <button
                onClick={handlePauseToggle}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-bold transition border ${
                  isPaused
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    <span>Resume Work</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 fill-white" />
                    <span>Pause</span>
                  </>
                )}
              </button>
              <button
                onClick={handleStop}
                className="flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-xs transition"
              >
                <Square className="h-4 w-4 fill-white" />
                <span>End</span>
              </button>
            </>
          )}

          {(elapsedSeconds > 0 || startTimeStr) && (
            <button
              onClick={handleReset}
              title="Reset Timer"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Entry Inputs */}
        <div className="space-y-2.5 pt-2 text-xs border-t border-slate-100">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Start Time</label>
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">End Time</label>
              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => setEndTimeStr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Entry Notes / Description</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Client website development, testing, meeting..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Save Entry CTA */}
        <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Entry Log</span>
          </button>
        </div>
      </div>
    </div>
  );
};
