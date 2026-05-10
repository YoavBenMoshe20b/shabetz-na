import { useState, type ReactNode } from 'react';

interface Props {
  text: string;
  children?: ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      {children}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        onBlur={() => setVisible(false)}
        className="mr-1 w-5 h-5 rounded-full bg-mil-border text-mil-muted text-xs flex items-center justify-center hover:bg-mil-olive hover:text-white transition-colors flex-shrink-0"
        aria-label="עזרה"
      >
        ?
      </button>
      {visible && (
        <span className="absolute bottom-full right-0 mb-2 z-50 w-64 bg-mil-card border border-mil-border rounded-lg px-3 py-2 text-xs text-mil-text shadow-xl leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}
