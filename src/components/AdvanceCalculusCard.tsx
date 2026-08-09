import React, { useState } from 'react';
import { Calendar, Info, ArrowUpRight, Banknote, TrendingUp, Sparkles } from 'lucide-react';
import { UserSettings, MonthSummary } from '../types';

import { FormattedNumber } from './FormattedNumber';

interface AdvanceCalculusCardProps {
  settings: UserSettings;
  monthlySummaries: MonthSummary[];
  onOpenGuide: () => void;
}

export const AdvanceCalculusCard: React.FC<AdvanceCalculusCardProps> = ({
  settings,
  monthlySummaries,
  onOpenGuide,
}) => {
  // Default to current month or most recent month
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    monthlySummaries.length > 0
      ? monthlySummaries[monthlySummaries.length - 1].monthKey
      : new Date().toISOString().substring(0, 7)
  );

  const activeSummary = monthlySummaries.find((s) => s.monthKey === selectedMonthKey) || {
    monthKey: selectedMonthKey,
    monthLabel: 'Selected Month',
    entryCount: 0,
    totalNetHours: 0,
    grossEarnings: 0,
    fixedCostDeducted: 0,
    netEarnings: 0,
    minijobCap: settings.minijobCap,
    monthlyHourLimit: settings.hourlyWage > 0 ? settings.minijobCap / settings.hourlyWage : 0,
    monthRatio: 0,
    monthsInAdvance: 0,
    cumulativeBufferMonths: 0,
    payoutThisMonth: 0,
    rolloverUnpaidEnd: 0,
    futurePayoutProjections: []
  };

  const monthlyHourLimit =
    settings.hourlyWage > 0 ? settings.minijobCap / settings.hourlyWage : 0;

  // Total banked months across all active summaries
  const totalCumulativeBuffer =
    monthlySummaries.length > 0
      ? monthlySummaries[monthlySummaries.length - 1].cumulativeBufferMonths
      : 0;

  const monthRatio = activeSummary.grossEarnings / (settings.minijobCap || 1);
  const isOverCap = activeSummary.grossEarnings >= settings.minijobCap;

  // Single month metrics (floored at 0, no negative values)
  const advanceMonthsThisMonth = Math.max(0, Math.round((monthRatio - 1.0) * 10) / 10);
  const surplusThisMonth = Math.max(0, Math.round((activeSummary.grossEarnings - settings.minijobCap) * 100) / 100);

  // Cumulative total buffer metrics (floored at 0, no negative values)
  const cumBufferFloored = Math.max(0, Math.round(totalCumulativeBuffer * 10) / 10);
  const cumSurplusMoney = Math.max(0, Math.round((cumBufferFloored * settings.minijobCap) * 100) / 100);

  const ratioPercentage = Math.round(monthRatio * 100);
  const ratioColorClass = ratioPercentage >= 100 ? "text-emerald-600" : "text-slate-800";
  const isTile2Active = cumBufferFloored > 0 || (activeSummary.futurePayoutProjections && activeSummary.futurePayoutProjections.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 text-slate-900 shadow-xs space-y-4 sm:space-y-5 relative">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-md text-indigo-500 shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              Month Overview
            </h2>
            <span className="text-xs font-medium text-slate-400">
              (Cap: <FormattedNumber value={settings.minijobCap} suffix={` ${settings.currency}`} />)
            </span>
            <button
              onClick={onOpenGuide}
              className="text-slate-400 hover:text-indigo-600 transition cursor-pointer ml-1"
              title="View step-by-step formula guide"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Month Dropdown */}
        {monthlySummaries.length > 0 && (
          <div className="flex items-center space-x-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none pr-1 cursor-pointer"
            >
              {monthlySummaries.map((s) => (
                <option key={s.monthKey} value={s.monthKey} className="bg-white text-slate-900 font-normal">
                  {s.monthLabel}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tile 1: Current Month Performance & Advance */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 font-bold flex items-center text-sm">
                <Banknote className="w-4 h-4 mr-2 text-indigo-500" />
                Month Performance
              </h3>
              {isOverCap && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-emerald-200">
                  Cap Reached
                </span>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-slate-500">Gross Income vs Cap</span>
                <span className="text-slate-700">
                  <FormattedNumber value={activeSummary.grossEarnings} suffix={` ${settings.currency}`} /> / <FormattedNumber value={settings.minijobCap} suffix={` ${settings.currency}`} />
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (activeSummary.grossEarnings / (settings.minijobCap || 1)) * 100)}%` }}
                />
                {activeSummary.grossEarnings > settings.minijobCap && (
                  <div
                    className="bg-emerald-50 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, ((activeSummary.grossEarnings - settings.minijobCap) / (settings.minijobCap || 1)) * 100)}%` }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <span className="block text-[11px] text-slate-500 mb-0.5 font-semibold">Income Ratio</span>
              <span className={`text-lg font-black ${ratioColorClass}`}>
                <FormattedNumber value={ratioPercentage} suffix="%" />
              </span>
            </div>
            {surplusThisMonth > 0 ? (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 shadow-sm">
                <span className="block text-[11px] text-emerald-700 mb-0.5 font-semibold">Advance Generated</span>
                <span className="text-lg font-black text-emerald-700">
                  <FormattedNumber value={advanceMonthsThisMonth} prefix="+" suffix="mo" />
                </span>
              </div>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm opacity-60">
                <span className="block text-[11px] text-slate-500 mb-0.5 font-semibold">Advance Generated</span>
                <span className="text-lg font-black text-slate-400">
                  <FormattedNumber value={0} suffix="mo" />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tile 2: Buffer & Projections */}
        <div className={`bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between h-full transition-all duration-300 ${!isTile2Active ? 'opacity-60 grayscale' : ''}`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 font-bold flex items-center text-sm">
                <TrendingUp className="w-4 h-4 mr-2 text-emerald-600" />
                Buffer & Projections
              </h3>
              {cumBufferFloored > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-emerald-200">
                  Surplus Active
                </span>
              )}
            </div>

            <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm mb-4 flex items-center justify-between">
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-0.5">Cumulative Bank Buffer</span>
                <span className="text-2xl font-black text-emerald-600">
                  {cumBufferFloored > 0 ? <FormattedNumber value={cumBufferFloored} prefix="+" suffix="mo" /> : <FormattedNumber value={0} suffix="mo" />}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[11px] font-semibold text-slate-500 mb-0.5">Reserve Value</span>
                <span className="text-lg font-bold text-slate-700">
                  <FormattedNumber value={cumSurplusMoney} suffix={` ${settings.currency}`} />
                </span>
              </div>
            </div>

            {/* Buffer Funded Runaway Card */}
            <div className="bg-gradient-to-br from-indigo-50/70 to-indigo-50/20 rounded-lg p-3 border border-indigo-100/70 shadow-2xs mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold text-slate-800">Funded Runaway Runway</span>
                </div>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                  {cumBufferFloored.toFixed(1)} Months
                </span>
              </div>
              <p className="text-[10px] text-slate-600 leading-normal mb-2.5">
                Your accumulated bank buffer can fully support <strong className="font-bold text-indigo-900">{cumBufferFloored.toFixed(1)} months</strong> of complete work break. During this time, you will continue to receive your full monthly payout of <strong className="font-semibold text-indigo-900">{settings.minijobCap.toFixed(0)} {settings.currency}</strong> from your reserve balance.
              </p>
              
              {/* Visual runaway progress blocks */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => {
                  const filled = cumBufferFloored >= i;
                  const partial = !filled && cumBufferFloored > (i - 1);
                  const partialPercent = partial ? (cumBufferFloored - (i - 1)) * 100 : 0;
                  
                  return (
                    <div key={i} className="flex-1 h-1.5 bg-slate-200/60 rounded-full overflow-hidden relative" title={`Month ${i}`}>
                      {filled ? (
                        <div className="absolute inset-0 bg-indigo-500 rounded-full" />
                      ) : partial ? (
                        <div className="absolute left-0 top-0 bottom-0 bg-indigo-500 rounded-full" style={{ width: `${partialPercent}%` }} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                <span>1mo</span>
                <span>3mo</span>
                <span>6mo max</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Upcoming Additional Payouts</h4>
            {activeSummary.futurePayoutProjections && activeSummary.futurePayoutProjections.length > 0 ? (
              <div className="space-y-1.5">
                {activeSummary.futurePayoutProjections.map((proj, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 bg-white border border-slate-100 rounded-md shadow-sm">
                    <span className="font-semibold text-slate-600">{proj.monthLabel}</span>
                    <span className="text-emerald-700 font-bold">
                      <FormattedNumber value={proj.payoutAmount} prefix="+" suffix={` ${settings.currency}`} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-3 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/50">
                No future extra payouts scheduled.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

