// MissionTemplateLibrarySheet — the central "spend less time creating
// missions" surface.
//
// Two views:
//   • LIST  — every saved template, grouped by category, with a
//             favorite-star toggle and use/hide actions.
//   • CREATE — the slim form that opens after picking a template. Asks
//              ONLY name + dates + assignment + (optional) rally
//              override. The rest is inherited verbatim from the
//              template's payload.
//
// Live data comes from AppContext.missionTemplates. The library lives
// alongside other persisted slices; the platoon's repertoire grows as
// missions are saved as templates ("שמור כתבנית").

import { useState } from 'react';
import type {
  Mission, OperationalOrder, Platoon, Qualification, EquipmentItem,
  PlatoonLeaveDay,
} from '../types';
import type { MissionTemplate } from '../utils/missionTemplates';
import {
  buildMissionFromTemplate, reviewTemplateInstantiation,
} from '../utils/missionTemplates';
import { MISSION_ARCHETYPES } from '../utils/missionArchetypes';
import { Sheet, Body, Hint, Muted, Button } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  templates: MissionTemplate[];

  // Reference data for the review pass.
  qualifications: Qualification[];
  equipmentItems: EquipmentItem[];
  platoons: Platoon[];
  platoonLeaveDays: PlatoonLeaveDay[];

  /** Optional default order — when opening from inside an order's
   *  missions section, the new mission is pre-attached. */
  defaultOrder?: OperationalOrder;
  /** Default platoon pre-selection (e.g. PC's own platoon). */
  defaultPlatoonIds?: string[];

  /** Fires with the addMission payload — the parent calls AppContext.
   *  Returns the created mission id so the sheet can route. */
  onCreate: (
    payload: Omit<Mission, 'id' | 'companyId' | 'createdAt' | 'createdByUserId'>,
    fromTemplateId: string,
  ) => string | undefined;

  /** Affords editing the library inline. */
  onToggleFavorite: (id: string) => void;
  onHide: (id: string) => void;
}

type View = 'library' | 'create';

export default function MissionTemplateLibrarySheet({
  open, onClose, templates,
  qualifications, equipmentItems, platoons, platoonLeaveDays,
  defaultOrder, defaultPlatoonIds,
  onCreate, onToggleFavorite, onHide,
}: Props) {
  const [view, setView] = useState<View>('library');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // ── create-form state ─────────────────────────────────────────────
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<string>(defaultOrder?.startDate ?? '');
  const [endDate, setEndDate] = useState<string>(defaultOrder?.endDate ?? '');
  const [platoonIds, setPlatoonIds] = useState<string[]>(defaultPlatoonIds ?? []);
  const [rallyOverride, setRallyOverride] = useState<string>('');

  if (!open) return null;

  const visible = templates.filter((t) => !t.isHidden);
  const categories = Array.from(new Set(visible.map((t) => t.category ?? 'אחר')));

  const filtered = filter === 'all'
    ? visible
    : filter === 'favorites'
      ? visible.filter((t) => t.isFavorite)
      : visible.filter((t) => (t.category ?? 'אחר') === filter);

  // Sort: favorites first, then by usageCount desc, then name.
  const sorted = [...filtered].sort((a, b) => {
    if ((b.isFavorite ? 1 : 0) !== (a.isFavorite ? 1 : 0)) return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.name.localeCompare(b.name, 'he');
  });

  const template = templates.find((t) => t.id === selectedId);

  const pickTemplate = (t: MissionTemplate) => {
    setSelectedId(t.id);
    setName(t.name);
    setStartDate(defaultOrder?.startDate ?? '');
    setEndDate(defaultOrder?.endDate ?? '');
    setPlatoonIds(defaultPlatoonIds ?? []);
    setRallyOverride('');
    setView('create');
  };

  const reviews = template ? reviewTemplateInstantiation({
    template,
    proposedName: name,
    proposedStartDate: startDate || undefined,
    proposedEndDate: endDate || undefined,
    proposedPlatoonIds: platoonIds,
    qualifications,
    equipmentItems,
    platoons,
    platoonLeaveDays,
  }) : [];

  const blockingErrors = reviews.filter((r) => r.severity === 'error');

  const submit = () => {
    if (!template) return;
    const payload = buildMissionFromTemplate({
      template,
      name: name.trim() || template.name,
      assignedPlatoonIds: platoonIds.filter((pid) => platoons.some((p) => p.id === pid)),
      orderId: defaultOrder?.id,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      rallyPointOverride: rallyOverride.trim() || undefined,
    });
    onCreate(payload, template.id);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={view === 'library' ? 'ספריית תבניות' : `תבנית: ${template?.name ?? ''}`}
      subtitle={view === 'library'
        ? `${visible.length} תבניות זמינות`
        : 'מלא רק את מה שמשתנה במופע הזה.'}
      size="lg"
    >
      {view === 'library' ? (
        <div className="px-5 py-5 space-y-4">

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === 'all'}        onClick={() => setFilter('all')}>הכל</FilterChip>
            <FilterChip active={filter === 'favorites'}  onClick={() => setFilter('favorites')}>★ מועדפים</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</FilterChip>
            ))}
          </div>

          {/* List */}
          {sorted.length === 0 ? (
            <Muted className="text-center py-8">אין תבניות בקטגוריה זו.</Muted>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {sorted.map((t) => (
                <li key={t.id}>
                  <TemplateRow
                    template={t}
                    onPick={() => pickTemplate(t)}
                    onToggleFavorite={() => onToggleFavorite(t.id)}
                    onHide={() => onHide(t.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          <Muted className="text-tiny leading-snug pt-2 border-t border-mil-border">
            כל משימה קיימת ניתנת לשמור כתבנית מתוך עמוד המשימה (״שמור כתבנית״). הספרייה גדלה לאט-לאט עם השימוש.
          </Muted>
        </div>
      ) : template ? (
        <div className="px-5 py-5 space-y-5">

          {/* Inherited summary — what the template gives us */}
          <div className="bg-mil-olive-bg/50 border border-mil-olive/30 rounded-xl-soft px-4 py-3">
            <Hint className="block tracking-wide mb-1">נורש מתבנית</Hint>
            <Body className="text-tiny leading-snug">
              {MISSION_ARCHETYPES[template.payload.archetypeKind].icon} {MISSION_ARCHETYPES[template.payload.archetypeKind].label}
              {template.payload.rallyPoint && ` · ${template.payload.rallyPoint}`}
            </Body>
            <Muted className="mt-1 text-tiny leading-snug">
              מודל זמן, מצבה, פיקוד, רוטציה, עייפות, חפיפות, ציוד וכישורים — כולם מוגדרים מהתבנית.
              שנה רק את מה שצריך לשנות.
            </Muted>
          </div>

          {/* Variable fields */}
          <div className="space-y-3">
            <Field label="שם המשימה">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={template.name}
                className={inputCls}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="התחלה">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="סיום">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="מחלקות מאיישות">
              <div className="flex flex-wrap gap-1.5">
                {platoons.map((p) => {
                  const on = platoonIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlatoonIds((prev) =>
                        on ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                      )}
                      className={`px-3 py-1.5 rounded-xl-soft text-tiny font-bold transition-colors ${
                        on
                          ? 'bg-mil-olive text-white'
                          : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            {template.payload.rallyPoint && (
              <Field label="נקודת ריכוז (override אופציונלי)">
                <input
                  type="text"
                  value={rallyOverride}
                  onChange={(e) => setRallyOverride(e.target.value)}
                  placeholder={template.payload.rallyPoint}
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          {/* Review */}
          {reviews.length > 0 && (
            <ul className="space-y-1.5">
              {reviews.map((r, i) => (
                <li
                  key={i}
                  className={`rounded-xl-soft px-3.5 py-2 text-tiny leading-snug border ${
                    r.severity === 'error'
                      ? 'bg-mil-alert-bg border-mil-alert text-mil-alert'
                      : r.severity === 'warn'
                        ? 'bg-mil-warn-bg border-mil-warn text-mil-warn'
                        : 'bg-mil-info-bg border-mil-info-border text-mil-info'
                  }`}
                >
                  <span className="font-bold uppercase tracking-wide ml-1.5">
                    {r.severity === 'error' ? 'בעיה' : r.severity === 'warn' ? 'אזהרה' : 'מידע'}
                  </span>
                  <span className="font-semibold">{r.message}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={blockingErrors.length > 0}
              onClick={submit}
            >
              צור משימה
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setView('library')}>
              חזור לספרייה
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base transition-colors duration-200 ease-out-soft';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Hint className="block mb-1.5 tracking-wide">{label}</Hint>
      {children}
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-tiny font-bold transition-colors ${
        active
          ? 'bg-mil-olive text-white'
          : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
      }`}
    >
      {children}
    </button>
  );
}

function TemplateRow({
  template, onPick, onToggleFavorite, onHide,
}: {
  template: MissionTemplate;
  onPick: () => void;
  onToggleFavorite: () => void;
  onHide: () => void;
}) {
  const arch = MISSION_ARCHETYPES[template.payload.archetypeKind];
  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl flex items-stretch overflow-hidden hover:border-mil-olive transition-colors">
      <button onClick={onPick} className="flex-1 text-right px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base leading-none" aria-hidden>{arch.icon}</span>
          <Body className="font-semibold">{template.name}</Body>
          {template.isFavorite && <span className="text-mil-warn" aria-hidden>★</span>}
        </div>
        {template.description && (
          <Muted className="mt-1 text-tiny leading-snug">{template.description}</Muted>
        )}
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <Hint className="text-tiny">{arch.label}</Hint>
          {template.category && <Hint className="text-tiny">· {template.category}</Hint>}
          {template.usageCount > 0 && (
            <Hint className="text-tiny tabular-nums text-mil-olive-dim">· {template.usageCount} שימושים</Hint>
          )}
        </div>
      </button>
      <div className="flex flex-col border-r border-mil-border">
        <button
          onClick={onToggleFavorite}
          className="px-3 py-2 text-mil-muted hover:text-mil-warn hover:bg-mil-card-hover text-base"
          aria-label="מועדף"
          title="סמן כמועדף"
        >
          {template.isFavorite ? '★' : '☆'}
        </button>
        <button
          onClick={onHide}
          className="px-3 py-2 text-mil-muted hover:text-mil-alert hover:bg-mil-card-hover text-base"
          aria-label="הסתר תבנית"
          title="הסתר"
        >
          ×
        </button>
      </div>
    </div>
  );
}
