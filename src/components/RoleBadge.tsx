// Operational role badge — tiny chip showing the viewer's role.
//
// Three tone tiers map onto the command hierarchy:
//   • company leadership → coral / peach (warm authority)
//   • platoon leadership → indigo (primary accent)
//   • soldier            → neutral muted

import type { UserRole } from '../types';
import { roleLabel } from '../utils/permissions';

const styles: Record<UserRole, string> = {
  companyCommander:       'bg-mil-sand-bg text-mil-sand border-mil-sand/40',
  deputyCompanyCommander: 'bg-mil-sand-bg text-mil-sand border-mil-sand/40',
  owner:                  'bg-mil-sand-bg text-mil-sand border-mil-sand/40',
  platoonCommander:       'bg-mil-olive-bg text-mil-olive border-mil-olive/30',
  platoonSergeant:        'bg-mil-olive-bg text-mil-olive border-mil-olive/30',
  manager:                'bg-mil-olive-bg text-mil-olive border-mil-olive/30',
  soldier:                'bg-mil-bg-alt text-mil-muted border-mil-border',
};

export default function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-block text-xxs font-semibold px-1.5 py-0.5 rounded-md border ${styles[role]}`}>
      {roleLabel(role)}
    </span>
  );
}
