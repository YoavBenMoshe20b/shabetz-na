import type { UserRole } from '../types';
import { roleLabel } from '../utils/permissions';

const styles: Record<UserRole, string> = {
  companyCommander: 'bg-mil-sand/20 text-mil-sand border-mil-sand/40',
  owner:            'bg-mil-sand/20 text-mil-sand border-mil-sand/40',
  platoonCommander: 'bg-mil-olive/30 text-mil-olive-light border-mil-olive/50',
  platoonSergeant:  'bg-mil-olive/30 text-mil-olive-light border-mil-olive/50',
  manager:          'bg-mil-olive/30 text-mil-olive-light border-mil-olive/50',
  squadCommander:   'bg-mil-warn-bg text-mil-warn border-mil-warn-border',
  soldier:          'bg-mil-ghost/30 text-mil-muted border-mil-ghost/50',
};

export default function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${styles[role]}`}>
      {roleLabel(role)}
    </span>
  );
}
