// UserSwitcher — demo-only header chip for hopping between mock users.
//
// The user wants to walk through the CC→PC→Soldier flow in one session
// without re-authenticating. This component reads the mock user list
// (only present in mock mode — Supabase mode has no MockUsers), groups
// them by role, and calls `switchUser(id)` on tap.
//
// Mounted in the Header. Hidden when there's no current user (login
// screen) and when there are zero alt users.

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { roleLabel } from '../utils/permissions';
import { clearAllPersistedState } from '../utils/persistedState';
import type { MockUser, UserRole } from '../types';

const ROLE_ORDER: UserRole[] = [
  'companyCommander',
  'deputyCompanyCommander',
  'platoonCommander',
  'platoonSergeant',
  'soldier',
];

export default function UserSwitcher() {
  const { currentUser, users, switchUser, platoons } = useApp();
  const [open, setOpen] = useState(false);

  if (!currentUser || users.length <= 1) return null;

  // Build a quick lookup: userId → "מחלקה X" label, so a reviewer can
  // immediately see WHICH platoon each PC commands or each soldier
  // belongs to. Without this, every demo session opens with the same
  // question — "which u-number is for which platoon?".
  const platoonLabel = (u: MockUser): string | null => {
    const targetPlatoonId = u.commandedPlatoonId ?? u.platoonId;
    if (!targetPlatoonId) return null;
    return platoons.find((p) => p.id === targetPlatoonId)?.name ?? null;
  };

  // Group by base role, ordered. Soldiers further grouped by
  // functional/operational role for clarity (רס״פ / שליש first).
  const byRole = new Map<UserRole, MockUser[]>();
  for (const u of users) {
    const arr = byRole.get(u.role) ?? [];
    arr.push(u);
    byRole.set(u.role, arr);
  }
  for (const arr of byRole.values()) {
    arr.sort((a, b) => functionalSortKey(a).localeCompare(functionalSortKey(b)));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-tiny bg-mil-card border border-mil-border hover:border-mil-border-strong px-2 py-1 rounded-md transition-all"
        title="החלף משתמש לצורך הדמו"
        aria-label="החלף משתמש"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </svg>
        <span className="font-semibold text-mil-text">החלף</span>
      </button>

      {open && (
        <>
          <button
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
            aria-label="סגור"
          />
          <div
            className="absolute left-0 top-full mt-2 bg-mil-card border border-mil-border rounded-xl-soft shadow-pop p-1.5 min-w-[260px] max-h-[480px] overflow-y-auto z-20 animate-fade-in"
            dir="rtl"
          >
            <div className="px-3 py-1.5">
              <p className="text-xxs font-semibold text-mil-muted tracking-wide uppercase">
                החלפת משתמש · דמו
              </p>
              <p className="text-tiny text-mil-ghost mt-0.5">
                ללא סיסמה. סשן זמני בלבד.
              </p>
            </div>
            <hr className="my-1 border-mil-border" />
            {ROLE_ORDER.map((role) => {
              const group = byRole.get(role) ?? [];
              if (group.length === 0) return null;
              return (
                <div key={role}>
                  <p className="text-xxs font-semibold text-mil-muted tracking-wide uppercase px-3 py-1.5">
                    {roleLabel(role)}
                  </p>
                  {group.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      platoonName={platoonLabel(u)}
                      active={u.id === currentUser.id}
                      onClick={() => {
                        switchUser(u.id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              );
            })}
            <hr className="my-1 border-mil-border" />
            <button
              onClick={() => {
                if (window.confirm('לאפס את כל נתוני הדמו? משימות, שיבוצים, יציאות והערות יחזרו לברירת המחדל.')) {
                  clearAllPersistedState();
                  window.location.reload();
                }
              }}
              className="block w-full text-right text-tiny px-3 py-2 rounded-lg text-mil-alert hover:bg-mil-alert-bg transition-colors"
            >
              איפוס נתוני דמו
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function UserRow({
  user,
  platoonName,
  active,
  onClick,
}: {
  user: MockUser;
  platoonName: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const functional = user.operationalRoles?.[0];
  return (
    <button
      onClick={onClick}
      className={`block w-full text-right text-sm px-3 py-2 rounded-lg transition-colors duration-150 ${
        active
          ? 'bg-mil-olive-bg text-mil-olive font-semibold'
          : 'text-mil-text hover:bg-mil-bg-alt'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-semibold">{user.name}</span>
        {functional && (
          <span className="text-tiny text-mil-muted">· {functional}</span>
        )}
        {platoonName && (
          <span className="text-tiny text-mil-olive font-semibold mr-auto">{platoonName}</span>
        )}
      </div>
    </button>
  );
}

function functionalSortKey(u: MockUser): string {
  // Put functional-role soldiers (רס״פ / שליש / סמ״פ) before regular soldiers.
  const r = u.operationalRoles?.[0] ?? '';
  const priority = ['רס״פ', 'סרס״פ', 'שליש', 'סמ״פ', 'מ״פ', 'מ״מ', 'סמל'].indexOf(r);
  return `${priority === -1 ? 9 : priority}-${u.name}`;
}
