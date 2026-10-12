import { ArrowLeft, Bell, Building2, CalendarRange, MessageSquareText, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '@/api/client';
import type { Rating } from '@/api/types';
import { StarRating } from '@/components/Basics';
import { useAuth } from '@/lib/auth';

interface Org { id: number; name: string; description: string; rating: Rating }

export function OrganizerLayout() {
  const { user, unread } = useAuth();
  const location = useLocation();
  const [org, setOrg] = useState<Org | null>(null);
  const isOrganizer = user?.role === 'ORGANIZER';

  useEffect(() => {
    if (isOrganizer) api<Org>('/organizer/organization').then(setOrg);
  }, [isOrganizer, location.pathname]);

  return (
    <div className="container page">
      <div className="page-head">
        <h1>{isOrganizer ? 'Личный кабинет организатора' : 'Управление мероприятием'}</h1>
        {isOrganizer && location.pathname !== '/organizer/events/new' && (
          <Link to="/organizer/events/new" className="btn"><Plus size={18} /> Создать мероприятие</Link>
        )}
      </div>

      {org && (
        <section className="card card-pad org-banner">
          <span className="org-icon"><Building2 size={26} /></span>
          <div className="spacer">
            <h2>{org.name}</h2>
            <p className="muted small clamp2">{org.description || 'Добавьте описание организации — его увидят волонтёры'}</p>
            <StarRating value={org.rating.average} count={org.rating.count} size={13} />
          </div>
          <Link to="/organizer/organization" className="btn btn-ghost btn-sm">Редактировать профиль</Link>
        </section>
      )}

      <div className="cabinet">
        <nav className="card side-nav" aria-label="Разделы кабинета">
          {isOrganizer ? (
            <>
              <NavLink to="/organizer" end className={location.pathname.startsWith('/organizer/events') ? 'active' : undefined}>
                <CalendarRange size={18} /> Мои мероприятия
              </NavLink>
              <NavLink to="/organizer/reviews"><MessageSquareText size={18} /> Отзывы</NavLink>
              <NavLink to="/organizer/organization"><Building2 size={18} /> Профиль организации</NavLink>
              <NavLink to="/notifications"><Bell size={18} /> Уведомления {unread > 0 && <span className="count">{unread}</span>}</NavLink>
            </>
          ) : (
            <Link to="/admin"><ArrowLeft size={18} /> Админ-панель</Link>
          )}
        </nav>
        <div className="stack"><Outlet /></div>
      </div>
    </div>
  );
}
