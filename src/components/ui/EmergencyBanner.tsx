// Emergency banner — sticky at the very top of the screen when there
// is a live operational issue (manpower below minimum, unmanned post).
//
// Premium light: a calm coral-tinted strip with a pulsing indicator and
// confident hierarchy. The urgency reads from the indicator + the message
// weight, not from screaming saturation.

import type { ReactNode } from 'react';

interface EmergencyBannerProps {
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
}

export function EmergencyBanner({ message, detail, actionLabel, onAction, trailing }: EmergencyBannerProps) {
  return (
    <div
      role="alert"
      className="bg-mil-alert-bg/95 backdrop-blur-glass border-b border-mil-alert-border px-5 py-3 sticky top-0 z-40 shadow-sticky"
      dir="rtl"
    >
      <div className="max-w-xl mx-auto flex items-start gap-3">
        {/* Pulsing indicator — live signal */}
        <span className="flex-shrink-0 mt-1 relative">
          <span className="w-2 h-2 rounded-full bg-mil-alert block" />
          <span className="absolute inset-0 w-2 h-2 rounded-full bg-mil-alert animate-ping opacity-60" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-mil-text leading-snug">{message}</p>
          {detail && <p className="text-tiny text-mil-muted mt-0.5 leading-snug">{detail}</p>}
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-tiny font-semibold bg-mil-alert text-white hover:brightness-110 px-3 py-1.5 rounded-lg flex-shrink-0 transition-all duration-200 ease-out-soft shadow-card"
          >
            {actionLabel} ←
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}
