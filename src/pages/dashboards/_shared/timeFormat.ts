// Shared time-formatting helpers used by all three dashboard variants.

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatTimeNow(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Relative future time — "בעוד N דקות / שעות / ימים" */
export function formatRelative(mins: number): string {
  if (mins < 0) return 'עכשיו';
  if (mins < 60) return `בעוד ${mins} דקות`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m === 0 ? `בעוד ${h} שעות` : `בעוד ${h}:${m.toString().padStart(2, '0')} שעות`;
  return `בעוד ${Math.floor(h / 24)} ימים`;
}
