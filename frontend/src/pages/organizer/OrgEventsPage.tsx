import { CalendarPlus, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { EventItem } from '@/api/types';
import { EventCover, Skeleton } from '@/components/Basics';
import { CATEGORIES } from '@/lib/categories';
import { formatDate, formatHours, timeRange } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

interface OrgEvent extends EventItem { pendingCount: number }
interface Stats { events: number; pendingApplications: number; volunteers: number; confirmedHours: number }

export function OrgEventsPage() {
  useTitle('Кабинет организатора');
  const [events, setEvents] = useState<OrgEvent[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<OrgEvent[]>('/organizer/events').then(setEvents);
    api<Stats>('/organizer/stats').then(setStats);
  }, []);

  return (
    <>
      {stats && (
        <div className="stats-row">
          <div className="card stat-tile"><p className="label">Мероприятий</p><p className="value">{stats.events}</p></div>
          <div className="card stat-tile"><p className="label">Новых заявок</p><p className="value">{stats.pendingApplications}</p></div>
          <div className="card stat-tile"><p className="label">Волонтёров участвовало</p><p className="value">{stats.volunteers}</p></div>
          <div className="card stat-tile"><p className="label">Подтверждено часов</p><p className="value">{formatHours(stats.confirmedHours)}</p></div>
        </div>
      )}
      <section className="card card-pad">
        <h2 className="card-title">Мои мероприятия</h2>
        {!events ? (
          <Skeleton height={240} />
        ) : !events.length ? (
          <div className="empty">
            <CalendarPlus size={38} />
            <p>У вас пока нет мероприятий.</p>
            <Link to="/organizer/events/new" className="btn" style={{ marginTop: 12 }}>Создать первое</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Название</th><th>Дата</th><th>Заявки</th><th style={{ minWidth: 150 }}>Участники</th><th /></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/organizer/events/${e.id}`} className="ev-name">
                        <EventCover category={e.category} imageUrl={e.imageUrl} className="thumb" compact />
                        <span>
                          <strong>{e.title}</strong>
                          <span className="muted small block">
                            {CATEGORIES[e.category].label}
                            {e.status === 'HIDDEN' && <> · <span className="badge bad">скрыто</span></>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="nowrap">{formatDate(e.date)}<span className="muted small block">{timeRange(e.shifts) ?? 'нет смен'}</span></td>
                    <td>{e.pendingCount ? <span className="badge warn">{e.pendingCount} новых</span> : <span className="muted small">—</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <div className="progress" style={{ flex: 1 }}><i style={{ width: `${(e.approvedCount / e.limit) * 100}%` }} /></div>
                        <span className="small nowrap">{e.approvedCount} / {e.limit}</span>
                      </div>
                    </td>
                    <td><Link to={`/organizer/events/${e.id}`} className="icon-btn" aria-label={`Управлять: ${e.title}`}><ChevronRight size={18} /></Link></td>
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
