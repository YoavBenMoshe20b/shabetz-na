// MissionTemplateLibrarySheet — operational doctrine library.
//
// The view the PC/CC reaches for when starting a mission. Templates
// are presented as DOCTRINE (grouped by operational family) rather
// than a flat list. The shape:
//
//   ─── Library view ────────────────────────────────────
//   [search] [filter chips: favorites · day/night · recurring · vehicle · readiness]
//
//   ⭐ מועדפים (pinned)
//   ↻ שימוש אחרון (recently used)
//   ▼ 👁 קווי שמירה (3)
//      • שמירה בש״ג         ★
//      • שמירה בעמדה
//   ▼ 🌙 סיורי לילה (1)
//      • סיור לילה          ★
//   ▼ 🛡 כוננויות (2)
//      • כוננות כרמל א       ★
//      • כוננות כרמל ב
//   ...
//
//   ─── Create view (after picking a template) ──────────
//   Inherited summary
//   [name] [start/end] [platoons] [rally override?]
//   Review items
//   "תבניות קשורות" — 4 family-mates / archetype-mates with quick-pick
//   [צור משימה] [חזור לספרייה]
//
// The Create flow still routes to /missions/:id/assign — the conflict
// resolution chain stays intact.

import { useMemo, useState } from 'react';
import type {
  Mission, OperationalOrder, Platoon, Qualification, EquipmentItem,
  PlatoonLeaveDay, MissionArchetypeKind,
} from '../types';
import type { MissionTemplate, TemplateFamily } from '../utils/missionTemplates';
import {
  buildMissionFromTemplate, reviewTemplateInstantiation,
  findRelatedTemplates, applyLibraryFilter, type LibraryFilter,
} from '../utils/missionTemplates';
import { MISSION_ARCHETYPES, MISSION_ARCHETYPE_LIST } from '../utils/missionArchetypes';
import { Sheet, Body, Hint, Muted, Button } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  templates: MissionTemplate[];
  families: TemplateFamily[];

  qualifications: Qualification[];
  equipmentItems: EquipmentItem[];
  platoons: Platoon[];
  platoonLeaveDays: PlatoonLeaveDay[];

  defaultOrder?: OperationalOrder;
  defaultPlatoonIds?: string[];

  onCreate: (
    payload: Omit<Mission, 'id' | 'companyId' | 'createdAt' | 'createdByUserId'>,
    fromTemplateId: string,
  ) => string | undefined;

  onToggleFavorite: (id: string) => void;
  onHide: (id: string) => void;
}

type View = 'library' | 'create';

export default function MissionTemplateLibrarySheet({
  open, onClose, templates, families,
  qualifications, equipmentItems, platoons, platoonLeaveDays,
  defaultOrder, defaultPlatoonIds,
  onCreate, onToggleFavorite, onHide,
}: Props) {
  const [view, setView] = useState<View>('library');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Multi-axis filter state.
  const [filter, setFilter] = useState<LibraryFilter>({});
  const [collapsedFamilyIds, setCollapsedFamilyIds] = useState<Set<string>>(new Set());

  // Create-form state.
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<string>(defaultOrder?.startDate ?? '');
  const [endDate, setEndDate] = useState<string>(defaultOrder?.endDate ?? '');
  const [platoonIds, setPlatoonIds] = useState<string[]>(defaultPlatoonIds ?? []);
  const [rallyOverride, setRallyOverride] = useState<string>('');

  // ── Derived: filter → group → sort ──────────────────────────────
  const filtered = useMemo(() => applyLibraryFilter(templates, filter), [templates, filter]);

  /** Recently used = lastUsedAt within 14 days, ordered by recency. */
  const recents = useMemo(() => {
    const cutoff = Date.now() - 14 * 86400_000;
    return filtered
      .filter((t) => t.lastUsedAt && Date.parse(t.lastUsedAt) >= cutoff)
      .sort((a, b) => Date.parse(b.lastUsedAt!) - Date.parse(a.lastUsedAt!));
  }, [filtered]);

  /** Favorites cluster — shown above family sections. */
  const favorites = useMemo(
    () => filtered.filter((t) => t.isFavorite),
    [filtered],
  );

  /** Templates grouped by family, with un-familied templates falling
   *  into a synthetic "ללא משפחה" bucket. Families are sorted by their
   *  `order` field; templates within a family by usage count desc. */
  const byFamily = useMemo(() => {
    const activeFamilies = [...families].filter((f) => !f.isArchived)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const map = new Map<string, MissionTemplate[]>();
    for (const f of activeFamilies) map.set(f.id, []);
    map.set('__none__', []);
    for (const t of filtered) {
      const key = t.familyId && map.has(t.familyId) ? t.familyId : '__none__';
      map.get(key)!.push(t);
    }
    // Sort templates within each family.
    for (const [k, list] of map) {
      list.sort((a, b) => {
        if ((b.isFavorite ? 1 : 0) !== (a.isFavorite ? 1 : 0)) return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        return a.name.localeCompare(b.name, 'he');
      });
      if (list.length === 0) map.delete(k);
    }
    return { activeFamilies, map };
  }, [filtered, families]);

  // Selected template for the create view.
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

  const related = template ? findRelatedTemplates(template, templates, 4) : [];

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

  const toggleFamilyCollapse = (familyId: string) => {
    setCollapsedFamilyIds((prev) => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  };

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={view === 'library' ? 'ספריית תורת המשימות' : `תבנית: ${template?.name ?? ''}`}
      subtitle={view === 'library'
        ? `${filtered.length}/${templates.length} תבניות זמינות`
        : 'מלא רק את מה שמשתנה במופע הזה.'}
      size="lg"
    >
      {view === 'library' ? (
        <LibraryView
          filter={filter}
          setFilter={setFilter}
          favorites={favorites}
          recents={recents}
          byFamily={byFamily}
          collapsedFamilyIds={collapsedFamilyIds}
          toggleCollapse={toggleFamilyCollapse}
          onPick={pickTemplate}
          onToggleFavorite={onToggleFavorite}
          onHide={onHide}
        />
      ) : template ? (
        <CreateView
          template={template}
          name={name} setName={setName}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          platoonIds={platoonIds} setPlatoonIds={setPlatoonIds}
          rallyOverride={rallyOverride} setRallyOverride={setRallyOverride}
          platoons={platoons}
          reviews={reviews}
          related={related}
          family={families.find((f) => f.id === template.familyId)}
          allFamilies={families}
          blockingErrors={blockingErrors.length}
          onSubmit={submit}
          onBack={() => setView('library')}
          onPickRelated={pickTemplate}
        />
      ) : null}
    </Sheet>
  );
}

// ─── Library view ────────────────────────────────────────────────────

function LibraryView({
  filter, setFilter, favorites, recents, byFamily, collapsedFamilyIds, toggleCollapse,
  onPick, onToggleFavorite, onHide,
}: {
  filter: LibraryFilter;
  setFilter: (f: LibraryFilter) => void;
  favorites: MissionTemplate[];
  recents: MissionTemplate[];
  byFamily: { activeFamilies: TemplateFamily[]; map: Map<string, MissionTemplate[]> };
  collapsedFamilyIds: Set<string>;
  toggleCollapse: (familyId: string) => void;
  onPick: (t: MissionTemplate) => void;
  onToggleFavorite: (id: string) => void;
  onHide: (id: string) => void;
}) {
  return (
    <div className="px-5 py-4 space-y-4">

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={filter.query ?? ''}
          onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          placeholder="חפש בשם או תיאור…"
          className="w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost"
        />
      </div>

      {/* Filter chip row */}
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip
          active={!!filter.favoritesOnly}
          onClick={() => setFilter({ ...filter, favoritesOnly: !filter.favoritesOnly })}
        >★ מועדפים</ToggleChip>
        <ToggleChip
          active={!!filter.recurringOnly}
          onClick={() => setFilter({ ...filter, recurringOnly: !filter.recurringOnly })}
        >רצף</ToggleChip>
        <ToggleChip
          active={!!filter.dayNightOnly}
          onClick={() => setFilter({ ...filter, dayNightOnly: !filter.dayNightOnly })}
        >יום/לילה</ToggleChip>
        <ToggleChip
          active={!!filter.vehicleOnly}
          onClick={() => setFilter({ ...filter, vehicleOnly: !filter.vehicleOnly })}
        >🚗 רכב</ToggleChip>
        <ArchetypeFilter filter={filter} setFilter={setFilter} />
      </div>

      {/* Sections */}
      <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">

        {favorites.length > 0 && !filter.favoritesOnly && (
          <CollapsibleSection
            id="__fav__"
            label="מועדפים"
            icon="★"
            color="warn"
            count={favorites.length}
            collapsed={collapsedFamilyIds.has('__fav__')}
            onToggle={() => toggleCollapse('__fav__')}
          >
            {favorites.map((t) => (
              <TemplateRow key={t.id} template={t}
                onPick={() => onPick(t)}
                onToggleFavorite={() => onToggleFavorite(t.id)}
                onHide={() => onHide(t.id)}
              />
            ))}
          </CollapsibleSection>
        )}

        {recents.length > 0 && (
          <CollapsibleSection
            id="__recent__"
            label="שימוש אחרון"
            icon="↻"
            color="info"
            count={recents.length}
            collapsed={collapsedFamilyIds.has('__recent__')}
            onToggle={() => toggleCollapse('__recent__')}
          >
            {recents.slice(0, 5).map((t) => (
              <TemplateRow key={t.id} template={t}
                onPick={() => onPick(t)}
                onToggleFavorite={() => onToggleFavorite(t.id)}
                onHide={() => onHide(t.id)}
                showLastUsed
              />
            ))}
          </CollapsibleSection>
        )}

        {byFamily.activeFamilies.map((f) => {
          const list = byFamily.map.get(f.id);
          if (!list || list.length === 0) return null;
          return (
            <CollapsibleSection
              key={f.id}
              id={f.id}
              label={f.label}
              icon={f.icon}
              color={f.color ?? 'olive'}
              count={list.length}
              description={f.description}
              collapsed={collapsedFamilyIds.has(f.id)}
              onToggle={() => toggleCollapse(f.id)}
            >
              {list.map((t) => (
                <TemplateRow key={t.id} template={t}
                  onPick={() => onPick(t)}
                  onToggleFavorite={() => onToggleFavorite(t.id)}
                  onHide={() => onHide(t.id)}
                />
              ))}
            </CollapsibleSection>
          );
        })}

        {byFamily.map.get('__none__') && byFamily.map.get('__none__')!.length > 0 && (
          <CollapsibleSection
            id="__none__"
            label="ללא משפחה"
            icon="—"
            color="muted"
            count={byFamily.map.get('__none__')!.length}
            collapsed={collapsedFamilyIds.has('__none__')}
            onToggle={() => toggleCollapse('__none__')}
          >
            {byFamily.map.get('__none__')!.map((t) => (
              <TemplateRow key={t.id} template={t}
                onPick={() => onPick(t)}
                onToggleFavorite={() => onToggleFavorite(t.id)}
                onHide={() => onHide(t.id)}
              />
            ))}
          </CollapsibleSection>
        )}

        {byFamily.map.size === 0 && favorites.length === 0 && (
          <Muted className="text-center py-8">אין תבניות תואמות לסינון.</Muted>
        )}
      </div>

      <Muted className="text-tiny leading-snug pt-2 border-t border-mil-border">
        ספריית תבניות גדלה לאט-לאט עם השימוש. כל משימה ניתנת לשמור כתבנית מתוך עמוד המשימה (״שמור כתבנית״).
      </Muted>
    </div>
  );
}

// ─── Create view ────────────────────────────────────────────────────

function CreateView({
  template, name, setName, startDate, setStartDate, endDate, setEndDate,
  platoonIds, setPlatoonIds, rallyOverride, setRallyOverride,
  platoons, reviews, related, family, allFamilies,
  blockingErrors, onSubmit, onBack, onPickRelated,
}: {
  template: MissionTemplate;
  name: string; setName: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  platoonIds: string[]; setPlatoonIds: (v: string[] | ((prev: string[]) => string[])) => void;
  rallyOverride: string; setRallyOverride: (v: string) => void;
  platoons: Platoon[];
  reviews: ReturnType<typeof reviewTemplateInstantiation>;
  related: MissionTemplate[];
  family?: TemplateFamily;
  allFamilies: TemplateFamily[];
  blockingErrors: number;
  onSubmit: () => void;
  onBack: () => void;
  onPickRelated: (t: MissionTemplate) => void;
}) {
  const arch = MISSION_ARCHETYPES[template.payload.archetypeKind];

  return (
    <div className="px-5 py-5 space-y-5">

      {/* Inherited summary */}
      <div className="bg-mil-olive-bg/50 border border-mil-olive/30 rounded-xl-soft px-4 py-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          {family && (
            <span className="text-xxs font-bold uppercase tracking-wide text-mil-muted">
              {family.icon} {family.label}
            </span>
          )}
          <Hint className="block tracking-wide">נורש מתבנית</Hint>
        </div>
        <Body className="text-tiny leading-snug mt-0.5">
          {arch.icon} {arch.label}
          {template.payload.rallyPoint && ` · ${template.payload.rallyPoint}`}
        </Body>
        <Muted className="mt-1 text-tiny leading-snug">
          מודל זמן, מצבה, פיקוד, רוטציה, עייפות, חפיפות, ציוד וכישורים — כולם מוגדרים מהתבנית. שנה רק את מה שצריך לשנות.
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

      {/* Related templates */}
      {related.length > 0 && (
        <div>
          <Hint className="block mb-2 tracking-wide">תבניות קשורות</Hint>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {related.map((t) => {
              const tArch = MISSION_ARCHETYPES[t.payload.archetypeKind];
              const tFamily = allFamilies.find((f) => f.id === t.familyId);
              return (
                <button
                  key={t.id}
                  onClick={() => onPickRelated(t)}
                  className="text-right bg-mil-card border border-mil-border rounded-xl-soft px-3 py-2 hover:border-mil-olive transition-colors"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm leading-none" aria-hidden>{tArch.icon}</span>
                    <Body className="text-sm font-semibold truncate">{t.name}</Body>
                  </div>
                  <Hint className="block mt-0.5 text-tiny leading-snug">
                    {tFamily?.label ?? tArch.label}
                  </Hint>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={blockingErrors > 0}
          onClick={onSubmit}
        >
          צור משימה
        </Button>
        <Button variant="ghost" size="lg" onClick={onBack}>
          חזור לספרייה
        </Button>
      </div>
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────────────────

function CollapsibleSection({
  id, label, icon, color, count, description, collapsed, onToggle, children,
}: {
  id: string;
  label: string;
  icon?: string;
  color: 'olive' | 'warn' | 'info' | 'alert' | 'muted';
  count: number;
  description?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  void id;
  const tone =
    color === 'olive' ? 'border-mil-olive/30 bg-mil-olive-bg/30 text-mil-olive-dim' :
    color === 'warn'  ? 'border-mil-warn/30 bg-mil-warn-bg/40 text-mil-warn' :
    color === 'info'  ? 'border-mil-info-border bg-mil-info-bg text-mil-info' :
    color === 'alert' ? 'border-mil-alert/30 bg-mil-alert-bg/40 text-mil-alert' :
    'border-mil-border bg-mil-bg-alt text-mil-muted';

  return (
    <section className="border border-mil-border rounded-2xl overflow-hidden bg-mil-card">
      <button
        onClick={onToggle}
        className={`w-full text-right flex items-baseline gap-2 px-4 py-2.5 border-b border-mil-border ${tone}`}
      >
        <span className="text-base leading-none shrink-0" aria-hidden>{icon ?? '•'}</span>
        <Body className="font-bold text-sm flex-1">{label}</Body>
        <Hint className="tabular-nums shrink-0">{count}</Hint>
        <span className="shrink-0 text-tiny" aria-hidden>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-mil-border">
          {description && (
            <Muted className="text-tiny px-4 py-1.5 leading-snug bg-mil-bg-alt/40">{description}</Muted>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

function TemplateRow({
  template, onPick, onToggleFavorite, onHide, showLastUsed,
}: {
  template: MissionTemplate;
  onPick: () => void;
  onToggleFavorite: () => void;
  onHide: () => void;
  showLastUsed?: boolean;
}) {
  const arch = MISSION_ARCHETYPES[template.payload.archetypeKind];
  return (
    <div className="flex items-stretch hover:bg-mil-card-hover transition-colors">
      <button onClick={onPick} className="flex-1 text-right px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm leading-none" aria-hidden>{arch.icon}</span>
          <Body className="font-semibold text-sm">{template.name}</Body>
          {template.isFavorite && <span className="text-mil-warn text-tiny" aria-hidden>★</span>}
        </div>
        {template.description && (
          <Muted className="mt-0.5 text-tiny leading-snug">{template.description}</Muted>
        )}
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          {template.usageCount > 0 && (
            <Hint className="text-tiny tabular-nums text-mil-olive-dim">{template.usageCount} שימושים</Hint>
          )}
          {showLastUsed && template.lastUsedAt && (
            <Hint className="text-tiny text-mil-info">· {formatRelative(template.lastUsedAt)}</Hint>
          )}
          {template.payload.dayNightProfile && (
            <Hint className="text-tiny">· יום/לילה</Hint>
          )}
          {template.payload.hasVehicle && (
            <Hint className="text-tiny">· 🚗</Hint>
          )}
        </div>
      </button>
      <div className="flex border-r border-mil-border">
        <button
          onClick={onToggleFavorite}
          className="px-2.5 text-mil-muted hover:text-mil-warn hover:bg-mil-card-hover text-sm"
          aria-label="מועדף"
          title="סמן כמועדף"
        >
          {template.isFavorite ? '★' : '☆'}
        </button>
        <button
          onClick={onHide}
          className="px-2.5 text-mil-muted hover:text-mil-alert hover:bg-mil-card-hover text-sm"
          aria-label="הסתר תבנית"
          title="הסתר"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ToggleChip({
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

function ArchetypeFilter({
  filter, setFilter,
}: {
  filter: LibraryFilter;
  setFilter: (f: LibraryFilter) => void;
}) {
  const active = filter.archetypes ?? [];
  const toggle = (k: MissionArchetypeKind) => {
    const next = active.includes(k) ? active.filter((x) => x !== k) : [...active, k];
    setFilter({ ...filter, archetypes: next.length ? next : undefined });
  };
  return (
    <>
      {MISSION_ARCHETYPE_LIST.filter((a) => a.kind !== 'custom').map((a) => (
        <ToggleChip key={a.kind} active={active.includes(a.kind)} onClick={() => toggle(a.kind)}>
          {a.icon}
        </ToggleChip>
      ))}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Hint className="block mb-1.5 tracking-wide">{label}</Hint>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base transition-colors duration-200 ease-out-soft';

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diffMin = Math.round((Date.now() - then) / 60_000);
  if (diffMin < 1)   return 'הרגע';
  if (diffMin < 60)  return `לפני ${diffMin} דק׳`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24)    return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}
