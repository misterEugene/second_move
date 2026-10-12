import { ArrowRight, CalendarCheck, CalendarDays, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { MyApplication, Statistics } from '@/api/types';
import { EventCover, Skeleton, StatusBadge, UserAvatar } from '@/components/Basics';
import { HoursDonut } from '@/components/HoursDonut';
import { ROLE_LABEL } from '@/lib/categories';
import { formatDate, formatHours, formatShift } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

interface Profile { name: string; role: 'VOLUNTEER' | 'ADMIN'; city: string | null; createdAt: string }

export function DashboardPage() {
  useTitle('Кабинет волонтёра');
  const [stats, setStats] = useState<Statistics | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recent, setRecent] = useState<MyApplication[]>([]);

  useEffect(() => {
    Promise.all([
      api<Statistics>('/profile/statistics'),
      api<Profile>('/profile'),
      api<MyApplication[]>('/applications/my'),
    ]).then(([s, p, apps]) => {
      setStats(s);
      setProfile(p);
      setRecent(apps.slice(0, 4));
    });
  }, []);

  if (!stats || !profile) return <Skeleton height={400} />;

  return (
    <>
      <div className="dash-top">
        <section className="card card-pad me">
          <UserAvatar name={profile.name} size={64} />
          <div>
            <h2>{profile.name}</h2>
            <p className="muted small row" style={{ gap: 6 }}><ShieldCheck size={15} /> {ROLE_LABEL[profile.role]}{profile.city && ` · ${profile.city}`}</p>
            <p className="muted small row" style={{ gap: 6 }}><CalendarDays size={15} /> Участник с {formatDate(profile.createdAt)}</p>
          </div>
        </section>
        <Link to="/cabinet/hours" className="card card-pad hours-tile">
          <span className="small">Подтверждённые часы</span>
          <strong>{formatHours(stats.totalHours)}</strong>
          <span className="small more">Вся статистика <ArrowRight size={14} /></span>
        </Link>
      </div>

      <section className="card card-pad">
        <div className="card-title">
          <h3>Ближайшие смены</h3>
          <Link to="/events" className="small">Найти мероприятие</Link>
        </div>
        {stats.upcoming.length ? (
          stats.upcoming.map((u) => (
            <Link key={u.applicationId} to={`/events/${u.event.id}`} className="list-row" style={{ color: 'var(--ink)' }}>
              <EventCover category={u.event.category} className="thumb" compact />
              <div className="spacer">
                <strong>{u.event.title}</strong>
                <p className="muted small">{formatShift(u.shift)} · {u.event.city}</p>
              </div>
              <span className="badge ok">Записан</span>
            </Link>
          ))
        ) : (
          <p className="muted"><CalendarCheck size={16} style={{ verticalAlign: -3 }} /> Нет предстоящих смен. Одобренные заявки появятся здесь после выбора смены.</p>
        )}
      </section>

      <div className="dash-two">
        <section className="card card-pad">
          <h3 className="card-title">Статистика</h3>
          {stats.totalHours ? (
            <HoursDonut data={stats.byCategory} total={stats.totalHours} />
          ) : (
            <p className="muted">Часы появятся после того, как организатор подтвердит ваше участие.</p>
          )}
        </section>
        <section className="card card-pad">
          <div className="card-title"><h3>Мои заявки</h3><Link to="/cabinet/applications" className="small">Все</Link></div>
          {(['APPROVED', 'PENDING', 'REJECTED'] as const).map((s) => (
            <div key={s} className="list-row">
              <StatusBadge status={s} />
              <span className="spacer" />
              <strong>{stats.applications[s] ?? 0}</strong>
            </div>
          ))}
          {recent.length > 0 && (
            <>
              <p className="muted small" style={{ marginTop: 12 }}>Последние:</p>
              {recent.map((a) => <Link key={a.id} to={`/events/${a.event.id}`} className="recent small">{a.event.title}</Link>)}
            </>
          )}
        </section>
      </div>
    </>
  );
}
