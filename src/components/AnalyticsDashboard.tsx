import React, { useState } from 'react';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';
import {
  DollarSign,
  Clock,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { UserSettings, MonthSummary } from '../types';

interface AnalyticsDashboardProps {
  settings: UserSettings;
  monthlySummaries: MonthSummary[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  settings,
  monthlySummaries,
}) => {
  const [activeTab, setActiveTab] = useState<'earnings' | 'hours'>('earnings');

  // Prepare recharts data
  const chartData = monthlySummaries.map((m) => {
    const hourCap = m.monthlyHourLimit || (settings.hourlyWage > 0 ? settings.minijobCap / settings.hourlyWage : 0);
    const utilization = hourCap > 0 ? (m.totalNetHours / hourCap) * 100 : 0;
    const isOverCap = m.totalNetHours > hourCap && hourCap > 0;

    return {
      month: m.monthLabel, // e.g. "08/26"
      fullLabel: m.monthLabel,
      Gross: m.grossEarnings,
      FixedCost: m.fixedCostDeducted,
      Net: m.netEarnings,
      Cap: m.minijobCap,
      Hours: m.totalNetHours,
      HoursCap: Number(hourCap.toFixed(2)),
      Utilization: Number(utilization.toFixed(1)),
      IsOverCap: isOverCap,
    };
  });

  // Calculate overall capacity metrics
  const totalWorkedHours = monthlySummaries.reduce((sum, m) => sum + m.totalNetHours, 0);
  const avgMonthlyHours = monthlySummaries.length > 0 ? totalWorkedHours / monthlySummaries.length : 0;
  const standardHourCap = settings.hourlyWage > 0 ? settings.minijobCap / settings.hourlyWage : 0;
  const avgUtilization = standardHourCap > 0 ? Math.min(200, (avgMonthlyHours / standardHourCap) * 100) : 0;

  return (
    <div className="space-y-3.5">
      {/* Main Interactive Recharts Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 text-slate-900 shadow-xs space-y-3">
        {/* Chart View Header & Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Monthly Visual Overview</h3>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('earnings')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                activeTab === 'earnings'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>Earnings &amp; Costs</span>
            </button>
            <button
              onClick={() => setActiveTab('hours')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                activeTab === 'hours'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Hours vs. Cap</span>
            </button>
          </div>
        </div>

        {/* Chart Content Area */}
        {monthlySummaries.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
            <Layers className="h-8 w-8 text-slate-300" />
            <p>No work entries logged yet to render visual trends.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-56 sm:h-64 w-full pt-2">
              {activeTab === 'earnings' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        borderRadius: '8px',
                        color: '#0f172a',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: any) => [`${Number(value).toFixed(2)} ${settings.currency}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="Gross" 
                      stroke="#4f46e5" 
                      fillOpacity={1} 
                      fill="url(#colorGross)" 
                      name="Gross Earnings" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Net" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorNet)" 
                      name="Net Earnings" 
                    />
                    <Bar dataKey="FixedCost" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Fixed Costs" barSize={20} />
                    <Line
                      type="stepAfter"
                      dataKey="Cap"
                      stroke="#d97706"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name={`Minijob Cap (${settings.minijobCap} ${settings.currency})`}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} unit="h" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        borderRadius: '8px',
                        color: '#0f172a',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: any, name: any, item: any) => {
                        if (name === 'Worked Hours') {
                          return [`${Number(value).toFixed(2)} hrs (${item.payload.Utilization}% of cap)`, 'Worked Hours'];
                        }
                        return [`${Number(value).toFixed(2)} hrs`, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Hours" fill="#6366f1" radius={[4, 4, 0, 0]} name="Worked Hours" barSize={24} />
                    <Line
                      type="stepAfter"
                      dataKey="HoursCap"
                      stroke="#d97706"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ fill: '#d97706', r: 3 }}
                      name={`Hour Cap (${standardHourCap.toFixed(1)} hrs @ ${settings.hourlyWage.toFixed(2)} ${settings.currency}/h)`}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Hours vs Cap Insights Footer Bar */}
            {activeTab === 'hours' && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-700">Average Worked:</span>
                    <strong className="font-bold text-indigo-700">{avgMonthlyHours.toFixed(1)} hrs/month</strong>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-500">
                    <span>Maximum Cap Allowance:</span>
                    <span className="font-medium">{standardHourCap.toFixed(1)} hrs/month ({settings.minijobCap} {settings.currency} limit)</span>
                  </div>
                </div>

                {/* Utilization Progress Meter */}
                <div className="sm:w-48 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium font-sans">Cap Utilization</span>
                    <strong className={avgUtilization > 100 ? 'text-amber-600' : 'text-slate-700'}>
                      {avgUtilization.toFixed(0)}%
                    </strong>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${
                        avgUtilization > 100 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, avgUtilization)}%` }}
                    />
                    {avgUtilization > 100 && (
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, avgUtilization - 100)}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
