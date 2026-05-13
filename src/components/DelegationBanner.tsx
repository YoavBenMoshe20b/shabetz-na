// Active command delegation banner.
//
// When the current user is the TARGET of an active CommandDelegation
// (i.e. someone has handed them temporary acting command), show a quiet
// banner explaining the scope + remaining time. Tapping opens the
// /delegations page where they can see the full record + acknowledge.
//
// When the current user is the SOURCE of a delegation they haven't
// revoked, the banner appears in a paler tone — operational reminder
// that someone else is acting in their place.
//
// Banner is intentionally one short line — operational not promotional.

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function DelegationBanner() {
  const navigate = useNavigate();
  const { currentUser, activeCommandDelegations } = useApp();

  if (!currentUser) return null;
  const active = activeCommandDelegations();
  if (active.length === 0) return null;

  // Pick the most-relevant single delegation:
  //   1. Where viewer is the acting commander (incoming authority)
  //   2. Where viewer granted it (outgoing acknowledgement)
  const asActor = active.find((d) => d.toUserId === currentUser.id);
  const asGrantor = active.find((d) => d.fromUserId === currentUser.id);
  const relevant = asActor ?? asGrantor;
  if (!relevant) return null;

  const isActor = !!asActor;
  const endsAt = new Date(relevant.endIso);
  const remaining = formatRemaining(endsAt);

  return (
    <button
      onClick={() => navigate('/delegations')}
      className={`w-full text-right px-4 py-2 border-b transition-colors ${
        isActor
          ? 'bg-mil-olive-bg/60 border-mil-olive/30 hover:bg-mil-olive-bg'
          : 'bg-mil-card-warm border-mil-border hover:bg-mil-card-hover'
      }`}
      dir="rtl"
    >
      <div className="flex items-baseline gap-2 max-w-xl mx-auto">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 self-center ${
          isActor ? 'bg-mil-olive' : 'bg-mil-muted'
        }`} aria-hidden />
        <span className={`text-tiny font-semibold ${isActor ? 'text-mil-olive-dim' : 'text-mil-muted'}`}>
          {isActor
            ? `אתה משמש כממלא מקום של ${relevant.fromUserName}`
            : `${relevant.toUserName} משמש כממלא מקום עבורך`}
        </span>
        <span className="text-tiny text-mil-muted mr-auto">{remaining}</span>
      </div>
    </button>
  );
}

function formatRemaining(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'מסתיים';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `מסתיים בעוד ${Math.floor(ms / 60000)} דק׳`;
  if (hours < 24) return `עוד ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'עד מחר';
  return `עוד ${days} ימים`;
}
