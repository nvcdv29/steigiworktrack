import React, { useState } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  Download,
  Calendar,
  Clock,
  FileText,
  Plus,
  ArrowUpDown,
} from 'lucide-react';
import { WorkEntry, UserSettings } from '../types';
import { calculateEntryEarnings, formatGermanDate } from '../lib/calculus';

interface WorkEntriesTableProps {
  entries: WorkEntry[];
  settings: UserSettings;
  onEdit: (entry: WorkEntry) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

export const WorkEntriesTable: React.FC<WorkEntriesTableProps> = ({
  entries,
  settings,
  onEdit,
  onDelete,
  onAddNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'date' | 'netHours' | 'grossEarnings'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Extract unique months for filter dropdown
  const uniqueMonths = Array.from(
    new Set(entries.map((e) => e.date.substring(0, 7)))
  ).sort().reverse();

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesMonth =
      selectedMonthFilter === 'ALL' || entry.date.startsWith(selectedMonthFilter);
    const matchesSearch =
      searchQuery === '' ||
      entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.date.includes(searchQuery);
    return matchesMonth && matchesSearch;
  });

  // Sort entries
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortField === 'date') {
      if (a.date !== b.date) {
        return sortAsc
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      }
      // Same date: always list earlier time frame of the day first (clock hour order)
      return a.startTime.localeCompare(b.startTime);
    } else if (sortField === 'netHours') {
      if (a.netHours !== b.netHours) {
        return sortAsc ? a.netHours - b.netHours : b.netHours - a.netHours;
      }
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return a.startTime.localeCompare(b.startTime);
    } else if (sortField === 'grossEarnings') {
      const earnA = a.netHours * settings.hourlyWage;
      const earnB = b.netHours * settings.hourlyWage;
      if (earnA !== earnB) {
        return sortAsc ? earnA - earnB : earnB - earnA;
      }
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return a.startTime.localeCompare(b.startTime);
    }
    return 0;
  });

  const toggleSort = (field: 'date' | 'netHours' | 'grossEarnings') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Export handler
  const handleExportCSV = () => {
    if (sortedEntries.length === 0) return;

    const headers = [
      'Date',
      'Start Time',
      'End Time',
      'Pause (mins)',
      'Gross Hours',
      'Net Hours',
      `Hourly Wage (${settings.currency})`,
      `Gross Earnings (${settings.currency})`,
      'Notes',
    ];

    const rows = sortedEntries.map((e) => {
      const { grossEarnings } = calculateEntryEarnings(e, settings);
      return [
        e.date,
        e.startTime,
        e.endTime,
        e.pauseMinutes,
        e.grossHours,
        e.netHours,
        settings.hourlyWage,
        grossEarnings.toFixed(2),
        `"${e.notes.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `work_hours_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 text-slate-900 shadow-xs space-y-3">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Work Entry Logs</h3>
          <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold border border-slate-200">
            {sortedEntries.length} entries
          </span>
        </div>

        {/* Filter / Search / Export Bar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-44">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          {/* Month Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white text-slate-900 font-normal">
                All Months
              </option>
              {uniqueMonths.map((mKey: string) => {
                const [y, m] = mKey.split('-');
                const formatted = m && y ? `${m}/${y.slice(-2)}` : mKey;
                return (
                  <option key={mKey} value={mKey} className="bg-white text-slate-900 font-normal">
                    {formatted}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={sortedEntries.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition disabled:opacity-50 cursor-pointer"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Add New Entry Button */}
          <button
            onClick={onAddNew}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">
                <button
                  onClick={() => toggleSort('date')}
                  className="flex items-center space-x-1 hover:text-indigo-600 transition cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Date</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 px-3">Start - End</th>
              <th className="py-2.5 px-3">Pause</th>
              <th className="py-2.5 px-3">
                <button
                  onClick={() => toggleSort('netHours')}
                  className="flex items-center space-x-1 hover:text-indigo-600 transition cursor-pointer"
                >
                  <span>Net Hours</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 px-3">
                <button
                  onClick={() => toggleSort('grossEarnings')}
                  className="flex items-center space-x-1 hover:text-indigo-600 transition cursor-pointer"
                >
                  <span>Gross Earnings</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 px-3">Notes</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  <div className="space-y-1.5">
                    <FileText className="h-7 w-7 mx-auto text-slate-300" />
                    <p>No work entries match the selected filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedEntries.map((entry) => {
                const { grossEarnings } = calculateEntryEarnings(entry, settings);
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50/80 transition group text-slate-700"
                  >
                    <td className="py-2.5 px-3 font-semibold whitespace-nowrap text-slate-900">
                      {formatGermanDate(entry.date)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      {entry.startTime} - {entry.endTime}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-amber-700 font-medium">
                      {entry.pauseMinutes > 0 ? `${entry.pauseMinutes}m` : '-'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-bold text-indigo-700">
                      {entry.netHours.toFixed(2)} h
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-bold text-emerald-700">
                      {grossEarnings.toFixed(2)} {settings.currency}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">
                      {entry.notes || <span className="text-slate-300 italic">No notes</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => onEdit(entry)}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      {deletingId === entry.id ? (
                        <div className="inline-flex items-center space-x-1 animate-in fade-in">
                          <button
                            onClick={() => {
                              onDelete(entry.id);
                              setDeletingId(null);
                            }}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer shadow-2xs"
                            title="Confirm Delete"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(entry.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

