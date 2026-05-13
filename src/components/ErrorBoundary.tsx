// ErrorBoundary — application-root render-error catcher.
//
// Mounted ABOVE the router so any render exception in any page surfaces
// as a calm recovery screen instead of a blank app. The boundary
// captures only render errors — async failures + handler errors are
// reported in-place by the offending component.
//
// Recovery strategy:
//   • offer "חזור הביתה" — navigates to /home + resets the boundary
//   • offer "טען מחדש" — full window reload
//   • show the error message to the operator (not stack) for triage
//
// Backend portability: when telemetry lands (Sentry / DataDog / OTel),
// `componentDidCatch` is the one place to wire reportError(error, info).

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Single place to wire production telemetry when the time comes.
    // Intentionally console-only today.
    console.error('[ErrorBoundary]', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (typeof window !== 'undefined') {
      window.location.assign('/home');
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-mil-bg flex items-center justify-center px-5 py-10" dir="rtl">
        <div className="max-w-md w-full bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2 h-2 rounded-full bg-mil-alert" aria-hidden />
            <p className="text-xxs font-semibold tracking-wide uppercase text-mil-alert">שגיאה מערכתית</p>
          </div>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish leading-tight">
            משהו נכשל בטעינת המסך
          </h1>
          <p className="mt-3 text-sm text-mil-muted leading-relaxed">
            התקלה נרשמה ביומן המערכת. נסה לטעון מחדש או לחזור הביתה.
          </p>
          {this.state.error?.message && (
            <pre className="mt-4 text-xxs font-mono text-mil-muted bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3 overflow-x-auto leading-snug whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={this.handleReset}
              className="w-full bg-mil-olive text-white font-semibold py-3 rounded-xl-soft shadow-card hover:shadow-card-hover transition-all duration-200 ease-out-soft"
            >
              חזור הביתה
            </button>
            <button
              onClick={this.handleReload}
              className="w-full bg-mil-card border border-mil-border text-mil-text font-semibold py-3 rounded-xl-soft hover:bg-mil-card-hover transition-all duration-200 ease-out-soft"
            >
              טען מחדש
            </button>
          </div>
        </div>
      </div>
    );
  }
}
