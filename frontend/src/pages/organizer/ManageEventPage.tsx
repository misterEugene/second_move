import { CalendarDays, Check, ExternalLink, Info, MapPin, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import type { EventApplication, EventDetails } from '@/api/types';
import { CategoryBadge, FieldError, Skeleton, StatusBadge } from '@/components/Basics';
import { formatDate, formatDateTime, formatHours, formatShift, shiftHours, shiftHoursLimit } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useForm } from '@/lib/useForm';
import { useTitle } from '@/lib/useTitle';

type Filter = 'ALL' | 'PENDING' | 'APPROVED';
interface HoursValue { h: string; m: string }

const MINUTES = ['0', '15', '30', '45'];
const toHours = (v: HoursValue) => Number(v.h || 0) + Number(v.m) / 60;

function defaultHours(a: EventApplication): HoursValue {
  const total = a.shift ? shiftHoursLimit(a.shift) : 2;
  return { h: String(Math.floor(total)), m: String(Math.round((total % 1) * 60)) };
}

export function ManageEventPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [apps, setApps] = useState<EventApplication[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [hoursInput, setHoursInput] = useState<Record<number, HoursValue>>({});
  const [shiftForm, setShiftForm] = useState({ date: '', start: '10:00', end: '14:00', capacity: '10' });
  const shiftState = useForm();
  useTitle(event ? `Управление: ${event.title}` : 'Управление мероприятием');

  const load = useCallback(async () => {
    let e: EventDetails, a: EventApplication[];
    try {
      [e, a] = await Promise.all([
        api<EventDetails>(`/events/${id}`),
        api<EventApplication[]>(`/events/${id}/applications`),
      ]);
    } catch (err) {
      if (err instanceof ApiError && [400, 403, 404].includes(err.status)) {
        setLoadError(err.status === 403 ? 'Это мероприятие другой организации — управлять им нельзя.' : 'Возможно, оно было удалено.');
        return;
      }
      throw err;
    }
    setEvent(e);
    setApps(a);
    setHoursInput((prev) => {
      const next = { ...prev };
      for (const app of a) if (app.status === 'APPROVED' && next[app.id] === undefined) next[app.id] = defaultHours(app);
      return next;
    });
    setShiftForm((f) => (f.date ? f : { ...f, date: e.date.slice(0, 10), capacity: String(Math.min(10, e.limit)) }));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(key: number, fn: () => Promise<unknown>, success: string) {
    setBusyId(key);
    try {
      await fn();
      toast(success);
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не удалось выполнить действие', 'bad');
    } finally {
      setBusyId(null);
    }
  }

  const setStatus = (a: EventApplication, status: 'APPROVED' | 'REJECTED') =>
    act(a.id, () => api(`/applications/${a.id}`, { method: 'PATCH', body: { status } }), status === 'APPROVED' ? 'Заявка одобрена' : 'Заявка отклонена');
  const mark = (a: EventApplication, attended: boolean) =>
    act(a.id, () => api(`/participations/${a.id}`, { method: 'POST', body: { attended } }), attended ? 'Участие отмечено' : 'Отмечено отсутствие');

  function confirmHours(a: EventApplication) {
    const hours = toHours(hoursInput[a.id] ?? defaultHours(a));
    if (hours <= 0) {
      toast('Укажите, сколько времени волонтёр отработал', 'bad');
      return;
    }
    if (!confirm(`Засчитать ${a.volunteer.name} ${formatHours(hours)}? Изменить это будет нельзя.`)) return;
    void act(
      a.id,
      async () => {
        let participationId = a.participation?.id;
        if (!a.participation?.attended) {
          const p = await api<{ id: number }>(`/participations/${a.id}`, { method: 'POST', body: { attended: true } });
          participationId = p.id;
        }
        await api(`/hours/${participationId}/confirm`, { method: 'POST', body: { hours } });
      },
      'Часы засчитаны',
    );
  }

  function hoursField(a: EventApplication) {
    const value = hoursInput[a.id] ?? defaultHours(a);
    const set = (patch: Partial<HoursValue>) => setHoursInput({ ...hoursInput, [a.id]: { ...value, ...patch } });
    return (
      <span className="hours-field">
        <label>
          <span className="sr-only">Часы для {a.volunteer.name}</span>
          <input type="number" min={0} max={24} step={1} className="input" value={value.h} onChange={(e) => set({ h: e.target.value })} />
        </label>
        <span className="small">ч</span>
        <label>
          <span className="sr-only">Минуты для {a.volunteer.name}</span>
          <select className="input" value={value.m} onChange={(e) => set({ m: e.target.value })}>
            {MINUTES.map((m) => <option key={m} value={m}>{m.padStart(2, '0')}</option>)}
          </select>
        </label>
        <span className="small">мин</span>
      </span>
    );
  }

  async function addShift(e: FormEvent) {
    e.preventDefault();
    const toIso = (t: string) => new Date(`${shiftForm.date}T${t}`).toISOString();
    const ok = await shiftState.submit(() =>
      api(`/events/${id}/shifts`, {
        method: 'POST',
        body: { startAt: toIso(shiftForm.start), endAt: toIso(shiftForm.end), capacity: Number(shiftForm.capacity) },
      }),
    );
    if (ok) {
      toast('Смена добавлена');
      await load();
    }
  }

  async function removeEvent() {
    if (!event || !confirm(`Удалить мероприятие «${event.title}»? Действие необратимо.`)) return;
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      toast('Мероприятие удалено');
      navigate('/organizer');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не удалось удалить', 'bad');
    }
  }

  if (loadError) {
    return (
      <div className="empty card">
        <p><strong>Мероприятие недоступно</strong></p>
        <p>{loadError}</p>
        <Link to="/organizer" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>К моим мероприятиям</Link>
      </div>
    );
  }
  if (!event) return <Skeleton height={420} />;

  const shown = apps.filter((a) => filter === 'ALL' || a.status === filter);
  const pendingCount = apps.filter((a) => a.status === 'PENDING').length;
  const full = event.freePlaces <= 0;

  function actions(a: EventApplication) {
    const p = a.participation;
    const busy = busyId === a.id;
    if (a.status === 'PENDING' || (a.status === 'REJECTED' && !p)) {
      return (
        <>
          <button className="btn btn-sm" disabled={busy || full} title={full ? 'Достигнут лимит участников' : ''} onClick={() => setStatus(a, 'APPROVED')}><Check size={15} /> Одобрить</button>
          {a.status === 'PENDING' && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setStatus(a, 'REJECTED')}><X size={15} /> Отклонить</button>}
        </>
      );
    }
    if (a.status === 'APPROVED' && !p) {
      return (
        <>
          {hoursField(a)}
          <button className="btn btn-sm" disabled={busy} onClick={() => confirmHours(a)}><Check size={15} /> Засчитать часы</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => mark(a, false)}>Не пришёл</button>
        </>
      );
    }
    if (p && !p.attended) {
      return (
        <>
          <span className="badge muted">Не участвовал</span>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => mark(a, true)}>Отметить участие</button>
        </>
      );
    }
    if (p && p.hours === null) {
      return (
        <>
          <span className="badge muted">Участие отмечено</span>
          {hoursField(a)}
          <button className="btn btn-sm" disabled={busy} onClick={() => confirmHours(a)}><Check size={15} /> Засчитать часы</button>
        </>
      );
    }
    if (p) return <span className="badge ok"><Check size={14} /> {formatHours(p.hours!)} подтверждено</span>;
    return null;
  }

  return (
    <>
      <section className="card card-pad">
        <div className="manage-head">
          <div className="stack" style={{ gap: 8 }}>
            <div className="row">
              <CategoryBadge category={event.category} />
              {event.status === 'HIDDEN' && <span className="badge bad">Скрыто модератором</span>}
            </div>
            <h2>{event.title}</h2>
            <p className="row muted small" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 5 }}><CalendarDays size={15} /> {formatDate(event.date)}</span>
              <span className="row" style={{ gap: 5 }}><MapPin size={15} /> {event.city}{event.address && `, ${event.address}`}</span>
              <span className="row" style={{ gap: 5 }}><Users size={15} /> одобрено {event.approvedCount} из {event.limit}</span>
            </p>
          </div>
          <div className="row">
            <Link to={`/events/${event.id}`} className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Страница</Link>
            <Link to={`/organizer/events/${event.id}/edit`} className="btn btn-ghost btn-sm"><Pencil size={15} /> Изменить</Link>
            <button className="btn btn-danger btn-sm" onClick={removeEvent}><Trash2 size={15} /> Удалить</button>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 16 }}><i style={{ width: `${(event.approvedCount / event.limit) * 100}%` }} /></div>
      </section>

      <section className="card card-pad">
        <h3 className="card-title">Смены</h3>
        {event.shifts.length ? (
          <ul className="shift-list" style={{ marginBottom: 16 }}>
            {event.shifts.map((s) => (
              <li key={s.id}>
                <span><strong>{formatShift(s)}</strong> <span className="muted small">· {formatHours(shiftHours(s))}</span></span>
                <span className="spacer" />
                <span className="small">Записано {s.taken} / {s.capacity}</span>
                <button
                  className="icon-btn"
                  disabled={busyId === -s.id || !!s.taken}
                  title={s.taken ? 'На смену уже записаны волонтёры' : 'Удалить смену'}
                  aria-label="Удалить смену"
                  onClick={() => act(-s.id, () => api(`/shifts/${s.id}`, { method: 'DELETE' }), 'Смена удалена')}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ marginBottom: 14 }}>Добавьте хотя бы одну смену — после одобрения волонтёры запишутся на неё.</p>
        )}
        <form className="shift-form" noValidate onSubmit={addShift}>
          <label className="field"><span>Дата</span><input type="date" className="input" value={shiftForm.date} onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })} /></label>
          <label className="field">
            <span>Начало</span>
            <input type="time" className={`input ${shiftState.errors.startAt ? 'has-error' : ''}`} value={shiftForm.start} onChange={(e) => setShiftForm({ ...shiftForm, start: e.target.value })} />
            <FieldError text={shiftState.errors.startAt} />
          </label>
          <label className="field">
            <span>Окончание</span>
            <input type="time" className={`input ${shiftState.errors.endAt ? 'has-error' : ''}`} value={shiftForm.end} onChange={(e) => setShiftForm({ ...shiftForm, end: e.target.value })} />
            <FieldError text={shiftState.errors.endAt} />
          </label>
          <label className="field">
            <span>Мест</span>
            <input type="number" min={1} max={event.limit} className={`input ${shiftState.errors.capacity ? 'has-error' : ''}`} value={shiftForm.capacity} onChange={(e) => setShiftForm({ ...shiftForm, capacity: e.target.value })} />
            <FieldError text={shiftState.errors.capacity} />
          </label>
          <button className="btn btn-soft" disabled={shiftState.busy}><Plus size={16} /> Добавить смену</button>
        </form>
        {shiftState.error && <p className="form-error" style={{ marginTop: 10 }}>{shiftState.error}</p>}
      </section>

      <section className="card card-pad">
        <div className="card-title">
          <h3>Заявки и участники</h3>
          <div className="pill-tabs">
            <button className={filter === 'ALL' ? 'on' : ''} onClick={() => setFilter('ALL')}>Все ({apps.length})</button>
            <button className={filter === 'PENDING' ? 'on' : ''} onClick={() => setFilter('PENDING')}>Ожидают ({pendingCount})</button>
            <button className={filter === 'APPROVED' ? 'on' : ''} onClick={() => setFilter('APPROVED')}>Одобренные</button>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 14 }}>
          <Info size={16} /> Когда смена прошла, укажите для каждого одобренного участника, сколько он отработал, и нажмите «Засчитать часы».
          Часы появятся в личном кабинете волонтёра. Если человек не пришёл — «Не пришёл».
        </p>
        {!shown.length ? (
          <p className="muted">Заявок нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Участник</th><th>Заявка</th><th>Смена</th><th>Статус</th><th>Действия</th></tr></thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.volunteer.name}</strong>
                      <span className="muted small block">{a.volunteer.email}</span>
                      {a.message && <span className="small block msg">«{a.message}»</span>}
                    </td>
                    <td className="nowrap small">{formatDateTime(a.createdAt)}</td>
                    <td className="small">{a.shift ? formatShift(a.shift) : '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td><div className="acts">{actions(a)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
