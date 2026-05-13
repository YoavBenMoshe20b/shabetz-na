// Emergency banner — sticky at the very top of the screen, above all
// other content, when the platoon/company has a live operational issue
// (manpower below minimum, unmanned guard post, high-risk alert open).
//
// Premium operational tone: the banner is a calm rose-tinted strip with
// a clear status indicator, not a screaming red bar. Urgency reads from
// the indicator + the message hierarchy, not from saturation alone.

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
      className="bg-mil-alert-bg/95 backdrop-blur-glass border-b border-mil-alert-border text-mil-text px-5 py-3 sticky top-0 z-40 shadow-card"
      dir="rtl"
    >
      <div className="max-w-xl mx-auto flex items-start gap-3">
        {/* Pulsing indicator: live signal, not decoration */}
        <span className="flex-shrink-0 mt-1 relative">
          <span className="w-2 h-2 rounded-full bg-mil-alert block" />
          <span className="absolute inset-0 w-2 h-2 rounded-full bg-mil-alert animate-ping opacity-60" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-mil-text">{message}</p>
          {detail && <p className="text-tiny text-mil-muted mt-0.5 leading-snug">{detail}</p>}
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-tiny font-bold bg-mil-alert text-white hover:bg-mil-alert/85 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors duration-200 ease-out-soft"
          >
            {actionLabel} ←
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}
