import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; tone: 'ok' | 'bad' };
let seq = 0;
let listeners: ((t: Toast[]) => void)[] = [];
let current: Toast[] = [];

function emit(next: Toast[]) {
  current = next;
  listeners.forEach((l) => l(current));
}

export function toast(text: string, tone: 'ok' | 'bad' = 'ok') {
  const id = ++seq;
  emit([...current, { id, text, tone }]);
  setTimeout(() => emit(current.filter((t) => t.id !== id)), 3800);
}

export function ToastHost() {
  const [items, setItems] = useState(current);
  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>
      ))}
    </div>
  );
}
