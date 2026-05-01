import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6 z-[9999]">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-slate-100 text-center space-y-8">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-red-100/50">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Application Error</h1>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Something went wrong while rendering the application. This might be due to a network interruption or an unexpected state.
              </p>
              {this.state.error && (
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-[10px] font-mono text-slate-400 break-all text-left max-h-32 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </button>
            </div>

            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Absolute Grid Identity • Error Recovery
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
