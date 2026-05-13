// PersonalActionsFab — universal personal-capability launcher.
//
// Visible to EVERY role. Opens a sheet with the personal actions every
// human in the system can do for themselves:
//
//   • הגש בקשת יציאה   — leave request to the proper approver per chain
//   • עדכן סטטוס אישי   — soldier-self status update (in-base / home / inactive)
//   • דווח בלאי         — equipment damage report on items signed to self
//   • פרופיל וציוד     — quick links to /profile and /equipment
//
// The principle: a commander is FIRST a person in the system, THEN a
// commander. Their personal toolbox is always one tap away regardless
// of their role-level dashboard.
//
// Visibility logic: rendered globally on every dashboard. Sheet content
// adapts:
//   • CC: no leave-request entry (CC self-approves; updates own status manually)
//   • Everyone else: full set

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sheet, Body, Hint } from './ui';
import LeaveRequestForm from './LeaveRequestForm';
import StatusUpdateInline from './StatusUpdateInline';
import DamageReportSheet from './DamageReportSheet';

type SubSheet = null | 'leave' | 'status' | 'damage';

export default function PersonalActionsFab() {
  const navigate = useNavigate();
  const { currentUser, currentRole, soldiers, addLeaveRequest, updateSoldierStatus, signedEquipment } = useApp();
  const [hubOpen,  setHubOpen]  = useState(false);
  const [subSheet, setSubSheet] = useState<SubSheet>(null);

  if (!currentUser) return null;

  const myProfile = soldiers.find((s) => s.id === currentUser.soldierProfileId || s.userId === currentUser.id);
  const mySignedItems = myProfile ? signedEquipment.filter((s) => s.soldierId === myProfile.id && s.status === 'active') : [];
  // Only the pure CC self-approves. Deputy CC must still submit a request
  // (which routes to CC). Owner is treated like CC.
  const isCC = currentRole === 'companyCommander' || currentRole === 'owner';

  const openSub = (k: SubSheet) => { setSubSheet(k); setHubOpen(false); };

  return (
    <>
      {/* The FAB itself — bottom-left for RTL, above bottom nav */}
      <button
        onClick={() => setHubOpen(true)}
        className="fixed bottom-24 left-5 z-20 bg-mil-olive hover:bg-mil-olive-light active:bg-mil-olive-dim text-white font-semibold w-14 h-14 rounded-full shadow-pop flex items-center justify-center transition-all duration-200 ease-out-soft active:scale-95 hover:shadow-hero"
        aria-label="פעולות אישיות"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20 c0-4 3-6 7-6 s7 2 7 6" />
        </svg>
      </button>

      {/* Hub sheet — list of personal actions */}
      {hubOpen && (
        <Sheet open onClose={() => setHubOpen(false)} title="פעולות אישיות" subtitle={currentUser.name}>
          <div className="px-5 py-5 space-y-2">

            {!isCC && (
              <PersonalRow
                title="בקשת יציאה"
                hint="בקשה לאישור לפי שרשרת הפיקוד"
                icon="plane"
                onClick={() => openSub('leave')}
              />
            )}

            <PersonalRow
              title="עדכון סטטוס אישי"
              hint="יצאתי הביתה / חזרתי לבסיס / לא פעיל"
              icon="status"
              onClick={() => openSub('status')}
            />

            <PersonalRow
              title="דיווח בלאי / חוסר ציוד"
              hint={mySignedItems.length > 0 ? `יש לך ${mySignedItems.length} פריטים חתומים` : 'דיווח חופשי'}
              icon="damage"
              onClick={() => openSub('damage')}
            />

            <hr className="border-mil-border my-2" />

            <PersonalRow
              title="פרופיל אישי"
              hint="פרטים אישיים, מידות, כשירויות"
              icon="user"
              onClick={() => { setHubOpen(false); navigate('/profile'); }}
            />
            <PersonalRow
              title="ציוד אישי"
              hint="רשימת הציוד החתום עליי"
              icon="bag"
              onClick={() => { setHubOpen(false); navigate('/equipment'); }}
            />

            {isCC && (
              <div className="mt-3 bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-3.5 py-2.5">
                <Body className="text-tiny text-mil-info leading-relaxed">
                  כמ״פ — לעדכון סטטוסים של חיילים אחרים, השתמש בפרופיל החייל ולחץ "עדכן ידנית".
                </Body>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* Sub-sheets */}
      {subSheet === 'leave' && myProfile && (
        <Sheet open onClose={() => setSubSheet(null)} title="בקשת יציאה" subtitle="הבקשה תועבר לאישור">
          <div className="px-5 py-5">
            <LeaveRequestForm
              onCancel={() => setSubSheet(null)}
              onSubmit={(data) => {
                addLeaveRequest({
                  soldierId:         myProfile.id,
                  soldierName:       myProfile.name,
                  soldierTeamClass:  myProfile.teamClass,
                  soldierSquadId:    myProfile.squadId,
                  ...data,
                });
                setSubSheet(null);
              }}
            />
          </div>
        </Sheet>
      )}

      {subSheet === 'status' && myProfile && (
        <Sheet open onClose={() => setSubSheet(null)} title="עדכון סטטוס" subtitle={myProfile.name}>
          <div className="px-5 py-5">
            <StatusUpdateInline
              soldier={myProfile}
              onCancel={() => setSubSheet(null)}
              onSubmit={(next, expectedUntil) => {
                updateSoldierStatus({ soldierId: myProfile.id, next, expectedUntil });
                setSubSheet(null);
              }}
            />
          </div>
        </Sheet>
      )}

      {subSheet === 'damage' && (
        <DamageReportSheet
          open
          onClose={() => setSubSheet(null)}
          reportedBySoldierId={myProfile?.id}
        />
      )}
    </>
  );
}

// ─── Hub row ─────────────────────────────────────────────────────────────

function PersonalRow({
  title, hint, icon, onClick,
}: {
  title: string;
  hint: string;
  icon: 'plane' | 'status' | 'damage' | 'user' | 'bag';
  onClick: () => void;
}) {
  const STROKE = 1.6;
  const GLYPHS: Record<typeof icon, React.ReactNode> = {
    plane: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12 l18-7 l-7 18 l-3-8 l-8-3 z" />
      </svg>
    ),
    status: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7 v5 l4 2" />
      </svg>
    ),
    damage: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 L22 20 H2 Z" />
        <path d="M12 10 v4" />
        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
      </svg>
    ),
    user: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20 c0-4 4-7 8-7 s8 3 8 7" />
      </svg>
    ),
    bag: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
      </svg>
    ),
  };
  return (
    <button
      onClick={onClick}
      className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-4 py-3.5 flex items-center gap-3.5"
    >
      <span className="w-9 h-9 rounded-xl-soft bg-mil-olive-bg text-mil-olive flex items-center justify-center flex-shrink-0">
        {GLYPHS[icon]}
      </span>
      <div className="flex-1 min-w-0">
        <Body className="font-semibold leading-tight">{title}</Body>
        <Hint className="block mt-0.5 text-mil-muted text-tiny">{hint}</Hint>
      </div>
      <span className="text-mil-ghost">←</span>
    </button>
  );
}
