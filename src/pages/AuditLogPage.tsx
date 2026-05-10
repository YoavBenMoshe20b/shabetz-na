import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import RoleBadge from '../components/RoleBadge';

export default function AuditLogPage() {
  const { auditLogs } = useApp();

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="יומן פעולות" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto">
        <p className="text-xs text-mil-muted mb-3">{auditLogs.length} רשומות</p>

        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="bg-mil-card border border-mil-border rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-mil-text text-sm font-medium">{log.actorName}</span>
                    <RoleBadge role={log.actorRole} />
                  </div>
                  <p className="text-sm">
                    <span className="text-mil-text">{log.action}</span>
                    {log.target && <span className="text-mil-muted"> — {log.target}</span>}
                  </p>
                </div>
                <span className="text-xs text-mil-ghost whitespace-nowrap mt-0.5">{fmt(log.timestamp)}</span>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="text-center text-mil-ghost py-10">אין רשומות</p>
          )}
        </div>
      </main>
    </div>
  );
}
