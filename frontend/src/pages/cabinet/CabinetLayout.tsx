import { Award, Bell, ClipboardList, Clock, Home, User } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function CabinetLayout() {
  const { user, unread } = useAuth();
  return (
    <div className="container page">
      <h1 className="cabinet-title">Личный кабинет волонтёра</h1>
      <div className="cabinet">
        <nav className="card side-nav" aria-label="Разделы кабинета">
          <NavLink to="/cabinet" end><Home size={18} /> Главная</NavLink>
          <NavLink to="/cabinet/applications"><ClipboardList size={18} /> Мои заявки</NavLink>
          <NavLink to="/cabinet/hours"><Clock size={18} /> Мои часы</NavLink>
          <NavLink to="/cabinet/profile"><User size={18} /> Профиль</NavLink>
          <NavLink to="/notifications"><Bell size={18} /> Уведомления {unread > 0 && <span className="count">{unread}</span>}</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/admin"><Award size={18} /> Админ-панель</NavLink>}
        </nav>
        <div className="stack"><Outlet /></div>
      </div>
    </div>
  );
}
