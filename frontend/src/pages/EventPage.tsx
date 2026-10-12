import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin, Settings, ShieldCheck, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import type { EventDetails } from '@/api/types';
import { CategoryBadge, EventCover, Skeleton, StarRating, StatusBadge } from '@/components/Basics';
import { ReviewForm } from '@/components/ReviewForm';
import { useAuth } from '@/lib/auth';
import { formatDate, formatHours, formatShift, plural, shiftHours, timeRange } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useTitle } from '@/lib/useTitle';

export function EventPage() {
  const id = Number(useParams().id);
  const auth = useAuth();
  const location = useLocation();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useTitle(event?.title);

  const load = useCallback(async () => {
    try {
      setEvent(await api<EventDetails>(`/events/${id}`));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setNotFound(true);
      else throw e;
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast(success);
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не удалось выполнить действие', 'bad');
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="container page">
        <div className="empty card"><p><strong>Мероприятие не найдено</strong></p><p>Возможно, оно было удалено или скрыто.</p></div>
      </div>
    );
  }
  if (!event) return <div className="container page"><Skeleton height={420} /></div>;

  const app = event.myApplication;
  const user = auth.user;
  const canApply = user && (user.role === 'VOLUNTEER' || user.role === 'ADMIN') && !event.canManage;
  const maxHours = event.shifts.length ? Math.max(...event.shifts.map(shiftHours)) : null;
  const requirements = event.requirements.split('\n').map((s) => s.trim()).filter(Boolean);
  const range = timeRange(event.shifts);
  const redirect = encodeURIComponent(location.pathname);
  const activeApp = app && app.status === 'APPROVED' && app.attended === null;

  const apply = () =>
    act(() => api(`/events/${id}/apply`, { method: 'POST', body: { message } }), 'Заявка отправлена организатору');
  const cancel = () => act(() => api(`/applications/${app!.id}/cancel`, { method: 'POST' }), 'Заявка отменена');
  const chooseShift = (shiftId: number) =>
    act(() => api(`/applications/${app!.id}/shift`, { method: 'PUT', body: { shiftId } }), 'Вы записаны на смену');

  function actionBlock() {
    if (event!.canManage) {
      return <Link to={`/organizer/events/${event!.id}`} className="btn btn-lg btn-block"><Settings size={18} /> Управлять мероприятием</Link>;
    }
    if (!user) {
      return (
        <>
          <Link to={`/login?redirect=${redirect}`} className="btn btn-lg btn-block">Войдите, чтобы подать заявку</Link>
          <p className="muted small center">Нет аккаунта? <Link to={`/register?redirect=${redirect}`}>Зарегистрируйтесь</Link></p>
        </>
      );
    }
    if (!canApply) return <p className="muted">Заявки на участие подают волонтёры.</p>;
    if (!app || app.status === 'CANCELLED') {
      return event!.freePlaces > 0 ? (
        <>
          <label className="field">
            <span>Сообщение организатору (необязательно)</span>
            <textarea className="input" maxLength={1000} placeholder="Например, о вашем опыте" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <button className="btn btn-lg btn-block" disabled={busy} onClick={apply}>Подать заявку</button>
        </>
      ) : (
        <button className="btn btn-lg btn-block" disabled>Свободных мест нет</button>
      );
    }
    return (
      <>
        <div className="row"><span>Ваша заявка:</span><StatusBadge status={app.status} /></div>
        {app.status === 'PENDING' && <p className="muted small">Организатор рассмотрит заявку и пришлёт уведомление.</p>}
        {app.status === 'REJECTED' && <p className="muted small">К сожалению, организатор отклонил заявку.</p>}
        {activeApp && (app.shiftId
          ? <p className="hint ok"><CheckCircle2 size={16} /> Вы записаны на смену. Ждём вас!</p>
          : <p className="hint">Заявка одобрена — выберите смену ниже.</p>)}
        {app.attended && app.hours !== null && <p className="hint ok"><CheckCircle2 size={16} /> Подтверждено {formatHours(app.hours)}</p>}
        {app.attended && app.hours === null && <p className="hint">Участие отмечено. Ожидается подтверждение часов организатором.</p>}
        {app.attended === false && <p className="muted small">Организатор отметил, что вы не участвовали.</p>}
        {(app.status === 'PENDING' || app.status === 'APPROVED') && app.attended === null && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancel}>Отменить заявку</button>
        )}
      </>
    );
  }

  return (
    <div className="container page">
      <Link to="/events" className="back"><ArrowLeft size={16} /> Назад к списку</Link>
      <div className="ev-top">
        <div className="ev-cover card">
          <EventCover category={event.category} imageUrl={event.imageUrl} alt={event.title} tall />
          <CategoryBadge category={event.category} />
        </div>

        <div className="ev-main">
          {event.status === 'HIDDEN' && <p className="badge bad">Скрыто модератором</p>}
          <h1>{event.title}</h1>
          <Link to={`/organizations/${event.organization.id}`} className="ev-org">
            <span className="org-mark">{event.organization.name[0]}</span>
            <span>
              <span className="muted small">Организатор</span><br />
              <strong>{event.organization.name}</strong><br />
              <StarRating value={event.organizationRating.average} count={event.organizationRating.count} size={13} />
            </span>
          </Link>
          <div className="facts">
            <span><CalendarDays size={18} /> {formatDate(event.date)}</span>
            {range && <span><Clock size={18} /> {range}</span>}
            <span className="full"><MapPin size={18} /> {event.city}{event.address && `, ${event.address}`}</span>
          </div>
          {maxHours && <p className="hours-note"><ShieldCheck size={18} /> Участие подтверждает до {formatHours(maxHours)} волонтёрских часов</p>}
          <div className="action card">{actionBlock()}</div>
        </div>
      </div>

      <div className="ev-details">
        <div className="stack">
          <section className="card card-pad">
            <h2 className="h">Описание</h2>
            <p className="pre">{event.description}</p>
            {requirements.length > 0 && (
              <>
                <h3 className="h sub">Что нужно для участия</h3>
                <ul className="req">{requirements.map((r) => <li key={r}>{r}</li>)}</ul>
              </>
            )}
          </section>

          <section className="card card-pad">
            <h2 className="h">Смены</h2>
            {!event.shifts.length ? (
              <p className="muted">Организатор ещё не добавил смены.</p>
            ) : (
              <ul className="shift-list">
                {event.shifts.map((s) => {
                  const full = (s.taken ?? 0) >= s.capacity;
                  return (
                    <li key={s.id} className={app?.shiftId === s.id ? 'mine' : ''}>
                      <div>
                        <strong>{formatShift(s)}</strong>
                        <p className="muted small">Занято {s.taken} из {s.capacity} · {formatHours(shiftHours(s))}</p>
                      </div>
                      {app?.shiftId === s.id ? (
                        <span className="badge ok">Ваша смена</span>
                      ) : activeApp ? (
                        <button className="btn btn-sm btn-soft" disabled={busy || full || new Date(s.startAt) < new Date()} onClick={() => chooseShift(s.id)}>
                          {full ? 'Мест нет' : app.shiftId ? 'Перейти' : 'Записаться'}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {app?.attended && !event.myReview && (
            <section className="card card-pad">
              <h2 className="h">Оставьте отзыв об организаторе</h2>
              <ReviewForm eventId={event.id} onDone={load} />
            </section>
          )}
          {event.myReview && (
            <section className="card card-pad">
              <h2 className="h">Ваш отзыв</h2>
              <StarRating value={event.myReview.rating} />
              <p className="pre" style={{ marginTop: 8 }}>{event.myReview.text}</p>
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="card card-pad">
            <h3 className="h">Свободные места</h3>
            <p className="places-big"><Users size={22} /> <strong>{event.freePlaces}</strong> из {event.limit}</p>
            <div className="progress"><i style={{ width: `${Math.min(100, (event.approvedCount / event.limit) * 100)}%` }} /></div>
            <p className="muted small" style={{ marginTop: 8 }}>
              {event.approvedCount} {plural(event.approvedCount, ['участник одобрен', 'участника одобрено', 'участников одобрено'])}
            </p>
          </section>
          {event.skills.length > 0 && (
            <section className="card card-pad">
              <h3 className="h">Необходимые навыки</h3>
              <div className="row">{event.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
            </section>
          )}
          <section className="note">
            <ShieldCheck size={22} />
            <p>После мероприятия организатор подтвердит ваше участие и начислит волонтёрские часы.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
