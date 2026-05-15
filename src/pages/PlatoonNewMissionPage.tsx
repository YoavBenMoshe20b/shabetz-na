// PlatoonNewMissionPage — fast mission creation surface for PC / Sgt.
//
// The CC's MissionWizardPage is a 6-step rich-policy form. PC's reality
// is different: most PC-level missions are quick taps — שמירה / חמ״ל /
// סריקות / ניקיונות / סבב מים / משימת לילה / תצפית / כוננות. The PC
// picks a template, fills date + time + manpower + an optional note,
// and submits. Defaults for fatigue / command / rotation / equipment
// come from the template; the PC doesn't see them.
//
// Created missions auto-target the PC's own platoon (`assignedPlatoonIds`).
// Status: 'active-unstaffed' so they show up as needing staff on the
// /platoon/missions board.

import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership, isRasap } from '../utils/permissions';
import Header from '../components/Header';
import type { Mission } from '../types';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, Button, Toast,
} from '../components/ui';

interface Template {
  id: string;
  label: string;
  icon: string;
  description: string;
  defaultDurationHrs: number;
  defaultManpower: number;
  intensity: Mission['fatigue']['intensity'];
  needsCommander: boolean;
}

const TEMPLATES: Template[] = [
  { id: 'guard',       label: 'שמירה',         icon: '👁',  description: 'שמירה בעמדה קבועה',           defaultDurationHrs: 8,  defaultManpower: 2, intensity: 'standing-guard', needsCommander: false },
  { id: 'chamal',      label: 'חמ״ל',          icon: '📻',  description: 'משמרת חמ״ל / קשר',             defaultDurationHrs: 12, defaultManpower: 2, intensity: 'readiness',      needsCommander: false },
  { id: 'patrol',      label: 'סריקות',        icon: '🚶',  description: 'סבב סריקה בגזרה',              defaultDurationHrs: 4,  defaultManpower: 4, intensity: 'active-patrol',  needsCommander: true  },
  { id: 'cleaning',    label: 'ניקיונות',     icon: '🧹',  description: 'ניקיון בסיס / מרחב כיתתי',      defaultDurationHrs: 2,  defaultManpower: 3, intensity: 'admin',          needsCommander: false },
  { id: 'water',       label: 'סבב מים',        icon: '💧',  description: 'מילוי מימיות / חלוקה',        defaultDurationHrs: 1,  defaultManpower: 2, intensity: 'admin',          needsCommander: false },
  { id: 'night',       label: 'משימת לילה',     icon: '🌙',  description: 'משימה לילית מבצעית',           defaultDurationHrs: 6,  defaultManpower: 4, intensity: 'ambush',         needsCommander: true  },
  { id: 'observation', label: 'תצפית',          icon: '🔭',  description: 'תצפית קבועה',                  defaultDurationHrs: 6,  defaultManpower: 2, intensity: 'standing-guard', needsCommander: false },
  { id: 'readiness',   label: 'כוננות',          icon: '🛡',  description: 'כוננות תגובה',                 defaultDurationHrs: 12, defaultManpower: 4, intensity: 'readiness',      needsCommander: true  },
];

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextHourTime(hoursAhead = 1): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursAhead, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addHoursTime(hh: string, hrs: number): string {
  const [h, m] = hh.split(':').map(Number);
  const total = h * 60 + m + hrs * 60;
  const eH = Math.floor(total / 60) % 24;
  const eM = total % 60;
  return `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
}

export default function PlatoonNewMissionPage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, platoons, addMission,
  } = useApp();

  const myPlatoon = useMemo(
    () =>
      platoons.find((p) => p.id === currentUser?.commandedPlatoonId)
      ?? platoons.find((p) => p.memberIds.includes(currentUser?.id ?? '')),
    [platoons, currentUser],
  );

  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const [name, setName] = useState<string>('');
  const [date, setDate] = useState<string>(todayDateString());
  const [startTime, setStartTime] = useState<string>(nextHourTime(1));
  const [endTime, setEndTime] = useState<string>(addHoursTime(nextHourTime(1), template.defaultDurationHrs));
  const [manpower, setManpower] = useState<number>(template.defaultManpower);
  const [description, setDescription] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  // Re-derive defaults when the template changes (unless the user has
  // typed their own values).
  const handleTemplateChange = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
    setTemplateId(id);
    setManpower(t.defaultManpower);
    setEndTime(addHoursTime(startTime, t.defaultDurationHrs));
  };

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isPlatoonLeadership(currentRole) && !(currentUser && isRasap(currentUser))) {
    return <Navigate to="/home" replace />;
  }
  if (!myPlatoon) {
    return (
      <div className="min-h-screen bg-mil-bg" dir="rtl">
        <Header title="משימה חדשה" />
        <PageMain>
          <PageTitle>אין מחלקה משויכת</PageTitle>
        </PageMain>
      </div>
    );
  }

  const canSubmit =
    !!template
    && !!date
    && !!startTime
    && !!endTime
    && manpower >= 1;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const missionName = (name.trim() || template.label).slice(0, 80);
    const data: Omit<Mission, 'id' | 'createdAt'> = {
      companyId: myPlatoon.companyId,
      name: missionName,
      description: description.trim() || `${template.label} · ${myPlatoon.name}`,
      createdByUserId: currentUser.id,
      ownerRole: 'platoon',
      assignedPlatoonIds: [myPlatoon.id],
      timeModel: {
        kind: 'fixed-hours',
        windows: [{ startTime, endTime, shiftDurationMinutes: 0, recurring: 'every-day' }],
      },
      manpower: { kind: 'exact', count: manpower },
      command: {
        fieldCommandRequired: template.needsCommander,
        commandersPerSlot: template.needsCommander ? 1 : 0,
        commanderCountsAsManpower: template.needsCommander,
        rankPolicy: {
          soldier: 'regular',
          mk: 'regular',
          samal: template.needsCommander ? 'commander-only' : 'regular',
          mam: template.needsCommander ? 'commander-only' : 'excluded',
          officer: 'excluded',
          custom: 'excluded',
        },
      },
      rotation: { kind: 'fixed-platoon', platoonId: myPlatoon.id },
      fatigue: {
        intensity: template.intensity,
        impactsSleep: template.intensity === 'ambush' || template.intensity === 'active-patrol',
        minRestAfterHours: template.intensity === 'ambush' ? 12 : 6,
        fatigueWeight: template.intensity === 'ambush' ? 9 : template.intensity === 'active-patrol' ? 7 : 4,
      },
      overlapPolicy: { activeOverlap: [], restOverlap: ['admin'] },
      qualifications: [],
      equipment: [],
      conflictsWith: [],
      canOverlapWith: [],
      pairings: [],
      squadPolicy: { mode: 'mix' },
      requiresDailyConfirmation: false,
      status: 'active',
      orderId: 'order-current',
    };
    const created = addMission(data);
    setToast(`המשימה "${missionName}" נוצרה`);
    setTimeout(() => {
      navigate(`/mission/${created.id}`);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="משימה חדשה למחלקה" />
      <PageMain>

        <header>
          <Eyebrow>{myPlatoon.name}</Eyebrow>
          <PageTitle className="mt-1">משימה חדשה</PageTitle>
          <Muted className="mt-1 text-tiny leading-relaxed">
            בחר תבנית, מלא זמן וכוח־אדם, וזה ייכנס למשימות המחלקה.
          </Muted>
        </header>

        {toast && <Toast tone="success">{toast}</Toast>}

        {/* Template picker */}
        <Section label="תבנית">
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => {
              const active = t.id === templateId;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTemplateChange(t.id)}
                  className={`text-right p-3 rounded-xl-soft border transition-all ${
                    active
                      ? 'bg-mil-olive-bg border-mil-olive shadow-card'
                      : 'bg-mil-card border-mil-border hover:border-mil-olive'
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <Body className="font-semibold text-sm leading-tight">{t.label}</Body>
                  </div>
                  <Hint className="block mt-1 text-mil-muted leading-snug">{t.description}</Hint>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Override name */}
        <Section label="שם מלא (אופציונלי)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={template.label}
            className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-3 text-base text-mil-text"
          />
        </Section>

        {/* Schedule */}
        <Section label="מועד">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Hint className="block mb-1">תאריך</Hint>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-mil-card border border-mil-border rounded-md px-2 py-2.5 text-sm text-mil-text font-mono tabular-nums"
                dir="ltr"
              />
            </div>
            <div>
              <Hint className="block mb-1">התחלה</Hint>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setEndTime(addHoursTime(e.target.value, template.defaultDurationHrs));
                }}
                className="w-full bg-mil-card border border-mil-border rounded-md px-2 py-2.5 text-sm text-mil-text font-mono tabular-nums"
                dir="ltr"
              />
            </div>
            <div>
              <Hint className="block mb-1">סיום</Hint>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-mil-card border border-mil-border rounded-md px-2 py-2.5 text-sm text-mil-text font-mono tabular-nums"
                dir="ltr"
              />
            </div>
          </div>
        </Section>

        {/* Manpower */}
        <Section label="כוח אדם">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setManpower(Math.max(1, manpower - 1))}
              className="w-10 h-10 rounded-md border border-mil-border bg-mil-card text-mil-text font-bold text-lg"
            >
              −
            </button>
            <span className="text-3xl font-extrabold tabular-nums text-mil-text min-w-[3ch] text-center">{manpower}</span>
            <button
              onClick={() => setManpower(manpower + 1)}
              className="w-10 h-10 rounded-md border border-mil-border bg-mil-card text-mil-text font-bold text-lg"
            >
              +
            </button>
            <Muted className="text-tiny mr-2">
              {template.needsCommander ? 'כולל מפקד' : 'ללא מפקד נדרש'}
            </Muted>
          </div>
        </Section>

        {/* Description */}
        <Section label="הערות מבצעיות (אופציונלי)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="טקסט חופשי — מטרה / דגשים / מיקום"
            className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2.5 text-sm text-mil-text resize-none"
          />
        </Section>

        <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
          צור משימה ←
        </Button>

        <button
          onClick={() => navigate('/platoon/missions')}
          className="w-full text-center text-tiny font-semibold text-mil-muted hover:text-mil-text py-2"
        >
          ביטול ← חזרה למשימות
        </button>
      </PageMain>
    </div>
  );
}
