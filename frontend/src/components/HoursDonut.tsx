import { useState } from 'react';
import type { Category } from '@/api/types';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { formatHours } from '@/lib/format';

const R = 52;
const STROKE = 16;
const C = 2 * Math.PI * R;
const GAP = 2;

export function HoursDonut({ data, total }: { data: { category: Category; hours: number }[]; total: number }) {
  const [hover, setHover] = useState<Category | null>(null);

  const rows = CATEGORY_ORDER.flatMap((c) => data.filter((d) => d.category === c && d.hours > 0));
  let offset = 0;
  const segments = rows.map((d) => {
    const len = (d.hours / total) * C;
    const seg = {
      ...d,
      share: Math.round((d.hours / total) * 100),
      dash: `${Math.max(0, len - (rows.length > 1 ? GAP : 0))} ${C}`,
      offset: -offset,
    };
    offset += len;
    return seg;
  });
  const active = segments.find((s) => s.category === hover);

  return (
    <div className="donut-wrap">
      <figure className="donut" role="img" aria-label={`Всего ${formatHours(total)}, разбивка по направлениям в легенде`}>
        <svg viewBox="0 0 140 140" width="150" height="150">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#edf2f0" strokeWidth={STROKE} />
          <g transform="rotate(-90 70 70)">
            {segments.map((s) => (
              <circle
                key={s.category}
                cx="70" cy="70" r={R} fill="none"
                stroke={CATEGORIES[s.category].color}
                strokeWidth={hover === s.category ? STROKE + 4 : STROKE}
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
                className="donut-seg"
                onMouseEnter={() => setHover(s.category)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        <figcaption className="donut-center">
          <strong>{formatHours(active ? active.hours : total)}</strong>
          {active && <span>{CATEGORIES[active.category].label}</span>}
        </figcaption>
      </figure>
      <table className="legend">
        <caption className="sr-only">Подтверждённые часы по направлениям</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.category} className={hover && hover !== s.category ? 'dim' : ''} onMouseEnter={() => setHover(s.category)} onMouseLeave={() => setHover(null)}>
              <th scope="row"><i style={{ background: CATEGORIES[s.category].color }} />{CATEGORIES[s.category].label}</th>
              <td>{formatHours(s.hours)}</td>
              <td className="muted">{s.share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
