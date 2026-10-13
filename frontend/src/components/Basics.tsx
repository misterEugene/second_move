import { Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApplicationStatus, Category } from '@/api/types';
import { CATEGORIES, STATUS } from '@/lib/categories';

export function AppLogo() {
  return (
    <Link to="/" className="logo" aria-label="ДоброРядом — на главную">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path d="M16 24.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 16 11.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="#fff" />
      </svg>
      <span>ДоброРядом</span>
    </Link>
  );
}

export function UserAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function CategoryBadge({ category, className = '' }: { category: Category; className?: string }) {
  const c = CATEGORIES[category];
  return (
    <span className={`badge ${className}`} style={{ background: c.tint, color: 'var(--ink)' }}>
      <i className="swatch" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge ${STATUS[status].tone}`}>{STATUS[status].label}</span>;
}

export function StarRating({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  return (
    <span className="rating">
      <span className="stars" aria-label={value ? `Рейтинг ${value} из 5` : 'Нет оценок'}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} fill={value && i <= Math.round(value) ? 'currentColor' : 'none'} />
        ))}
      </span>
      {value ? <span className="small"><strong>{value.toFixed(1)}</strong></span> : null}
      {count !== undefined && <span className="muted small">({count})</span>}
    </span>
  );
}

export function EventCover(props: {
  category: Category;
  imageUrl?: string | null;
  alt?: string;
  tall?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const c = CATEGORIES[props.category];
  const Icon = c.icon;
  return (
    <div className={`cover ${props.tall ? 'tall' : ''} ${props.className ?? ''}`} style={{ background: c.tint }}>
      {props.imageUrl && !failed ? (
        <img src={props.imageUrl} alt={props.alt ?? ''} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <>
          <svg className="cover-blob" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
            <circle cx="170" cy="10" r="60" fill={c.color} opacity=".12" />
            <circle cx="20" cy="120" r="50" fill={c.color} opacity=".1" />
          </svg>
          <Icon className="cover-icon" size={props.compact ? 22 : props.tall ? 72 : 46} color={c.color} strokeWidth={1.6} aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export function FieldError({ text }: { text?: string }) {
  return text ? <small className="field-error">{text}</small> : null;
}

export function Skeleton({ height }: { height: number }) {
  return <div className="skeleton" style={{ height }} />;
}
