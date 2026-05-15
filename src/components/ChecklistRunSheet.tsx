// ChecklistRunSheet — execute a צל״ם run on a list of soldiers.
//
// Phase 6.2.c MVP. Opens from MissionDetailPage with a list of soldiers
// (typically those assigned to the mission) + a chosen template. Each
// soldier gets a card; the operator taps checkboxes for each item.
// State is persisted per-instance so partial progress survives close.
//
// Status colors:
//   • pending     → mil-muted (no items touched)
//   • in-progress → mil-warn  (some items checked)
//   • passed      → mil-success (all critical + required items present)
//   • failed      → mil-alert (manually marked failed)

import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sheet, Body, Muted, Hint, Button } from './ui';
import type { ChecklistRun, ChecklistInstance, ChecklistTemplate, Soldier } from '../types';

interface ChecklistRunSheetProps {
  open: boolean;
  onClose: () => void;
  run: ChecklistRun;
}

export default function ChecklistRunSheet({ open, onClose, run }: ChecklistRunSheetProps) {
  const {
    checklistTemplates, checklistInstances, soldiers,
    setChecklistInstanceItem, completeChecklistRun,
  } = useApp();

  const template = useMemo(
    () => checklistTemplates.find((t) => t.id === run.templateId) ?? null,
    [checklistTemplates, run.templateId],
  );

  const instances = useMemo(
    () => checklistInstances.filter((i) => i.runId === run.id),
    [checklistInstances, run.id],
  );

  const [expandedId, setExpandedId] = useState<string | null>(instances[0]?.id ?? null);

  if (!template) {
    return (
      <Sheet open={open} onClose={onClose} title="צל״ם" subtitle="תבנית לא נמצאה">
        <div className="px-5 py-5">
          <Muted>תבנית הצל״ם של ריצה זו אינה זמינה.</Muted>
        </div>
      </Sheet>
    );
  }

  const passed = instances.filter((i) => i.status === 'passed').length;
  const total = instances.length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`צל״ם · ${template.name}`}
      subtitle={`${passed}/${total} עברו · ${run.status === 'completed' ? 'סגור' : 'פעיל'}`}
    >
      <div className="px-5 py-5 space-y-3">
        {run.notes && (
          <div className="bg-mil-info-bg border border-mil-info-border rounded-md px-3 py-2">
            <Hint className="text-mil-info">{run.notes}</Hint>
          </div>
        )}

        {instances.length === 0 ? (
          <Muted>אין חיילים בריצה זו.</Muted>
        ) : (
          <div className="space-y-2">
            {instances.map((inst) => (
              <SoldierInstanceCard
                key={inst.id}
                inst={inst}
                template={template}
                soldier={soldiers.find((s) => s.id === inst.soldierId)}
                expanded={expandedId === inst.id}
                onToggle={() => setExpandedId(expandedId === inst.id ? null : inst.id)}
                onItemChange={(itemKey, patch) =>
                  setChecklistInstanceItem(inst.id, itemKey, patch)
                }
              />
            ))}
          </div>
        )}

        {run.status !== 'completed' && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              completeChecklistRun(run.id);
              onClose();
            }}
          >
            סגור ריצת צל״ם
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// ─── Per-soldier card ────────────────────────────────────────────────

function SoldierInstanceCard({
  inst, template, soldier, expanded, onToggle, onItemChange,
}: {
  inst: ChecklistInstance;
  template: ChecklistTemplate;
  soldier?: Soldier;
  expanded: boolean;
  onToggle: () => void;
  onItemChange: (itemKey: string, patch: { present?: boolean; actualCount?: number }) => void;
}) {
  const statusTone =
    inst.status === 'passed'      ? { bg: 'bg-mil-success-bg', text: 'text-mil-success', border: 'border-mil-success-border', label: 'עבר' } :
    inst.status === 'failed'      ? { bg: 'bg-mil-alert-bg',   text: 'text-mil-alert',   border: 'border-mil-alert-border',   label: 'נכשל' } :
    inst.status === 'in-progress' ? { bg: 'bg-mil-warn-bg',    text: 'text-mil-warn',    border: 'border-mil-warn-border',    label: 'בתהליך' } :
                                    { bg: 'bg-mil-card',       text: 'text-mil-muted',   border: 'border-mil-border',         label: 'ממתין' };

  const presentCount = inst.items.filter((i) => i.present).length;

  return (
    <article className={`bg-mil-card border rounded-xl-soft overflow-hidden ${statusTone.border}`}>
      <button
        onClick={onToggle}
        className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-mil-card-warm/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <Body className="font-semibold leading-tight">{soldier?.name ?? inst.soldierId}</Body>
          <Hint className="text-mil-muted tabular-nums">{presentCount}/{template.items.length} פריטים</Hint>
        </div>
        <span className={`inline-flex items-center text-xxs font-bold px-2 py-0.5 rounded-md border ${statusTone.bg} ${statusTone.text} ${statusTone.border}`}>
          {statusTone.label}
        </span>
        <span className="text-mil-ghost text-tiny">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="border-t border-mil-border bg-mil-bg-alt divide-y divide-mil-border">
          {template.items.map((it) => {
            const inst_it = inst.items.find((ii) => ii.key === it.key);
            const present = inst_it?.present ?? false;
            return (
              <button
                key={it.key}
                onClick={() => onItemChange(it.key, { present: !present })}
                className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-mil-card transition-colors"
              >
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                    present
                      ? 'bg-mil-success text-white'
                      : it.level === 'critical'
                        ? 'bg-mil-card border-2 border-mil-alert/40'
                        : 'bg-mil-card border border-mil-border'
                  }`}
                >
                  {present && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0 text-right">
                  <Body className="text-sm font-medium leading-tight">{it.label}</Body>
                  {it.expectedCount && (
                    <Hint className="text-mil-muted">× {it.expectedCount}</Hint>
                  )}
                </div>
                {it.level === 'critical' && (
                  <span className="text-xxs font-bold text-mil-alert">קריטי</span>
                )}
                {it.level === 'soft' && (
                  <span className="text-xxs font-medium text-mil-muted">רך</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
