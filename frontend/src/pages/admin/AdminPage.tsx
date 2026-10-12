import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import type { Category, Role } from '@/api/types';
import { CategoryBadge, StarRating } from '@/components/Basics';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/categories';
import { formatDate, formatDateTime, formatHours } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useTitle } from '@/lib/useTitle';

type Tab = 'overview' | 'users' | 'organizations' | 'events' | 'reviews';
interface Stats { users: Partial<Record<Role, number>>; organizations: number; events: number; pendingApplications: number; confirmedHours: number; reviews: number }
interface AdminUser { id: number; name: string; email: string; role: Role; blocked: boolean; createdAt: string; organization: { id: number; name: string } | null }
interface AdminOrg { id: number; name: string; city: string | null; owner: { name: string; email: string; blocked: boolean }; eventsCount: number }
interface AdminEvent { id: number; title: string; date: string; city: string; category: Category; status: 'PUBLISHED' | 'HIDDEN'; limit: number; organization: { name: string }; applicationsCount: number }
interface AdminReview { id: number; rating: number; text: string; hidden: boolean; createdAt: string; volunteer: { name: string }; event: { id: number; title: string; organization: { name: string } } }

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'users', label: 'Пользователи' },
  { id: 'organizations', label: 'Организации' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'reviews', label: 'Отзывы' },
];

export function AdminPage() {
  useTitle('Администрирование');
  const { user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);

  const load = useCallback(async (t: Tab, query = '') => {
    const qs = { q: query.trim() };
    if (t === 'overview') setStats(await api<Stats>('/admin/stats'));
    if (t === 'users') setUsers(await api<AdminUser[]>('/admin/users', { query: qs }));
    if (t === 'organizations') setOrgs(await api<AdminOrg[]>('/admin/organizations'));
    if (t === 'events') setEvents(await api<AdminEvent[]>('/admin/events', { query: qs }));
    if (t === 'reviews') setReviews(await api<AdminReview[]>('/admin/reviews'));
  }, []);

  useEffect(() => {
    setQ('');
    void load(tab);
  }, [tab, load]);

  async function act(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      toast(success);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Ошибка', 'bad');
    }
    await load(tab, q);
  }

  function search(e: FormEvent) {
    e.preventDefault();
    void load(tab, q);
  }

  const patch = (path: string, body: unknown) => () => api(path, { method: 'PATCH', body });

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Администрирование</h1>
        <Link to="/organizer/events/new" className="btn btn-ghost btn-sm">Создать мероприятие</Link>
      </div>
      <div className="admin-tabs card" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' ? (
        stats && (
          <>
            <div className="stats-row">
              <div className="card stat-tile"><p className="label">Волонтёров</p><p className="value">{stats.users.VOLUNTEER ?? 0}</p></div>
              <div className="card stat-tile"><p className="label">Организаторов</p><p className="value">{stats.users.ORGANIZER ?? 0}</p></div>
              <div className="card stat-tile"><p className="label">Мероприятий</p><p className="value">{stats.events}</p></div>
              <div className="card stat-tile"><p className="label">Подтверждено часов</p><p className="value">{formatHours(stats.confirmedHours)}</p></div>
            </div>
            <div className="stats-row" style={{ marginTop: 14 }}>
              <div className="card stat-tile"><p className="label">Организаций</p><p className="value">{stats.organizations}</p></div>
              <div className="card stat-tile"><p className="label">Заявок ждут решения</p><p className="value">{stats.pendingApplications}</p></div>
              <div className="card stat-tile"><p className="label">Отзывов</p><p className="value">{stats.reviews}</p></div>
              <div className="card stat-tile"><p className="label">Администраторов</p><p className="value">{stats.users.ADMIN ?? 0}</p></div>
            </div>
          </>
        )
      ) : (
        <section className="card card-pad">
          {(tab === 'users' || tab === 'events') && (
            <form className="row admin-search" role="search" onSubmit={search}>
              <input className="input" type="search" aria-label="Поиск" placeholder={tab === 'users' ? 'Имя или email' : 'Название мероприятия'} value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn-soft">Найти</button>
            </form>
          )}

          {tab === 'users' && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Пользователь</th><th>Роль</th><th>Регистрация</th><th>Статус</th><th /></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong><span className="muted small block">{u.email}{u.organization && ` · ${u.organization.name}`}</span></td>
                      <td>
                        <select className="input sm" value={u.role} disabled={u.id === me?.id} aria-label={`Роль ${u.name}`}
                          onChange={(e) => act(patch(`/admin/users/${u.id}`, { role: e.target.value }), 'Роль изменена')}>
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </td>
                      <td className="small nowrap">{formatDate(u.createdAt)}</td>
                      <td><span className={`badge ${u.blocked ? 'bad' : 'ok'}`}>{u.blocked ? 'Заблокирован' : 'Активен'}</span></td>
                      <td>
                        {u.id !== me?.id && (
                          <button className={`btn btn-sm ${u.blocked ? 'btn-ghost' : 'btn-danger'}`}
                            onClick={() => act(patch(`/admin/users/${u.id}`, { blocked: !u.blocked }), u.blocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован')}>
                            {u.blocked ? 'Разблокировать' : 'Заблокировать'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'organizations' && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Организация</th><th>Владелец</th><th>Город</th><th>Мероприятий</th></tr></thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id}>
                      <td><Link to={`/organizations/${o.id}`}><strong>{o.name}</strong></Link></td>
                      <td>{o.owner.name}<span className="muted small block">{o.owner.email}</span>{o.owner.blocked && <span className="badge bad">заблокирован</span>}</td>
                      <td>{o.city ?? '—'}</td>
                      <td>{o.eventsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'events' && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Мероприятие</th><th>Направление</th><th>Дата</th><th>Заявок</th><th>Статус</th><th /></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td><Link to={`/organizer/events/${e.id}`}><strong>{e.title}</strong></Link><span className="muted small block">{e.organization.name} · {e.city}</span></td>
                      <td><CategoryBadge category={e.category} /></td>
                      <td className="small nowrap">{formatDate(e.date)}</td>
                      <td>{e.applicationsCount} / {e.limit}</td>
                      <td><span className={`badge ${e.status === 'HIDDEN' ? 'bad' : 'ok'}`}>{e.status === 'HIDDEN' ? 'Скрыто' : 'Опубликовано'}</span></td>
                      <td>
                        <button className={`btn btn-sm ${e.status === 'HIDDEN' ? 'btn-ghost' : 'btn-danger'}`}
                          onClick={() => act(patch(`/admin/events/${e.id}`, { status: e.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN' }), e.status === 'HIDDEN' ? 'Мероприятие опубликовано' : 'Мероприятие скрыто')}>
                          {e.status === 'HIDDEN' ? 'Опубликовать' : 'Скрыть'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reviews' && (
            <div>
              {!reviews.length && <p className="muted">Отзывов нет.</p>}
              {reviews.map((r) => (
                <article key={r.id} className={`list-row ${r.hidden ? 'faded' : ''}`} style={{ alignItems: 'flex-start' }}>
                  <div className="stack spacer" style={{ gap: 4 }}>
                    <div className="row"><strong>{r.volunteer.name}</strong><StarRating value={r.rating} size={13} />{r.hidden && <span className="badge bad">Скрыт</span>}</div>
                    <p>{r.text}</p>
                    <p className="muted small">{r.event.organization.name} · <Link to={`/events/${r.event.id}`}>{r.event.title}</Link> · {formatDateTime(r.createdAt)}</p>
                  </div>
                  <button className={`btn btn-sm ${r.hidden ? 'btn-ghost' : 'btn-danger'}`}
                    onClick={() => act(patch(`/admin/reviews/${r.id}`, { hidden: !r.hidden }), r.hidden ? 'Отзыв опубликован' : 'Отзыв скрыт')}>
                    {r.hidden ? 'Показать' : 'Скрыть'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
