import { Bell, ChevronDown, LogOut, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL } from '@/lib/categories';
import { useAuth } from '@/lib/auth';
import { ToastHost } from '@/lib/toast';
import { AppLogo, UserAvatar } from './Basics';

function AppHeader() {
  const auth = useAuth();
  const { user } = auth;
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    void auth.refreshUnread();
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const links = [
    { to: '/events', label: 'Мероприятия' },
    { to: '/organizations', label: 'Организации' },
  ];
  if (!user || user.role === 'VOLUNTEER') links.push({ to: '/cabinet/applications', label: 'Мои заявки' });
  if (user?.role === 'VOLUNTEER') links.push({ to: '/cabinet/hours', label: 'Мои часы' });
  if (user?.role === 'ORGANIZER') links.push({ to: '/organizer', label: 'Мои мероприятия' });
  if (user?.role === 'ADMIN') links.push({ to: '/admin', label: 'Администрирование' });

  function logout() {
    auth.logout();
    navigate('/');
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <AppLogo />
        <nav className="nav" aria-label="Основное меню">
          {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
        </nav>
        <div className="spacer" />
        <Link to="/events" className="icon-btn hide-sm" aria-label="Поиск мероприятий"><Search size={20} /></Link>
        {user ? (
          <>
            <Link to="/notifications" className="icon-btn" aria-label="Уведомления">
              <Bell size={20} />
              {auth.unread > 0 && <span className="dot">{auth.unread > 9 ? '9+' : auth.unread}</span>}
            </Link>
            <div className="user-menu hide-sm" onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}>
              <button className="user-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                <UserAvatar name={user.name} size={34} />
                <ChevronDown size={16} />
              </button>
              {menuOpen && (
                <div className="menu card" role="menu">
                  <div className="menu-head">
                    <strong>{user.name}</strong>
                    <span className="muted small">{ROLE_LABEL[user.role]}</span>
                  </div>
                  <Link to={auth.homePath} role="menuitem">Личный кабинет</Link>
                  {user.role !== 'ORGANIZER' && <Link to="/cabinet/profile" role="menuitem">Профиль</Link>}
                  {user.role === 'ORGANIZER' && <Link to="/organizer/organization" role="menuitem">Профиль организации</Link>}
                  <button role="menuitem" onClick={logout}><LogOut size={16} /> Выйти</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm hide-sm">Войти</Link>
            <Link to="/register" className="btn btn-sm hide-sm">Регистрация</Link>
          </>
        )}
        <button className="icon-btn burger" aria-expanded={mobileOpen} aria-controls="mobile-nav" aria-label="Меню" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {mobileOpen && (
        <nav id="mobile-nav" className="mobile-nav container" aria-label="Мобильное меню">
          {links.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          {user ? (
            <>
              <Link to={auth.homePath}>Личный кабинет</Link>
              <button onClick={logout}>Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register">Регистрация</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-about">
          <AppLogo />
          <p className="muted small">Платформа поиска и организации волонтёрских мероприятий. Учебный проект, 2026.</p>
        </div>
        <nav className="footer-links" aria-label="Ссылки в подвале">
          <Link to="/events">Мероприятия</Link>
          <Link to="/organizations">Организации</Link>
          <Link to="/register">Стать волонтёром</Link>
          <a href="/api/docs" target="_blank" rel="noopener">API</a>
        </nav>
      </div>
    </footer>
  );
}

export function AppLayout() {
  return (
    <>
      <AppHeader />
      <main id="main"><Outlet /></main>
      <AppFooter />
      <ToastHost />
    </>
  );
}
