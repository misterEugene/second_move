import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '@/api/client';

export function SkillsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [known, setKnown] = useState<string[]>([]);
  const listId = useId();

  useEffect(() => {
    api<string[]>('/skills').then(setKnown).catch(() => {
      /* подсказки необязательны */
    });
  }, []);

  function add() {
    const v = draft.trim();
    if (v && !value.includes(v) && value.length < 15) onChange([...value, v]);
    setDraft('');
  }

  return (
    <div className="skills-input">
      {value.map((s) => (
        <span key={s} className="chip">
          {s}
          <button type="button" aria-label={`Удалить навык ${s}`} onClick={() => onChange(value.filter((x) => x !== s))}><X size={13} /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        className="input"
        list={listId}
        placeholder="Добавить навык и Enter"
        maxLength={50}
      />
      <datalist id={listId}>{known.map((k) => <option key={k} value={k} />)}</datalist>
    </div>
  );
}
