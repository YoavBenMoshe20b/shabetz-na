// Emergency banner — sticky at the very top of the screen, above all
// other content, when the platoon/company has a live operational issue
// (manpower below minimum, unmanned guard post, high-risk alert open).
//
// Per spec: this is NOT just a card in a feed. The whole screen must
// shift into emergency state — the banner is the visible signal.

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
      className="bg-mil-alert text-white px-4 py-3 sticky top-0 z-40 shadow-md"
      dir="rtl"
    >
      <div className="max-w-xl mx-auto flex items-start gap-3">
        <span className="text-2xl leading-none flex-shrink-0 mt-0.5">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{message}</p>
          {detail && <p className="text-xs text-white/80 mt-0.5 leading-snug">{detail}</p>}
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
          >
            {actionLabel} ←
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}
