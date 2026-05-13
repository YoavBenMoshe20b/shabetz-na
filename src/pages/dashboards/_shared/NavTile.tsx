// NavTile — premium destination row used in CC management section.

import { Body, Hint } from '../../../components/ui';

export type NavTileIcon =
  | 'missions' | 'coverage' | 'delegate'
  | 'report1' | 'announcements' | 'leaveCycle' | 'rasap';

interface NavTileProps {
  label: string;
  hint: string;
  onClick: () => void;
  icon: NavTileIcon;
}

const STROKE = 1.6;

const GLYPHS: Record<NavTileIcon, React.ReactNode> = {
  missions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  coverage: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L4 6.5 V13 c0 4.5 3.5 7 8 8 4.5-1 8-3.5 8-8 V6.5 Z" />
    </svg>
  ),
  delegate: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6 c2-2 5-2 7 0 s2 5 0 7 l-2 2" />
      <path d="M15 18 c-2 2-5 2-7 0 s-2-5 0-7 l2-2" />
    </svg>
  ),
  report1: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  announcements: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 L18 4 V18 L4 13 Z" />
      <path d="M7 17 c0 2 1.5 3 3.5 3" />
    </svg>
  ),
  leaveCycle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 a9 9 0 0 1 17-4" />
      <path d="M20 4 v5 h-5" />
      <path d="M21 12 a9 9 0 0 1-17 4" />
      <path d="M4 20 v-5 h5" />
    </svg>
  ),
  rasap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
    </svg>
  ),
};

export function NavTile({ label, hint, onClick, icon }: NavTileProps) {
  return (
    <button
      onClick={onClick}
      className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-5 py-4 flex items-center gap-3.5 text-right"
    >
      <span className="w-9 h-9 rounded-xl-soft bg-mil-olive-bg text-mil-olive flex items-center justify-center flex-shrink-0">
        {GLYPHS[icon]}
      </span>
      <div className="flex-1 min-w-0">
        <Body className="font-semibold leading-tight">{label}</Body>
        <Hint className="block mt-0.5 text-mil-muted">{hint}</Hint>
      </div>
      <span className="text-mil-ghost">←</span>
    </button>
  );
}
