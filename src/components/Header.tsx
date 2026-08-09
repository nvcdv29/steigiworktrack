import React from 'react';
import { Clock, Plus, Settings, Calculator, Coins } from 'lucide-react';
import { UserSettings } from '../types';

interface HeaderProps {
  settings: UserSettings;
  activeTimer: boolean;
  onOpenTimer: () => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenCalculusGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeTimer,
  onOpenTimer,
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenCalculusGuide,
}) => {
  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-2.5">
        {/* Brand Title */}
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center space-x-0.5 shrink-0 shadow-2xs">
            <Clock className="h-4 w-4 text-indigo-600" />
            <Coins className="h-4 w-4 text-emerald-600 -ml-1" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
              work track
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {/* Calculus Guide Button */}
          <button
            onClick={onOpenCalculusGuide}
            className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <Calculator className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden xs:inline">Formula Guide</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettingsModal}
            className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span>Settings</span>
          </button>

          {/* Live Timer Toggle */}
          <button
            onClick={onOpenTimer}
            className={`flex items-center space-x-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition border shadow-xs cursor-pointer ${
              activeTimer
                ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{activeTimer ? 'Timer...' : 'Clock-In'}</span>
          </button>

          {/* New Entry Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center space-x-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Log Hours</span>
          </button>
        </div>
      </div>
    </header>
  );
};

