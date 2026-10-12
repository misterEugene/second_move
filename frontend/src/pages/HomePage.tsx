import { ArrowRight, Clock, HeartHandshake, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import type { Category, EventItem, Paged } from '@/api/types';
import { Skeleton } from '@/components/Basics';
import { EventCard } from '@/components/EventCard';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { plural } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

export function HomePage() {
  useTitle('Делай добро рядом');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<Category, number>>>({});

  useEffect(() => {
    api<Paged<EventItem>>('/events', { query: { pageSize: 6 } }).then((r) => setEvents(r.items));
    api<{ categories: { category: Category; count: number }[] }>('/events/meta').then((m) =>
      setCounts(Object.fromEntries(m.categories.map((c) => [c.category, c.count]))),
    );
  }, []);

  function search(e: FormEvent) {
    e.preventDefault();
    navigate(q.trim() ? `/events?q=${encodeURIComponent(q.trim())}` : '/events');
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">Волонтёрство начинается с тебя</p>
            <h1>Делай добро рядом</h1>
            <p className="lead">Находи актуальные волонтёрские мероприятия, помогай людям, развивайся и получай подтверждённые часы.</p>
            <form className="hero-search card" role="search" onSubmit={search}>
              <Search size={20} className="muted" aria-hidden="true" />
              <label htmlFor="hero-q" className="sr-only">Поиск мероприятий</label>
              <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск мероприятий, организаций…" />
              <button className="btn">Найти</button>
            </form>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-bubble"><HeartHandshake size={34} /></div>
            <div className="art-card art-c1 card">
              <span className="badge ok">Подтверждено</span>
              <strong>+4 часа</strong>
              <span className="muted small">Субботник в парке</span>
            </div>
            <div className="art-card art-c2 card">
              <span className="muted small">Ваши часы</span>
              <strong className="art-big">18,5 ч</strong>
              <div className="progress"><i style={{ width: '72%' }} /></div>
            </div>
            <p className="art-script">Вместе мы можем больше</p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Популярные направления</h2>
          <Link to="/events" className="more">Все мероприятия <ArrowRight size={16} /></Link>
        </div>
        <div className="cats">
          {CATEGORY_ORDER.map((c) => {
            const meta = CATEGORIES[c];
            const Icon = meta.icon;
            const n = counts[c] ?? 0;
            return (
              <Link key={c} to={`/events?category=${c}`} className="cat card" style={{ background: `linear-gradient(180deg, ${meta.tint}, #fff 70%)` }}>
                <span className="cat-icon" style={{ color: meta.color }}><Icon size={24} /></span>
                <strong>{meta.label}</strong>
                <span className="muted small">{n} {plural(n, ['событие', 'события', 'событий'])}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Ближайшие мероприятия</h2>
          <Link to="/events" className="more">Смотреть все <ArrowRight size={16} /></Link>
        </div>
        {!events ? (
          <div className="grid-cards">{[1, 2, 3].map((i) => <Skeleton key={i} height={320} />)}</div>
        ) : events.length ? (
          <div className="grid-cards">{events.map((e) => <EventCard key={e.id} event={e} />)}</div>
        ) : (
          <p className="empty card">Скоро здесь появятся новые мероприятия.</p>
        )}
      </section>

      <section className="container section">
        <div className="how">
          <div className="how-item"><Search size={22} /><div><h3>Найдите дело по душе</h3><p className="muted">Фильтры по направлению, дате, городу и свободным местам.</p></div></div>
          <div className="how-item"><Clock size={22} /><div><h3>Выберите удобную смену</h3><p className="muted">После одобрения заявки запишитесь на подходящее время.</p></div></div>
          <div className="how-item"><ShieldCheck size={22} /><div><h3>Получите часы</h3><p className="muted">Организатор подтверждает участие — часы попадают в вашу статистику.</p></div></div>
        </div>
      </section>
    </>
  );
}
