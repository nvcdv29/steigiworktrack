import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Clock, Sparkles } from 'lucide-react';
import { WorkEntry, UserSettings } from '../types';
import { calculateEntryEarnings, formatGermanDate, isPlannedEntry } from '../lib/calculus';

interface WorkEntriesCalendarProps {
  entries: WorkEntry[];
  settings: UserSettings;
  onEdit: (entry: WorkEntry) => void;
  onDelete: (id: string) => void;
  onAddNewForDate?: (dateStr: string) => void;
}

export const WorkEntriesCalendar: React.FC<WorkEntriesCalendarProps> = ({
  entries,
  settings,
  onEdit,
  onDelete,
  onAddNewForDate,
}) => {
  // Determine default month from current date or latest entry date
  const [currentYearMonth, setCurrentYearMonth] = useState<string>(() => {
    const today = new Date().toISOString().substring(0, 7);
    if (entries.length > 0) {
      const dates = entries.map((e) => e.date.substring(0, 7)).sort().reverse();
      if (dates.includes(today)) return today;
      return dates[0];
    }
    return today;
  });

  const [selectedDayDetails, setSelectedDayDetails] = useState<string | null>(null);

  const [yearStr, monthStr] = currentYearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) - 1 || new Date().getMonth(); // 0-indexed

  // Navigate months
  const handlePrevMonth = () => {
    const prevDate = new Date(year, month - 1, 1);
    const y = prevDate.getFullYear();
    const m = String(prevDate.getMonth() + 1).padStart(2, '0');
    setCurrentYearMonth(`${y}-${m}`);
    setSelectedDayDetails(null);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month + 1, 1);
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    setCurrentYearMonth(`${y}-${m}`);
    setSelectedDayDetails(null);
  };

  // Build calendar days for the current month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Get day of week for first day (0 = Sun, 1 = Mon, ..., 6 = Sat)
  // Convert so Monday = 0, Sunday = 6
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  // Generate calendar grid array
  const calendarCells: Array<{ dateStr: string | null; dayNumber: number | null }> = [];

  // Padding cells before day 1
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push({ dateStr: null, dayNumber: null });
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const dateStr = `${currentYearMonth}-${dStr}`;
    calendarCells.push({ dateStr, dayNumber: d });
  }

  // Map entries by date
  const entriesByDate: Record<string, WorkEntry[]> = {};
  entries.forEach((entry) => {
    if (!entriesByDate[entry.date]) {
      entriesByDate[entry.date] = [];
    }
    entriesByDate[entry.date].push(entry);
  });

  // Calculate monthly stats
  const monthEntries = entries.filter((e) => e.date.startsWith(currentYearMonth));
  const monthActuals = monthEntries.filter((e) => !isPlannedEntry(e));
  const monthPlanned = monthEntries.filter((e) => isPlannedEntry(e));

  const totalActualHours = monthActuals.reduce((sum, e) => sum + e.netHours, 0);
  const totalPlannedHours = monthPlanned.reduce((sum, e) => sum + e.netHours, 0);
  const totalActualEarnings = totalActualHours * settings.hourlyWage;

  // Helper for Heatmap cell styles
  const getHeatmapStyle = (dayEntries: WorkEntry[] | undefined) => {
    if (!dayEntries || dayEntries.length === 0) {
      return 'bg-white border-slate-200 text-slate-400 hover:border-slate-300';
    }

    const hasPlanned = dayEntries.some((e) => isPlannedEntry(e));
    const totalHours = dayEntries.reduce((sum, e) => sum + e.netHours, 0);

    if (hasPlanned && dayEntries.every((e) => isPlannedEntry(e))) {
      return 'bg-purple-50/90 border-purple-300 text-purple-900 hover:bg-purple-100 shadow-2xs';
    }

    if (totalHours < 4) {
      return 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 shadow-2xs';
    } else if (totalHours < 7.5) {
      return 'bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200 shadow-2xs font-semibold';
    } else if (totalHours <= 10) {
      return 'bg-emerald-200 border-emerald-400 text-emerald-950 hover:bg-emerald-300 shadow-xs font-bold';
    } else {
      return 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700 shadow-sm font-extrabold';
    }
  };

  const monthName = new Date(year, month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedEntries = selectedDayDetails ? entriesByDate[selectedDayDetails] || [] : [];

  return (
    <div className="space-y-4">
      {/* Calendar Navigation & Month Metrics Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <span className="text-sm font-extrabold text-slate-900 min-w-[140px] text-center">
            {monthName}
          </span>

          <button
            onClick={handleNextMonth}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Month Summary Metrics */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            <span className="text-slate-500 font-medium">Worked: </span>
            <strong className="text-emerald-700 font-extrabold">{totalActualHours.toFixed(1)} h</strong>
            <span className="text-slate-400 font-medium ml-1">({totalActualEarnings.toFixed(2)} {settings.currency})</span>
          </div>

          {totalPlannedHours > 0 && (
            <div className="bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
              <span className="text-purple-700 font-medium">Planned: </span>
              <strong className="text-purple-900 font-extrabold">{totalPlannedHours.toFixed(1)} h</strong>
            </div>
          )}

          <div className="text-slate-500 font-bold">
            {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div className="text-amber-600">Sat</div>
        <div className="text-rose-600">Sun</div>
      </div>

      {/* Calendar Heatmap Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarCells.map((cell, idx) => {
          if (!cell.dateStr) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[70px] sm:min-h-[85px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200/60 p-1.5 opacity-40"
              />
            );
          }

          const dayEntries = entriesByDate[cell.dateStr] || [];
          const totalHours = dayEntries.reduce((sum, e) => sum + e.netHours, 0);
          const hasPlanned = dayEntries.some((e) => isPlannedEntry(e));
          const cellStyle = getHeatmapStyle(dayEntries);
          const isSelected = selectedDayDetails === cell.dateStr;

          // Check if today
          const isToday = cell.dateStr === new Date().toISOString().substring(0, 10);

          return (
            <div
              key={cell.dateStr}
              onClick={() => setSelectedDayDetails(cell.dateStr)}
              className={`min-h-[70px] sm:min-h-[85px] rounded-xl border p-1.5 sm:p-2 transition cursor-pointer flex flex-col justify-between relative group ${cellStyle} ${
                isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 z-10' : ''
              }`}
            >
              {/* Top Row: Date Number & Badge */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs font-black rounded-md px-1.5 py-0.5 ${
                    isToday
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-800'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {hasPlanned && (
                  <span className="text-[9px] bg-purple-600 text-white font-extrabold px-1 rounded uppercase tracking-tighter">
                    Plan
                  </span>
                )}
              </div>

              {/* Middle Row: Total Hours Badge */}
              {dayEntries.length > 0 ? (
                <div className="my-1">
                  <div className="text-xs font-black tracking-tight flex items-baseline gap-0.5">
                    <span>{totalHours.toFixed(1)}</span>
                    <span className="text-[10px] font-bold opacity-80">h</span>
                  </div>
                  <div className="text-[10px] font-semibold truncate max-w-full opacity-90 hidden sm:block">
                    {dayEntries[0].notes || `${dayEntries.length} shift(s)`}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition text-center py-2">
                  + Add
                </div>
              )}

              {/* Bottom indicator dots */}
              {dayEntries.length > 1 && (
                <div className="flex items-center space-x-0.5 mt-auto">
                  {dayEntries.map((e, eIdx) => (
                    <span
                      key={e.id || eIdx}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPlannedEntry(e) ? 'bg-purple-500' : 'bg-emerald-600'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex-wrap gap-2">
        <span className="text-slate-500 font-bold">Heatmap Intensity:</span>
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" />
            <span>0h</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
            <span>1–4h</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400 inline-block" />
            <span>4–7.5h</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-700 inline-block" />
            <span>7.5h+</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300 inline-block" />
            <span>Planned Shift</span>
          </div>
        </div>
      </div>

      {/* Selected Day Details Card (if clicked) */}
      {selectedDayDetails && (
        <div className="bg-white border border-indigo-200 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900">
                Entries for {formatGermanDate(selectedDayDetails)}
              </h4>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                {selectedEntries.length} entry/entries
              </span>
            </div>

            {onAddNewForDate && (
              <button
                onClick={() => onAddNewForDate(selectedDayDetails)}
                className="flex items-center space-x-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Entry</span>
              </button>
            )}
          </div>

          {selectedEntries.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">
              No entries logged for this date.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedEntries.map((entry) => {
                const { grossEarnings } = calculateEntryEarnings(entry, settings);
                const isPlanned = isPlannedEntry(entry);

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                      isPlanned
                        ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-extrabold">
                          {entry.startTime} - {entry.endTime} ({entry.netHours.toFixed(2)} h)
                        </span>
                        {isPlanned && (
                          <span className="text-[9px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.2 rounded uppercase">
                            Planned Shift
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        {entry.notes || <span className="italic text-slate-400">No notes</span>}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {grossEarnings.toFixed(2)} {settings.currency}
                      </span>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEdit(entry)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                          title="Edit Entry"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(entry.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
