import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { Statistics } from '@/api/types';
import { CategoryBadge, Skeleton } from '@/components/Basics';
import { HoursDonut } from '@/components/HoursDonut';
import { formatDate, formatHours } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

export function HoursPage() {
  useTitle('Мои часы');
  const [stats, setStats] = useState<Statistics | null>(null);
  useEffect(() => {
    api<Statistics>('/profile/statistics').then(setStats);
  }, []);
  if (!stats) return <Skeleton height={300} />;

  return (
    <>
      <div className="stats-row">
        <div className="card stat-tile"><p className="label">Подтверждённые часы</p><p className="value">{formatHours(stats.totalHours)}</p></div>
        <div className="card stat-tile"><p className="label">Мероприятий</p><p className="value">{stats.eventsCount}</p></div>
        <div className="card stat-tile"><p className="label">Направлений</p><p className="value">{stats.byCategory.length}</p></div>
        <div className="card stat-tile"><p className="label">Одобренных заявок</p><p className="value">{stats.applications.APPROVED ?? 0}</p></div>
      </div>

      <section className="card card-pad">
        <h2 className="card-title">По направлениям</h2>
        {stats.totalHours ? <HoursDonut data={stats.byCategory} total={stats.totalHours} /> : <p className="muted">Пока нет подтверждённых часов.</p>}
      </section>

      <section className="card card-pad">
        <h2 className="card-title">История начислений</h2>
        {stats.history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Мероприятие</th><th>Направление</th><th>Дата</th><th style={{ textAlign: 'right' }}>Часы</th></tr></thead>
              <tbody>
                {stats.history.map((h) => (
                  <tr key={h.event.id}>
                    <td><Link to={`/events/${h.event.id}`}>{h.event.title}</Link></td>
                    <td><CategoryBadge category={h.event.category} /></td>
                    <td className="nowrap">{formatDate(h.event.date)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatHours(h.hours)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Начислений пока нет.</p>
        )}
        <p className="lock muted small"><Lock size={14} /> Часы начисляет только организатор мероприятия после отметки участия. Изменить их самостоятельно нельзя.</p>
      </section>
    </>
  );
}
