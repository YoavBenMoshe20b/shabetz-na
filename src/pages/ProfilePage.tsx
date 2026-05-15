// Profile / personal data — every user has one.
//
// Reachable from the header avatar's "פרופיל ופרטים אישיים" entry. The
// surface is read-mostly: identity at the top, then operational personal
// fields (dominant hand / weapon side / sizes), then qualifications, then
// a link to /equipment.

import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { resolveMySoldier } from '../utils/resolveSoldier';
import Header from '../components/Header';
import { roleLabel } from '../utils/permissions';
import {
  Eyebrow, Section, PageMain, Body, Muted, Hint, Toast,
} from '../components/ui';
import TourOfDutyCard from '../components/TourOfDutyCard';
import QuietModeToggle from '../components/QuietModeToggle';

export default function ProfilePage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, soldiers, qualifications, soldierQualifications, platoons, squads,
    updateSoldierProfile,
  } = useApp();

  // Hooks first; route gate after.
  const myProfile = useMemo(
    () => resolveMySoldier(soldiers, currentUser),
    [soldiers, currentUser],
  );

  const myPlatoon = useMemo(
    () => currentUser ? platoons.find((p) => p.id === currentUser.platoonId) : undefined,
    [platoons, currentUser],
  );

  const mySquadName = useMemo(() => {
    if (!myProfile) return '';
    return squads.find((s) => s.id === myProfile.squadId)?.name ?? myProfile.teamClass ?? '';
  }, [squads, myProfile]);

  const myQuals = useMemo(() => {
    if (!myProfile) return [];
    return soldierQualifications
      .filter((sq) => sq.soldierId === myProfile.id)
      .map((sq) => qualifications.find((q) => q.id === sq.qualificationId))
      .filter(Boolean);
  }, [soldierQualifications, qualifications, myProfile]);

  // Local edit state — synced from the soldier record.
  const [edit, setEdit] = useState({
    dominantHand: myProfile?.dominantHand ?? '',
    weaponSide:   myProfile?.weaponSide   ?? '',
    shirtSize:    myProfile?.shirtSize    ?? '',
    pantsSize:    myProfile?.pantsSize    ?? '',
    shoeSize:     myProfile?.shoeSize     ?? '',
    dateOfBirth:  myProfile?.dateOfBirth  ?? '',
  });
  const [saved, setSaved] = useState(false);

  const dirty =
    edit.dominantHand !== (myProfile?.dominantHand ?? '') ||
    edit.weaponSide   !== (myProfile?.weaponSide   ?? '') ||
    edit.shirtSize    !== (myProfile?.shirtSize    ?? '') ||
    edit.pantsSize    !== (myProfile?.pantsSize    ?? '') ||
    edit.shoeSize     !== (myProfile?.shoeSize     ?? '') ||
    edit.dateOfBirth  !== (myProfile?.dateOfBirth  ?? '');

  const save = () => {
    if (!myProfile) return;
    updateSoldierProfile({
      soldierId:    myProfile.id,
      dominantHand: (edit.dominantHand || undefined) as 'right' | 'left' | undefined,
      weaponSide:   (edit.weaponSide   || undefined) as 'right' | 'left' | undefined,
      shirtSize:    edit.shirtSize     || undefined,
      pantsSize:    edit.pantsSize     || undefined,
      shoeSize:     edit.shoeSize      || undefined,
      dateOfBirth:  edit.dateOfBirth   || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Compute age from dateOfBirth
  const age = useMemo(() => {
    const dob = edit.dateOfBirth || myProfile?.dateOfBirth;
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
    return years;
  }, [edit.dateOfBirth, myProfile]);

  // Route gate AFTER hooks.
  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="פרופיל" />
      <PageMain>

        {/* Identity hero — premium personal card */}
        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-mil-olive-bg text-mil-olive flex items-center justify-center text-xl font-bold flex-shrink-0">
              {currentUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <Eyebrow>{roleLabel(currentRole)}</Eyebrow>
              <h1 className="text-2xl font-bold text-mil-text tracking-tightish mt-1 leading-tight">{currentUser.name}</h1>
              <Muted className="mt-1.5">
                {myPlatoon?.name ?? '—'}
                {mySquadName && ` · ${mySquadName}`}
                {age != null && ` · גיל ${age}`}
              </Muted>
            </div>
          </div>
        </section>

        {saved && <Toast tone="success">השינויים נשמרו</Toast>}

        {/* Operational personal data */}
        <Section label="פרטים אישיים מבצעיים">
          <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">

            <FieldRow label="תאריך לידה">
              <input
                type="date"
                value={edit.dateOfBirth}
                onChange={(e) => setEdit((s) => ({ ...s, dateOfBirth: e.target.value }))}
                className={inputCls}
              />
            </FieldRow>

            <ChoiceRow
              label="יד דומיננטית"
              value={edit.dominantHand}
              options={[{ id: 'right', label: 'ימין' }, { id: 'left', label: 'שמאל' }]}
              onChange={(v) => setEdit((s) => ({ ...s, dominantHand: v }))}
            />

            <ChoiceRow
              label="צד נשק"
              value={edit.weaponSide}
              options={[{ id: 'right', label: 'ימין' }, { id: 'left', label: 'שמאל' }]}
              onChange={(v) => setEdit((s) => ({ ...s, weaponSide: v }))}
            />

            <FieldRow label="מידת חולצה">
              <input type="text" value={edit.shirtSize} onChange={(e) => setEdit((s) => ({ ...s, shirtSize: e.target.value }))} placeholder="S / M / L / XL" className={inputCls} />
            </FieldRow>

            <FieldRow label="מידת מכנס">
              <input type="text" value={edit.pantsSize} onChange={(e) => setEdit((s) => ({ ...s, pantsSize: e.target.value }))} placeholder="34" className={inputCls} />
            </FieldRow>

            <FieldRow label="מידת נעל">
              <input type="text" value={edit.shoeSize} onChange={(e) => setEdit((s) => ({ ...s, shoeSize: e.target.value }))} placeholder="43" className={inputCls} />
            </FieldRow>
          </div>

          {dirty && (
            <button
              onClick={save}
              className="mt-3 w-full bg-mil-olive hover:bg-mil-olive-light text-white font-semibold py-3 rounded-xl-soft text-sm transition-all duration-200 ease-out-soft shadow-card hover:shadow-card-hover active:scale-[0.985]"
            >
              שמור שינויים
            </button>
          )}
        </Section>

        {/* Qualifications */}
        <Section label="כישורים מבצעיים">
          {myQuals.length === 0 ? (
            <div className="bg-mil-card border border-mil-border rounded-xl-soft py-8 text-center">
              <p className="text-tiny text-mil-muted">אין כישורים רשומים</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myQuals.map((q) => (
                <span
                  key={q!.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mil-olive-bg border border-mil-olive/20"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-mil-olive flex-shrink-0" aria-hidden />
                  <span className="text-sm font-semibold text-mil-olive">{q!.name}</span>
                  {q!.category && <span className="text-tiny text-mil-olive/70">· {q!.category}</span>}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* Operational roles */}
        {myProfile && myProfile.operationalRoles.length > 0 && (
          <Section label="תפקידים מבצעיים">
            <div className="flex flex-wrap gap-2">
              {myProfile.operationalRoles.map((r) => (
                <span key={r} className="inline-flex items-center px-3 py-1.5 rounded-full bg-mil-card border border-mil-border-strong text-sm font-semibold text-mil-text shadow-card">
                  {r}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Tour of duty (ימי קו) */}
        {myProfile && <TourOfDutyCard soldier={myProfile} />}

        {/* QuietMode — suppress non-critical alerts for a bounded window.
            Critical alerts always break through. */}
        <QuietModeToggle />

        {/* Equipment shortcut */}
        <button
          onClick={() => navigate('/equipment')}
          className="w-full flex items-center gap-3.5 px-5 py-4 bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft text-right"
        >
          <span className="w-9 h-9 rounded-xl-soft bg-mil-olive-bg text-mil-olive flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <Body className="font-semibold leading-tight">ציוד אישי</Body>
            <Hint className="block mt-0.5 text-mil-muted">נשק · אופטיקה · ווסט · קשר</Hint>
          </div>
          <span className="text-mil-ghost">←</span>
        </button>

      </PageMain>
    </div>
  );
}

// ─── Field primitives ─────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <Body className="font-medium flex-shrink-0 w-28 text-mil-muted">{label}</Body>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ChoiceRow({
  label, value, options, onChange,
}: {
  label: string; value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <Body className="font-medium flex-shrink-0 w-28 text-mil-muted">{label}</Body>
      <div className="flex gap-1.5 bg-mil-bg-alt border border-mil-border rounded-lg p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ease-out-soft ${
              value === o.id
                ? 'bg-mil-card text-mil-olive shadow-card'
                : 'text-mil-muted hover:text-mil-text'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-mil-card border border-mil-border rounded-lg px-3 py-2 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-sm transition-all duration-200 ease-out-soft';
