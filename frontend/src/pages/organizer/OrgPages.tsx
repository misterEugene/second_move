import { MessageSquareText } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { ReviewItem } from '@/api/types';
import { FieldError, Skeleton, StarRating } from '@/components/Basics';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useForm } from '@/lib/useForm';
import { useTitle } from '@/lib/useTitle';

export function OrgReviewsPage() {
  useTitle('Отзывы');
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);
  useEffect(() => {
    api<ReviewItem[]>('/organizer/reviews').then(setReviews);
  }, []);

  return (
    <section className="card card-pad">
      <h2 className="card-title">Отзывы участников</h2>
      {!reviews ? (
        <Skeleton height={200} />
      ) : !reviews.length ? (
        <div className="empty"><MessageSquareText size={36} /><p>Отзывов пока нет. Они появятся после того, как волонтёры примут участие.</p></div>
      ) : (
        reviews.map((r) => (
          <article key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 4 }}>
              <div className="row"><strong>{r.author}</strong><StarRating value={r.rating} size={13} /></div>
              <p>{r.text}</p>
              <p className="muted small"><Link to={`/organizer/events/${r.event.id}`}>{r.event.title}</Link> · {formatDateTime(r.createdAt)}</p>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

export function OrgProfilePage() {
  useTitle('Профиль организации');
  const [form, setForm] = useState<{ name: string; description: string; city: string } | null>(null);
  const { errors, error, busy, submit } = useForm();

  useEffect(() => {
    api<{ name: string; description: string; city: string | null }>('/organizer/organization').then((o) =>
      setForm({ name: o.name, description: o.description, city: o.city ?? '' }),
    );
  }, []);

  if (!form) return <section className="card card-pad"><Skeleton height={260} /></section>;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (await submit(() => api('/organizer/organization', { method: 'PATCH', body: form }))) toast('Профиль организации сохранён');
  }

  return (
    <section className="card card-pad">
      <h2 className="card-title">Профиль организации</h2>
      <form className="form-grid two" onSubmit={save}>
        <label className="field">
          <span>Название</span>
          <input className={`input ${errors.name ? 'has-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FieldError text={errors.name} />
        </label>
        <label className="field">
          <span>Город</span>
          <input className={`input ${errors.city ? 'has-error' : ''}`} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <FieldError text={errors.city} />
        </label>
        <label className="field span-2">
          <span>Описание</span>
          <textarea className={`input ${errors.description ? 'has-error' : ''}`} rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <FieldError text={errors.description} />
        </label>
        {error && <p className="form-error span-2">{error}</p>}
        <div><button className="btn" disabled={busy}>Сохранить</button></div>
      </form>
    </section>
  );
}
