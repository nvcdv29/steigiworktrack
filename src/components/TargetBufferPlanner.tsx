import React, { useState, useEffect } from 'react';
import { Target, Calendar, Clock, Plus, Sparkles, CheckSquare, Square, Trash2, ArrowRight, Zap } from 'lucide-react';
import { WorkEntry, UserSettings, MonthSummary, TargetScenario, PlannerState } from '../types';
import { calculateActiveWorkdays, calculateEntryEarnings, formatGermanDate, isPlannedEntry } from '../lib/calculus';
import { FormattedNumber } from './FormattedNumber';

interface TargetBufferPlannerProps {
  entries: WorkEntry[];
  settings: UserSettings;
  monthlySummaries: MonthSummary[];
  onAddPlannedShift: () => void;
  onDeleteEntry: (id: string) => void;
  onToggleEntryPlannedStatus?: (entry: WorkEntry) => void;
}

const DEFAULT_SCENARIOS: TargetScenario[] = [
  {
    id: 'preset-dec-2026',
    label: 'Dec 2026 (4 mos)',
    targetEndDate: '2026-12-31',
    monthlyCap: 603,
    payoutMonths: 4,
  },
  {
    id: 'preset-feb-2027',
    label: 'Feb 2027 (6 mos)',
    targetEndDate: '2027-02-28',
    monthlyCap: 603,
    payoutMonths: 6,
  },
  {
    id: 'custom',
    label: 'Custom Target',
    targetEndDate: '2026-12-31',
    monthlyCap: 603,
    payoutMonths: 4,
  },
];

export const TargetBufferPlanner: React.FC<TargetBufferPlannerProps> = ({
  entries,
  settings,
  monthlySummaries,
  onAddPlannedShift,
  onDeleteEntry,
}) => {
  // Local state for planner
  const [plannerState, setPlannerState] = useState<PlannerState>(() => {
    const saved = localStorage.getItem('runway_planner_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      activeScenarioId: 'preset-dec-2026',
      customTargetEndDate: '2026-12-31',
      customMonthlyCap: 603,
      workWindowStart: '2026-08-11',
      workWindowEnd: '2026-08-28',
      daysOffPerWeek: 1,
    };
  });

  // Track which planned shift entries are enabled in what-if scenario
  const [disabledShiftIds, setDisabledShiftIds] = useState<string[]>([]);

  // Save state on change
  useEffect(() => {
    localStorage.setItem('runway_planner_state', JSON.stringify(plannerState));
  }, [plannerState]);

  // Derive active scenario
  const selectedPreset = DEFAULT_SCENARIOS.find((s) => s.id === plannerState.activeScenarioId) || DEFAULT_SCENARIOS[0];
  const isCustomScenario = plannerState.activeScenarioId === 'custom';

  const targetEndDate = isCustomScenario ? plannerState.customTargetEndDate : selectedPreset.targetEndDate;
  const targetMonthlyCap = isCustomScenario ? plannerState.customMonthlyCap : selectedPreset.monthlyCap;

  // Calculate payout months count (Sept-Dec = 4 payout months for Dec 2026)
  let payoutMonths = selectedPreset.payoutMonths || 4;
  if (isCustomScenario && targetEndDate) {
    const startM = new Date(plannerState.workWindowStart);
    const endM = new Date(targetEndDate);
    if (!isNaN(startM.getTime()) && !isNaN(endM.getTime())) {
      const months = (endM.getFullYear() - startM.getFullYear()) * 12 + (endM.getMonth() - startM.getMonth());
      payoutMonths = Math.max(1, months);
    }
  }

  // 1. Target Reserve Requirement (€)
  const targetReserve = payoutMonths * targetMonthlyCap;

  // 2. Current Actual Bank Reserve (€)
  // Derived dynamically from latest summary's rolloverUnpaidEnd or actual worked earnings
  const latestSummary = monthlySummaries.length > 0 ? monthlySummaries[monthlySummaries.length - 1] : null;
  const actualBankReserve = latestSummary
    ? Math.max(0, latestSummary.rolloverUnpaidEnd)
    : entries.filter((e) => !isPlannedEntry(e)).reduce((sum, e) => sum + e.netHours * settings.hourlyWage, 0);

  // 3. Commitments: Scheduled Future Shifts (Pre-built Credit)
  const plannedEntries = entries.filter((e) => isPlannedEntry(e));
  const enabledPlannedEntries = plannedEntries.filter((e) => !disabledShiftIds.includes(e.id));

  const scheduledShiftCredit = enabledPlannedEntries.reduce((sum, e) => {
    const { grossEarnings } = calculateEntryEarnings(e, settings);
    return sum + grossEarnings;
  }, 0);

  const totalScheduledHours = enabledPlannedEntries.reduce((sum, e) => sum + e.netHours, 0);

  // Total Available Buffer (Actuals + Scheduled)
  const currentPlusScheduled = actualBankReserve + scheduledShiftCredit;

  // 4. Remaining Deficit (€) = Target Reserve - Current Bank Reserve - Scheduled Shifts Credit
  const remainingDeficit = Math.max(0, targetReserve - actualBankReserve - scheduledShiftCredit);

  // 5. Required Hours
  const requiredHours = settings.hourlyWage > 0 ? remainingDeficit / settings.hourlyWage : 0;

  // 6. Active Workdays in Work Window
  const activeWorkdays = calculateActiveWorkdays(
    plannerState.workWindowStart,
    plannerState.workWindowEnd,
    plannerState.daysOffPerWeek
  );

  // 7. Required Daily Pace (hrs/day)
  const requiredDailyPace = activeWorkdays > 0 ? requiredHours / activeWorkdays : 0;

  // 8. Impact Badge Calculation: Reduction in daily pace from scheduled shifts
  const paceReduction = activeWorkdays > 0 && settings.hourlyWage > 0
    ? (scheduledShiftCredit / settings.hourlyWage) / activeWorkdays
    : 0;

  // Toggle shift what-if state
  const toggleShiftEnabled = (id: string) => {
    setDisabledShiftIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Progress Bar Percentages
  const actualPercent = Math.min(100, (actualBankReserve / (targetReserve || 1)) * 100);
  const scheduledPercent = Math.min(100 - actualPercent, (scheduledShiftCredit / (targetReserve || 1)) * 100);
  const deficitPercent = Math.max(0, 100 - actualPercent - scheduledPercent);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 text-slate-900 shadow-xs space-y-4 sm:space-y-5 relative">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-indigo-600 text-white rounded-md shrink-0 shadow-2xs">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Target & Buffer Planner</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full uppercase tracking-wider">
                Runway Builder
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Bridge actual banked reserves, upcoming shift commitments, and target payout horizons.
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-bold">
          {DEFAULT_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => setPlannerState((prev) => ({ ...prev, activeScenarioId: sc.id }))}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                plannerState.activeScenarioId === sc.id
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs Section: Target Horizon & Work Window */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
        {/* Left Column: Target Horizon */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>Target Horizon</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Target End Date</label>
              {isCustomScenario ? (
                <input
                  type="date"
                  value={plannerState.customTargetEndDate}
                  onChange={(e) => setPlannerState((prev) => ({ ...prev, customTargetEndDate: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-slate-900">
                  {selectedPreset.targetEndDate.substring(0, 7)} ({payoutMonths} mos)
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Monthly Payout Cap</label>
              {isCustomScenario ? (
                <div className="relative">
                  <input
                    type="number"
                    value={plannerState.customMonthlyCap}
                    onChange={(e) => setPlannerState((prev) => ({ ...prev, customMonthlyCap: Math.max(1, Number(e.target.value)) }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">€/mo</span>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-emerald-700">
                  {targetMonthlyCap} {settings.currency}/mo
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Work Window & Rest Constraints */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            <span>Work Window & Rest Constraints</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                value={plannerState.workWindowStart}
                onChange={(e) => setPlannerState((prev) => ({ ...prev, workWindowStart: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                value={plannerState.workWindowEnd}
                onChange={(e) => setPlannerState((prev) => ({ ...prev, workWindowEnd: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Days Off/Wk</label>
              <select
                value={plannerState.daysOffPerWeek}
                onChange={(e) => setPlannerState((prev) => ({ ...prev, daysOffPerWeek: Number(e.target.value) }))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
              >
                <option value={0}>0 Days (7d/wk)</option>
                <option value={1}>1 Day (Sun off)</option>
                <option value={2}>2 Days (Sat/Sun)</option>
                <option value={3}>3 Days (Fri-Sun)</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Calculated Active Workdays:</span>
            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {activeWorkdays} Active Workdays
            </span>
          </div>
        </div>
      </div>

      {/* Multi-colored Visual Progress Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700">Target Reserve Coverage Bar</span>
          <span className="text-slate-900">
            <FormattedNumber value={currentPlusScheduled} suffix={` ${settings.currency}`} /> / <FormattedNumber value={targetReserve} suffix={` ${settings.currency}`} />
          </span>
        </div>

        {/* Multi-segment bar */}
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex shadow-inner">
          {/* Blue: Current Logged Buffer */}
          <div
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${actualPercent}%` }}
            title={`Current Banked Buffer: ${actualBankReserve.toFixed(2)} ${settings.currency}`}
          />
          {/* Green: Scheduled Future Shifts Credit */}
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${scheduledPercent}%` }}
            title={`Scheduled Shifts Credit: ${scheduledShiftCredit.toFixed(2)} ${settings.currency}`}
          />
          {/* Yellow/Amber: Remaining Deficit Needed */}
          <div
            className="bg-amber-400 h-full transition-all duration-300"
            style={{ width: `${deficitPercent}%` }}
            title={`Remaining Deficit: ${remainingDeficit.toFixed(2)} ${settings.currency}`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-0.5 flex-wrap gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
            <span>Current Logged Reserve ({actualBankReserve.toFixed(0)} {settings.currency})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Scheduled Shift Credit ({scheduledShiftCredit.toFixed(0)} {settings.currency})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Remaining Deficit ({remainingDeficit.toFixed(0)} {settings.currency})</span>
          </div>
        </div>
      </div>

      {/* Future Scheduled Shifts Pipeline (Pre-built Credit) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Future Scheduled Shifts (Pre-built Credit)
            </h3>
            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-200">
              {enabledPlannedEntries.length} / {plannedEntries.length} Active
            </span>
          </div>

          <button
            onClick={onAddPlannedShift}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Shift</span>
          </button>
        </div>

        {plannedEntries.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-lg">
            No future shifts attached yet. Click <strong>+ Add Shift</strong> to schedule upcoming confirmed work (e.g. festival shifts).
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plannedEntries.map((shift) => {
              const { grossEarnings } = calculateEntryEarnings(shift, settings);
              const isEnabled = !disabledShiftIds.includes(shift.id);

              return (
                <div
                  key={shift.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                    isEnabled
                      ? 'bg-purple-50/60 border-purple-200 text-slate-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <button
                      onClick={() => toggleShiftEnabled(shift.id)}
                      className="text-purple-700 hover:text-purple-900 cursor-pointer shrink-0"
                      title={isEnabled ? 'Click to exclude from what-if scenario' : 'Click to include in scenario'}
                    >
                      {isEnabled ? (
                        <CheckSquare className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    <div className="truncate">
                      <p className="text-xs font-bold truncate">
                        {shift.notes || 'Scheduled Work Shift'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {formatGermanDate(shift.date)} ({shift.netHours} h)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xs font-black text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-100">
                      +{grossEarnings.toFixed(2)} {settings.currency}
                    </span>

                    <button
                      onClick={() => onDeleteEntry(shift.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                      title="Delete scheduled shift"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Calculated Requirements Summary Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Calculated Requirements
        </h3>

        {/* 3 Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Target Reserve</span>
            <span className="text-xl font-black text-slate-900">
              <FormattedNumber value={targetReserve} suffix={` ${settings.currency}`} />
            </span>
            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
              ({payoutMonths} mos × {targetMonthlyCap} {settings.currency})
            </span>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-center">
            <span className="block text-[11px] font-semibold text-indigo-800 mb-1">Current + Scheduled</span>
            <span className="text-xl font-black text-indigo-700">
              <FormattedNumber value={currentPlusScheduled} suffix={` ${settings.currency}`} />
            </span>
            <span className="block text-[10px] text-indigo-500 font-medium mt-0.5">
              (Actual: {actualBankReserve.toFixed(0)}€ + Shifts: {scheduledShiftCredit.toFixed(0)}€)
            </span>
          </div>

          <div className={`border rounded-xl p-3.5 text-center ${remainingDeficit > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
            <span className="block text-[11px] font-semibold text-slate-700 mb-1">Remaining Deficit</span>
            <span className={`text-xl font-black ${remainingDeficit > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
              <FormattedNumber value={remainingDeficit} suffix={` ${settings.currency}`} />
            </span>
            <span className="block text-[10px] font-medium mt-0.5 text-slate-500">
              {remainingDeficit > 0 ? 'Cash needed to hit target' : 'Target Fully Funded! 🎉'}
            </span>
          </div>
        </div>

        {/* 2 Main Primary Highlight Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Highlight Tile 1: Required August Hours */}
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider block mb-1">
                Required Work Hours
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black tracking-tight text-white">
                  <FormattedNumber value={requiredHours} decimals={2} />
                </span>
                <span className="text-lg font-bold text-indigo-200">hrs</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-indigo-800/80 flex items-center justify-between text-[11px] text-indigo-200">
              <span>Hourly wage rate:</span>
              <span className="font-bold text-white">{settings.hourlyWage.toFixed(2)} {settings.currency}/h</span>
            </div>
          </div>

          {/* Highlight Tile 2: Required Daily Pace */}
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block mb-1">
                Required Daily Pace
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black tracking-tight text-white">
                  <FormattedNumber value={requiredDailyPace} decimals={2} />
                </span>
                <span className="text-lg font-bold text-purple-200">hrs / day</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-purple-800/80 flex items-center justify-between text-[11px] text-purple-200">
              <span>Net working days available:</span>
              <span className="font-bold text-white">{activeWorkdays} workdays ({plannerState.daysOffPerWeek}d off/wk)</span>
            </div>
          </div>
        </div>

        {/* Impact Badge */}
        {paceReduction > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-2.5 text-emerald-950 shadow-2xs animate-in fade-in">
            <Zap className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <strong className="font-bold">Scheduled Shift Impact:</strong> Your active upcoming shifts ({totalScheduledHours}h / {scheduledShiftCredit.toFixed(2)}{settings.currency}) reduced your required daily work pace by <strong className="font-black text-emerald-800">-{paceReduction.toFixed(2)} hrs/day</strong>!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
