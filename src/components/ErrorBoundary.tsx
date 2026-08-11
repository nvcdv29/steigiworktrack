import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Application Error</h1>
                <p className="text-xs text-slate-500">An unexpected error occurred while rendering the page.</p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800">
              <p className="font-semibold text-rose-400 mb-1">{this.state.error?.name || 'Error'}</p>
              <p className="whitespace-pre-wrap">{this.state.error?.message || 'Unknown error'}</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                If you are deploying to <strong>Netlify</strong>, ensure your environment variables are named <code className="bg-slate-100 px-1 py-0.5 rounded border text-slate-800 font-mono">VITE_SUPABASE_URL</code> and <code className="bg-slate-100 px-1 py-0.5 rounded border text-slate-800 font-mono">VITE_SUPABASE_ANON_KEY</code>.
              </p>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full inline-flex justify-center items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
