// StatusUpdateInline — the soldier-self status flow extracted to a
// reusable component. Used by SoldierDashboard's existing modal AND by
// PersonalActionsFab's universal personal hub.

import { useState } from 'react';
import { Button, Body, Hint } from './ui';
import type { Soldier, SoldierStatus } from '../types';

interface StatusUpdateInlineProps {
  soldier: Soldier;
  onCancel: () => void;
  onSubmit: (next: SoldierStatus, expectedUntil?: string) => void;
}

const INPUT = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base transition-colors duration-200 ease-out-soft';

export default function StatusUpdateInline({ soldier, onCancel, onSubmit }: StatusUpdateInlineProps) {
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('08:00');

  const goHome = () => {
    const iso = returnDate ? `${returnDate}T${returnTime}:00` : undefined;
    onSubmit('home', iso);
  };

  if (soldier.currentStatus === 'in-base') {
    return (
      <div className="space-y-4">
        <Body className="text-mil-muted">מתי אתה צפוי לחזור?</Body>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Hint className="mb-1.5 block">תאריך</Hint>
            <input type="date" className={INPUT} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
          <div>
            <Hint className="mb-1.5 block">שעה</Hint>
            <input type="time" className={INPUT} value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="lg" fullWidth onClick={goHome} disabled={!returnDate}>
            יצאתי הביתה
          </Button>
          <Button variant="quiet" size="lg" onClick={onCancel}>
            ביטול
          </Button>
        </div>
        <Hint className="text-center">המ״מ יראה מתי אתה צפוי לחזור.</Hint>
      </div>
    );
  }

  if (soldier.currentStatus === 'home') {
    return (
      <div className="space-y-4">
        <Body className="text-mil-muted">לאשר: אתה בבסיס מעכשיו?</Body>
        <div className="flex gap-2">
          <Button variant="primary" size="lg" fullWidth onClick={() => onSubmit('in-base')}>
            חזרתי לבסיס
          </Button>
          <Button variant="quiet" size="lg" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </div>
    );
  }

  // inactive-temp
  return (
    <div className="space-y-4">
      <Body className="text-mil-muted">לאשר: אתה פעיל ומוכן לשיבוץ?</Body>
      <div className="flex gap-2">
        <Button variant="primary" size="lg" fullWidth onClick={() => onSubmit('in-base')}>
          חזרתי לפעילות
        </Button>
        <Button variant="quiet" size="lg" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
