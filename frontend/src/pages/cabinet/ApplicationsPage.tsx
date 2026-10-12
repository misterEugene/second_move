import { ClipboardList } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import type { ApplicationStatus, MyApplication } from '@/api/types';
import { EventCover, Skeleton, StatusBadge } from '@/components/Basics';
import { ReviewForm } from '@/components/ReviewForm';
import { STATUS } from '@/lib/categories';
import { formatDate, formatHours, formatShift } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useTitle } from '@/lib/useTitle';

const TABS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

export function ApplicationsPage() {
  useTitle('Мои заявки');
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [tab, setTab] = useState<ApplicationStatus | 'ALL'>('ALL');
  const [reviewFor, setReviewFor] = useState<number | null>(null);

  const load = useCallback(() => api<MyApplication[]>('/applications/my').then(setApps), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(a: MyApplication) {
    if (!confirm(`Отменить заявку на «${a.event.title}»?`)) return;
    try {
      await api(`/applications/${a.id}/cancel`, { method: 'POST' });
      toast('Заявка отменена');
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Ошибка', 'bad');
    }
  }

  const shown = apps?.filter((a) => tab === 'ALL' || a.status === tab) ?? [];

  return (
    <section className="card card-pad">
      <div className="card-title"><h2>Мои заявки</h2></div>
      <div className="pill-tabs" role="tablist" style={{ marginBottom: 8 }}>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'ALL' ? 'Все' : STATUS[t].label}
          </button>
        ))}
      </div>

      {!apps ? (
        <Skeleton height={200} />
      ) : !shown.length ? (
        <div className="empty">
          <ClipboardList size={36} />
          <p>Здесь пока пусто.</p>
          <Link to="/events" className="btn btn-soft" style={{ marginTop: 12 }}>Найти мероприятие</Link>
        </div>
      ) : (
        shown.map((a) => (
          <article key={a.id} className="app-row">
            <EventCover category={a.event.category} imageUrl={a.event.imageUrl} className="thumb" compact />
            <div className="app-info">
              <div className="row">
                <Link to={`/events/${a.event.id}`} className="app-title">{a.event.title}</Link>
                <StatusBadge status={a.status} />
              </div>
              <p className="muted small">{a.event.organization.name} · {formatDate(a.event.date)} · {a.event.city}</p>
              {a.shift ? (
                <p className="small">Смена: <strong>{formatShift(a.shift)}</strong></p>
              ) : a.status === 'APPROVED' && a.attended === null ? (
                <p className="small text-warn">Выберите смену на <Link to={`/events/${a.event.id}`}>странице мероприятия</Link></p>
              ) : null}
              {a.hours !== null ? (
                <p className="small text-ok">Подтверждено {formatHours(a.hours)}</p>
              ) : a.attended ? (
                <p className="small text-warn">Участие отмечено, ждём подтверждения часов</p>
              ) : null}
              <div className="row" style={{ marginTop: 6 }}>
                {(a.status === 'PENDING' || a.status === 'APPROVED') && a.attended === null && (
                  <button className="btn btn-ghost btn-sm" onClick={() => cancel(a)}>Отменить</button>
                )}
                {a.canReview && reviewFor !== a.id && <button className="btn btn-soft btn-sm" onClick={() => setReviewFor(a.id)}>Оставить отзыв</button>}
                {a.reviewed && <span className="badge muted">Отзыв оставлен</span>}
              </div>
              {reviewFor === a.id && (
                <div className="review-box">
                  <ReviewForm eventId={a.event.id} onDone={() => { setReviewFor(null); void load(); }} />
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
