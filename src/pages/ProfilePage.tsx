// Profile / personal data — every user has one.
//
// Reachable from the header avatar's "פרופיל ופרטים אישיים" entry. The
// surface is read-mostly: identity at the top, then operational personal
// fields (dominant hand / weapon side / sizes), then qualifications, then
// a link to /equipment.

import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { roleLabel } from '../utils/permissions';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Card,
} from '../components/ui';

export default function ProfilePage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, soldiers, qualifications, soldierQualifications, platoons, squads,
    updateSoldierProfile,
  } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;

  const myProfile = useMemo(
    () => soldiers.find((s) => s.id === currentUser.soldierProfileId || s.userId === currentUser.id),
    [soldiers, currentUser],
  );

  const myPlatoon = useMemo(
    () => platoons.find((p) => p.id === currentUser.platoonId),
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

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="פרופיל" />
      <PageMain>

        {/* Identity hero */}
        <header>
          <Hint className="tracking-widest uppercase">{roleLabel(currentRole)}</Hint>
          <PageTitle className="mt-1">{currentUser.name}</PageTitle>
          <Muted className="mt-1.5">
            {myPlatoon?.name ?? '—'}
            {mySquadName && ` · ${mySquadName}`}
            {age != null && ` · גיל ${age}`}
          </Muted>
        </header>

        {saved && (
          <Card variant="muted" className="!border-mil-success/40 bg-mil-success-bg">
            <div className="px-4 py-3 flex items-center gap-2">
              <span className="text-mil-success font-bold">✓</span>
              <Body className="text-mil-success">נשמר</Body>
            </div>
          </Card>
        )}

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
              className="mt-3 w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              שמור שינויים
            </button>
          )}
        </Section>

        {/* Qualifications */}
        <Section label="כישורים מבצעיים">
          {myQuals.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-tiny text-mil-muted">אין כישורים רשומים</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myQuals.map((q) => (
                <span
                  key={q!.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mil-olive-bg/40 border border-mil-olive/20"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-mil-olive flex-shrink-0" aria-hidden />
                  <span className="text-sm font-semibold text-mil-text">{q!.name}</span>
                  {q!.category && <span className="text-tiny text-mil-muted">· {q!.category}</span>}
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
                <span key={r} className="inline-flex items-center px-3 py-1.5 rounded-full bg-mil-card border border-mil-border text-sm font-semibold text-mil-text">
                  {r}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Equipment shortcut */}
        <button
          onClick={() => navigate('/equipment')}
          className="w-full flex items-center gap-3 px-5 py-4 bg-mil-card border border-mil-border rounded-2xl hover:border-mil-olive transition-colors text-right"
        >
          <div className="flex-1">
            <Body className="font-semibold">ציוד אישי</Body>
            <Hint className="block mt-0.5">נשק · אופטיקה · ווסט · קשר</Hint>
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
      <Body className="font-semibold flex-shrink-0 w-28">{label}</Body>
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
      <Body className="font-semibold flex-shrink-0 w-28">{label}</Body>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              value === o.id ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
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
  'w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-2 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-sm';
