export interface WorkEntry {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  pauseMinutes: number; // minutes
  grossHours: number; // (endTime - startTime) in hours
  netHours: number; // grossHours - (pauseMinutes / 60)
  notes: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type FixedCostType = 'monthly' | 'weekly' | 'per_entry' | 'one_time';

export interface FixedCostDeduction {
  id: string;
  title: string;
  amount: number;
  type: FixedCostType;
  appliesToMonth?: string; // YYYY-MM (e.g. "2026-08") or empty/"ALL" for recurring
}

export interface UserSettings {
  hourlyWage: number; // e.g. 16.00
  currency: string; // Fixed to '€'
  minijobCap: number; // e.g. 538.00 per month
  fixedCosts: FixedCostDeduction[];
  deferredMonths?: string[]; // Array of YYYY-MM strings indicating months where payout is deferred entirely
}

export interface PayoutProjection {
  monthKey: string;
  monthLabel: string;
  payoutAmount: number;
}

export interface MonthSummary {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "August 2026"
  entryCount: number;
  totalNetHours: number;
  grossEarnings: number;
  fixedCostDeducted: number;
  netEarnings: number;
  minijobCap: number;
  monthlyHourLimit: number;
  monthRatio: number; // grossEarnings / minijobCap
  monthsInAdvance: number;
  cumulativeBufferMonths: number;
  // Payout Forecast & Rollover Reserve
  payoutThisMonth: number; // Max €538 payout
  rolloverUnpaidEnd: number; // Unpaid extra earnings held in reserve
  futurePayoutProjections: PayoutProjection[]; // Projection of future payouts from reserve
}
