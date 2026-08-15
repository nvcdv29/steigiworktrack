import React, { useEffect } from 'react';
import { X, Calculator, Sparkles } from 'lucide-react';
import { UserSettings } from '../types';

interface CalculusGuideModalProps {
  settings: UserSettings;
  onClose: () => void;
}

export const CalculusGuideModal: React.FC<CalculusGuideModalProps> = ({
  settings,
  onClose,
}) => {
  const wage = settings.hourlyWage || 16.0;
  const cap = settings.minijobCap || 538.0;
  const limitHours = wage > 0 ? cap / wage : 0;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-5 text-slate-900 shadow-xl space-y-4 my-auto animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Calculator className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Minijob Month Advance Calculus Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-1">
            <div className="flex items-center space-x-1.5 text-indigo-900 font-bold text-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Core Concept & Formula</span>
            </div>
            <p className="text-slate-700 text-xs">
              Under Minijob regulations, there is a target earnings cap per month (e.g.{' '}
              <strong className="text-indigo-950 font-bold">{settings.currency}{cap.toFixed(2)}</strong>). When you
              work significantly more hours in a busy month, you build up an{' '}
              <strong className="text-emerald-800 font-bold">Income Buffer</strong> that covers future months
              in advance!
            </p>
          </div>

          {/* Step by Step Walkthrough */}
          <div className="space-y-2.5 pt-1">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              How the Advance Buffer is Calculated:
            </h3>

            <div className="space-y-2">
              {/* Step 1 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-bold text-slate-900">Monthly Hour Target Limit</p>
                  <p className="text-slate-600 font-semibold text-[11px] mt-0.5">
                    Target Hours = Minijob Cap ({settings.currency}{cap}) ÷ Hourly Wage ({settings.currency}{wage}/h)
                  </p>
                  <p className="text-indigo-700 font-bold mt-1">
                    = {limitHours.toFixed(2)} worked hours per month target
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-bold text-slate-900">Month Income Ratio</p>
                  <p className="text-slate-600 font-semibold text-[11px] mt-0.5">
                    Ratio = Gross Earnings this month ÷ Minijob Cap
                  </p>
                  <p className="text-slate-600 mt-1">
                    Example: If you work <strong>{(limitHours * 3).toFixed(1)} hours</strong> in 1 month, you earn{' '}
                    <strong>{settings.currency}{(cap * 3).toFixed(2)}</strong>. Ratio = 3.0×
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3">
                <span className="h-4 w-4 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-bold text-slate-900">Months Worked in Advance</p>
                  <p className="text-slate-600 font-semibold text-[11px] mt-0.5">
                    Advance Months = Month Ratio - 1.0 (Current Month)
                  </p>
                  <p className="text-emerald-700 font-bold mt-1">
                    3.0 Ratio - 1.0 = +2.0 Months Worked in Advance!
                  </p>
                  <p className="text-slate-600 mt-0.5 text-[11px]">
                    This means you have banked 2 full months of income/hours in advance, allowing you
                    to work 0 hours for the next 2 months while maintaining your average cap target!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
          >
            Got it, return to app
          </button>
        </div>
      </div>
    </div>
  );
};

