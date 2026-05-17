// CommandMenu — role-aware navigation drawer.
//
// Opens from the hamburger button in <Header />. Slides up from the
// bottom on mobile (via <Sheet />). Lists ONLY navigation routes the
// current user is authorized to reach — no buttons for actions they
// can't perform.
//
// Filtering is intentional: a soldier never sees "ניהול משימות"; a
// Shalish sees דוח 1 + הודעות but not the CC-only mission tools; a
// Rasap sees logistics surfaces but not approval queues.
//
// Personal actions (status, leave request, damage report) live on the
// FAB, not here. The menu is for NAVIGATION. Keeps both surfaces clean.

import { useNavigate } from 'react-router-dom';
import type { MockUser, UserRole } from '../types';
import { isCompanyLeadership, isPlatoonLeadership, isRasap, isShalish } from '../utils/permissions';
import { Body, Hint, Muted } from './ui';

interface CommandMenuProps {
  open: boolean;
  onClose: () => void;
  user: MockUser;
  currentRole: UserRole;
  onLogout: () => void;
}

interface MenuItem {
  label: string;
  hint?: string;
  href: string;
  icon: keyof typeof ICON;
}

const ICON = {
  schedule: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  report: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  megaphone: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l13-5v12L3 13v-2z" />
      <path d="M16 9v6" />
      <path d="M9 14v4a2 2 0 0 0 4 0v-2" />
    </svg>
  ),
  leaves: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9v9h9a9 9 0 1 1-18 0z" />
    </svg>
  ),
  missions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L19 5 V12 C19 17 12 21 12 21 C12 21 5 17 5 12 V5 Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  coverage: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  delegate: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M3 20c0-3 2-5 5-5s5 2 5 5" />
      <path d="M15 13l3 3M21 13l-3 3" />
    </svg>
  ),
  gaps: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L22 20 H2 Z" />
      <path d="M12 9 v5" />
      <circle cx="12" cy="17.5" r="0.5" fill="currentColor" />
    </svg>
  ),
  rasap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </svg>
  ),
  user: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
  bag: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="8" width="14" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
};

// ─── Role-aware item resolution ─────────────────────────────────────────

function buildItems(user: MockUser, role: UserRole): {
  primary: MenuItem[];
  commander: MenuItem[];
  personal: MenuItem[];
} {
  const cc = isCompanyLeadership(role);
  const pc = isPlatoonLeadership(role);
  const rasap = isRasap(user);
  const shalish = isShalish(user);

  // Personal items every signed-in user sees, regardless of role.
  const personal: MenuItem[] = [
    { label: 'פרופיל אישי',  hint: 'פרטים, מידות, כשירויות', href: '/profile',   icon: 'user' },
    { label: 'ציוד אישי',    hint: 'הציוד החתום עליי',        href: '/equipment', icon: 'bag' },
    { label: 'לו״ז',          hint: 'יומן · אירועים · יציאות · משימות', href: '/calendar', icon: 'calendar' },
  ];

  // Operational surfaces — what does the role need to act on?
  const primary: MenuItem[] = [];
  if (pc || cc) {
    primary.push({ label: 'משימות ושבצ״ק', hint: 'יצירה, שיוך ושיבוץ',   href: '/schedule', icon: 'schedule' });
  }
  if (pc || cc || shalish || rasap) {
    primary.push({ label: 'דוח 1',       hint: 'תמונת מצב מבצעית',     href: '/report1',  icon: 'report' });
    primary.push({ label: 'סד״כ ודוחות', hint: 'סד״כ · ציוד · מידות · גילאים', href: '/reports/summary', icon: 'report' });
  }
  if (pc || cc) {
    primary.push({ label: 'התראות',      hint: 'אירועים פתוחים',        href: '/alerts',   icon: 'bell' });
  }
  // Announcements: viewable by everyone (read), editable by CC/PC only.
  // The page itself handles edit gating; we show it broadly so soldiers
  // can review הודעות הפלוגה without hunting.
  primary.push({ label: 'הודעות פלוגתיות', hint: 'מבצעי, לו״ז, שוטפות', href: '/announcements', icon: 'megaphone' });
  if (pc || cc || rasap) {
    primary.push({ label: 'יציאות',      hint: 'יציאות מאושרות + בקשות', href: '/leaves',   icon: 'leaves' });
  }
  if (pc || cc || rasap) {
    primary.push({ label: 'ליקויי ציוד', hint: 'דיווחי חיילים + העברה לרס״פ', href: '/platoon/gaps', icon: 'gaps' });
  }

  // Commander-only writes & oversight surfaces.
  const commander: MenuItem[] = [];
  if (cc) {
    commander.push(
      { label: 'ניהול משימות',     hint: 'הגדרה ועריכת משימות',          href: '/missions',     icon: 'missions' },
      { label: 'יציאות וכיסוי',    hint: 'מי בבית, מי בבסיס, כיסוי',     href: '/coverage',     icon: 'coverage' },
      { label: 'יציאות פלוגתיות',  hint: 'סבב יציאות פלוגתי + הגנת סד״כ', href: '/leave-cycle',  icon: 'leaves' },
    );
  }
  if (cc || pc) {
    commander.push({ label: 'פיקוד זמני', hint: 'הענקת סמכויות לתקופה',  href: '/delegations',  icon: 'delegate' });
  }
  if (rasap || cc) {
    commander.push(
      { label: 'לוגיסטיקה ורס״פ', hint: 'מלאי, החתמות, בלאי',             href: '/rasap',                icon: 'rasap' },
      { label: 'מלאי ציוד',        hint: 'קטלוג, ייבוא, כמויות',          href: '/equipment/inventory',   icon: 'inventory' },
      { label: 'פק״לים',           hint: 'ערכות תפקיד + מכסות פערים',      href: '/pkalim',                icon: 'inventory' },
      { label: 'סבבים לוגיסטיים',  hint: 'מטבח, ניקיון, מכולה, מים',     href: '/rasap/rotations',       icon: 'rasap' },
    );
  }

  return { primary, commander, personal };
}

// ─── Component ───────────────────────────────────────────────────────────

export default function CommandMenu({ open, onClose, user, currentRole, onLogout }: CommandMenuProps) {
  const navigate = useNavigate();
  if (!open) return null;

  const { primary, commander, personal } = buildItems(user, currentRole);
  const go = (href: string) => { onClose(); navigate(href); };

  // Dedicated drawer layout (not via Sheet primitive). Sheet centres
  // its inner card which is right for confirm/edit modals but reads
  // as "broken floating panel" for a menu. Menus belong on the side.
  //
  // Layout: full-viewport overlay + a side panel pinned to the
  // physical right edge (which is the visual end of the page in RTL,
  // matching the hamburger button's position in the header).
  //
  // Mobile (≤ sm): panel takes full width up to 360px so it reads as
  // a full-height side drawer over the page.
  // Tablet+ : panel takes a fixed 360px width.
  // Both: full viewport height (100dvh), internally scrollable.
  return (
    <div
      className="fixed inset-0 z-50 bg-mil-text/40 backdrop-blur-glass animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="תפריט"
      dir="rtl"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(360px, 90vw)' }}
        className="
          fixed top-0 right-0
          h-[100dvh] max-h-[100dvh]
          bg-mil-card border-l border-mil-border shadow-pop
          flex flex-col overflow-hidden
          animate-sheet-in
        "
      >
        {/* Header — sticky so the close × is always reachable. The
            outer container's safe-area is handled by inset env values
            applied INSIDE this aside (not on the overlay) so the panel
            actually fills the screen edge-to-edge. */}
        <header
          className="shrink-0 border-b border-mil-border bg-mil-card/95 backdrop-blur-glass flex items-center gap-3 px-5 py-4"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-mil-text leading-tight truncate tracking-tightish">
              תפריט
            </h2>
            <p className="text-tiny text-mil-muted leading-snug mt-0.5 truncate">
              {user.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-mil-muted hover:text-mil-text hover:bg-mil-bg-alt transition-colors"
            aria-label="סגור תפריט"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3 L11 11 M11 3 L3 11" />
            </svg>
          </button>
        </header>

        {/* Scrollable body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {primary.length > 0 && (
            <Group label="פעולות מרכזיות">
              {primary.map((it) => <Row key={it.href} item={it} onClick={() => go(it.href)} />)}
            </Group>
          )}

          {commander.length > 0 && (
            <Group label="ניהול וסמכויות">
              {commander.map((it) => <Row key={it.href} item={it} onClick={() => go(it.href)} />)}
            </Group>
          )}

          <Group label="אישי">
            {personal.map((it) => <Row key={it.href} item={it} onClick={() => go(it.href)} />)}
          </Group>

          <div className="pt-2 border-t border-mil-border space-y-2">
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="w-full text-right text-tiny font-semibold text-mil-alert hover:bg-mil-alert-bg rounded-lg px-3 py-2.5 transition-colors"
            >
              יציאה מהמערכת
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-sm font-bold text-mil-muted hover:text-mil-text bg-mil-bg-alt hover:bg-mil-card-hover rounded-xl-soft px-3 py-3 transition-colors border border-mil-border"
            >
              סגור תפריט
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── Internal building blocks ────────────────────────────────────────────

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Hint className="block mb-2 text-mil-muted">{label}</Hint>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft hover:shadow-card hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-3.5 py-3 flex items-center gap-3"
    >
      <span className="w-9 h-9 rounded-xl-soft bg-mil-olive-bg text-mil-olive flex items-center justify-center flex-shrink-0">
        {ICON[item.icon]}
      </span>
      <div className="flex-1 min-w-0">
        <Body className="font-semibold leading-tight">{item.label}</Body>
        {item.hint && <Muted className="block mt-0.5 text-tiny truncate">{item.hint}</Muted>}
      </div>
      <span className="text-mil-ghost text-base flex-shrink-0">‹</span>
    </button>
  );
}
