import { UserSettings, WorkEntry, MonthSummary, FixedCostDeduction } from '../types';

/**
 * Formats YYYY-MM-DD date string into German format DD.MM.YYYY.
 */
export function formatGermanDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }
  return dateStr;
}

/**
 * Calculates duration in gross hours and net hours from start time, end time, and pause minutes.
 */
export function calculateHours(
  startTime: string,
  endTime: string,
  pauseMinutes: number = 0
): { grossHours: number; netHours: number } {
  if (!startTime || !endTime) {
    return { grossHours: 0, netHours: 0 };
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return { grossHours: 0, netHours: 0 };
  }

  let startTotalMinutes = startH * 60 + startM;
  let endTotalMinutes = endH * 60 + endM;

  // Handle overnight shift (e.g., 22:00 to 04:00)
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  const grossMinutes = endTotalMinutes - startTotalMinutes;
  const netMinutes = Math.max(0, grossMinutes - (pauseMinutes || 0));

  const grossHours = Math.round((grossMinutes / 60) * 100) / 100;
  const netHours = Math.round((netMinutes / 60) * 100) / 100;

  return { grossHours, netHours };
}

/**
 * Calculates earnings for a given work entry and user settings.
 */
export function calculateEntryEarnings(
  entry: WorkEntry,
  settings: UserSettings
): {
  grossEarnings: number;
  fixedCostDeduction: number;
  netEarnings: number;
} {
  const grossEarnings = Math.round(entry.netHours * settings.hourlyWage * 100) / 100;
  let fixedCostDeduction = 0;

  const entryMonth = entry.date.substring(0, 7);
  for (const fc of settings.fixedCosts || []) {
    if (fc.type === 'per_entry') {
      if (!fc.appliesToMonth || fc.appliesToMonth === 'ALL' || fc.appliesToMonth === entryMonth) {
        fixedCostDeduction += fc.amount;
      }
    }
  }

  const netEarnings = Math.round(Math.max(0, grossEarnings - fixedCostDeduction) * 100) / 100;

  return {
    grossEarnings,
    fixedCostDeduction,
    netEarnings,
  };
}

/**
 * Calculates total fixed cost deduction for a specific month.
 */
export function calculateMonthFixedCosts(
  monthKey: string,
  entryCount: number,
  fixedCosts: FixedCostDeduction[] = []
): number {
  let totalDeduction = 0;

  for (const fc of fixedCosts) {
    // If targeted to a specific month, skip if not matching
    if (fc.appliesToMonth && fc.appliesToMonth !== 'ALL' && fc.appliesToMonth !== monthKey) {
      continue;
    }

    if (fc.type === 'one_time' || fc.type === 'monthly') {
      totalDeduction += fc.amount;
    } else if (fc.type === 'weekly') {
      totalDeduction += fc.amount * 4.33;
    } else if (fc.type === 'per_entry') {
      totalDeduction += fc.amount * entryCount;
    }
  }

  return Math.round(totalDeduction * 100) / 100;
}

/**
 * Generates monthly summaries and advance calculus for entries.
 */
export function calculateMonthlySummaries(
  entries: WorkEntry[],
  settings: UserSettings
): MonthSummary[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  // Group entries by month (YYYY-MM)
  const monthMap = new Map<string, WorkEntry[]>();

  // Sort entries by date ascending and startTime ascending
  const sortedEntries = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );

  for (const entry of sortedEntries) {
    const monthKey = entry.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(entry);
  }

  const monthlyHourLimit =
    settings.hourlyWage > 0 ? settings.minijobCap / settings.hourlyWage : 0;

  const summaries: MonthSummary[] = [];
  let cumulativeBufferMonths = 0;
  let runningUnpaidReserve = 0; // Rollover balance carried over from previous month

  // Process sorted month keys
  const monthKeys = Array.from(monthMap.keys()).sort();

  for (const monthKey of monthKeys) {
    const monthEntries = monthMap.get(monthKey)!;
    const totalNetHours = monthEntries.reduce((sum, e) => sum + e.netHours, 0);
    const roundedNetHours = Math.round(totalNetHours * 100) / 100;
    const grossEarnings = Math.round(roundedNetHours * settings.hourlyWage * 100) / 100;

    const fixedCostDeducted = calculateMonthFixedCosts(monthKey, monthEntries.length, settings.fixedCosts);
    const netEarnings = Math.round(Math.max(0, grossEarnings - fixedCostDeducted) * 100) / 100;

    // Calculus: Compare gross earnings against Minijob cap
    const monthRatio = settings.minijobCap > 0 ? grossEarnings / settings.minijobCap : 0;
    const monthsInAdvance = Math.round(monthRatio * 100) / 100;
    
    const isDeferred = settings.deferredMonths?.includes(monthKey) || false;

    // Cumulative buffer: Every month adds (monthRatio - 1.0) to the buffer balance
    // If deferred, the entire month ratio goes to the buffer since 0 cap was consumed.
    const monthAdvanceDelta = isDeferred ? monthRatio : monthRatio - 1.0;
    cumulativeBufferMonths = Math.round((cumulativeBufferMonths + monthAdvanceDelta) * 100) / 100;

    // Payout Forecast & Rollover logic under Minijob cap
    // Total money available to pay out = earned this month + previous unpaid reserve
    const totalEarningsAvailable = grossEarnings + runningUnpaidReserve;
    const payoutThisMonth = isDeferred ? 0 : Math.min(settings.minijobCap, totalEarningsAvailable);
    const rolloverUnpaidEnd = Math.round((totalEarningsAvailable - payoutThisMonth) * 100) / 100;
    runningUnpaidReserve = rolloverUnpaidEnd; // Carry forward to next month

    // Calculate future payout schedule from the rollover balance if 0 future hours worked
    const futurePayoutProjections = [];
    let tempReserve = rolloverUnpaidEnd;
    const [currYear, currMonth] = monthKey.split('-').map(Number);
    let stepMonthOffset = 1;

    while (tempReserve > 0 && stepMonthOffset <= 6) {
      const projDate = new Date(currYear, currMonth - 1 + stepMonthOffset, 1);
      const projKey = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`;
      const projMonthNum = projDate.getMonth() + 1;
      const projYearStr = String(projDate.getFullYear()).slice(-2);
      const projLabel = `${String(projMonthNum).padStart(2, '0')}/${projYearStr}`;
      const projAmount = Math.min(settings.minijobCap, tempReserve);

      futurePayoutProjections.push({
        monthKey: projKey,
        monthLabel: projLabel,
        payoutAmount: Math.round(projAmount * 100) / 100,
      });

      tempReserve = Math.round((tempReserve - projAmount) * 100) / 100;
      stepMonthOffset++;
    }

    // Format human readable label (e.g. "2026-08" -> "08/26")
    const [year, monthNum] = monthKey.split('-').map(Number);
    const monthLabel = `${String(monthNum).padStart(2, '0')}/${String(year).slice(-2)}`;

    summaries.push({
      monthKey,
      monthLabel,
      entryCount: monthEntries.length,
      totalNetHours: roundedNetHours,
      grossEarnings,
      fixedCostDeducted,
      netEarnings,
      minijobCap: settings.minijobCap,
      monthlyHourLimit: Math.round(monthlyHourLimit * 100) / 100,
      monthRatio: Math.round(monthRatio * 100) / 100,
      monthsInAdvance,
      cumulativeBufferMonths,
      payoutThisMonth: Math.round(payoutThisMonth * 100) / 100,
      rolloverUnpaidEnd,
      futurePayoutProjections,
    });
  }

  return summaries;
}

/**
 * Calculates active working days between start date and end date (inclusive),
 * deducting specified days off per week (0 to 3 days off per week).
 */
export function calculateActiveWorkdays(
  startDateStr: string,
  endDateStr: string,
  daysOffPerWeek: number
): number {
  if (!startDateStr || !endDateStr) return 1;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return 1;
  }

  let activeDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    let isDayOff = false;

    if (daysOffPerWeek === 1) {
      if (dayOfWeek === 0) isDayOff = true; // Sunday
    } else if (daysOffPerWeek === 2) {
      if (dayOfWeek === 0 || dayOfWeek === 6) isDayOff = true; // Sat, Sun
    } else if (daysOffPerWeek >= 3) {
      if (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5) isDayOff = true; // Fri, Sat, Sun
    }

    if (!isDayOff) {
      activeDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return Math.max(1, activeDays);
}

/**
 * Default initial settings
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  hourlyWage: 16.0,
  currency: '€',
  minijobCap: 538.0,
  fixedCosts: [
    {
      id: 'default-fc-1',
      title: 'Monthly Workspace & Software Pass',
      amount: 40.0,
      type: 'monthly',
      appliesToMonth: 'ALL',
    },
  ],
};

/**
 * Initial sample seed entries for quick visual preview
 */
export const SAMPLE_WORK_ENTRIES: WorkEntry[] = [
  {
    id: 'sample-1',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString().split('T')[0],
    startTime: '08:30',
    endTime: '17:00',
    pauseMinutes: 45,
    grossHours: 8.5,
    netHours: 7.75,
    notes: 'Website UI redesign implementation & component architecture',
    isPlanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '18:00',
    pauseMinutes: 60,
    grossHours: 9.0,
    netHours: 8.0,
    notes: 'Backend API integration and database testing',
    isPlanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '16:30',
    pauseMinutes: 30,
    grossHours: 8.5,
    netHours: 8.0,
    notes: 'Client consultation, project review, and sprint planning',
    isPlanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-4',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '19:00',
    pauseMinutes: 60,
    grossHours: 9.0,
    netHours: 8.0,
    notes: 'Performance optimization and automated testing setup',
    isPlanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-5',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '14:30',
    pauseMinutes: 30,
    grossHours: 6.5,
    netHours: 6.0,
    notes: 'Bug fixes, documentation update, and feature deployment',
    isPlanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-future-1',
    date: '2026-09-05',
    startTime: '08:00',
    endTime: '20:00',
    pauseMinutes: 0,
    grossHours: 24.0,
    netHours: 24.0,
    notes: 'Food Truck Festival (Weekend Shift)',
    isPlanned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
