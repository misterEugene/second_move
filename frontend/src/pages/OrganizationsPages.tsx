import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import type { EventItem, Rating, ReviewItem } from '@/api/types';
import { Skeleton, StarRating } from '@/components/Basics';
import { EventCard } from '@/components/EventCard';
import { formatDateTime, plural } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

interface Org { id: number; name: string; description: string; city: string | null; eventsCount: number; rating: Rating }
interface OrgDetails { id: number; name: string; description: string; city: string | null; rating: Rating; events: EventItem[]; reviews: ReviewItem[] }

export function OrganizationsPage() {
  useTitle('Организации');
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [q, setQ] = useState('');

  const load = (query = '') => api<Org[]>('/organizations', { query: { q: query.trim() } }).then(setOrgs);
  useEffect(() => {
    void load();
  }, []);

  function search(e: FormEvent) {
    e.preventDefault();
    void load(q);
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Организации</h1>
          <p className="muted">Фонды, центры и инициативные группы, которые проводят мероприятия</p>
        </div>
        <form className="row" role="search" onSubmit={search}>
          <label className="sr-only" htmlFor="org-q">Поиск организаций</label>
          <input id="org-q" className="input" type="search" placeholder="Название организации" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">Найти</button>
        </form>
      </div>
      {!orgs ? (
        <div className="grid-cards">{[1, 2, 3].map((i) => <Skeleton key={i} height={180} />)}</div>
      ) : orgs.length ? (
        <div className="grid-cards">
          {orgs.map((o) => (
            <Link key={o.id} to={`/organizations/${o.id}`} className="card card-pad org-card">
              <div className="row">
                <span className="org-icon"><Building2 size={22} /></span>
                <div>
                  <h3>{o.name}</h3>
                  <StarRating value={o.rating.average} count={o.rating.count} size={13} />
                </div>
              </div>
              <p className="clamp3 muted">{o.description || 'Описание пока не заполнено'}</p>
              <div className="row small muted">
                {o.city && <span className="row" style={{ gap: 4 }}><MapPin size={14} /> {o.city}</span>}
                <span className="spacer" />
                <span>{o.eventsCount} {plural(o.eventsCount, ['мероприятие', 'мероприятия', 'мероприятий'])}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty card">Организации не найдены.</p>
      )}
    </div>
  );
}

export function OrganizationPage() {
  const id = Number(useParams().id);
  const [org, setOrg] = useState<OrgDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  useTitle(org?.name);

  useEffect(() => {
    api<OrgDetails>(`/organizations/${id}`)
      .then(setOrg)
      .catch((e) => e instanceof ApiError && setNotFound(true));
  }, [id]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = org?.events.filter((e) => e.date.slice(0, 10) >= today).reverse() ?? [];
  const past = org?.events.filter((e) => e.date.slice(0, 10) < today) ?? [];

  return (
    <div className="container page">
      <Link to="/organizations" className="back"><ArrowLeft size={16} /> Все организации</Link>
      {notFound ? (
        <p className="empty card">Организация не найдена.</p>
      ) : !org ? (
        <Skeleton height={200} />
      ) : (
        <>
          <section className="card card-pad org-head">
            <span className="org-icon lg"><Building2 size={30} /></span>
            <div className="stack" style={{ gap: 8 }}>
              <h1>{org.name}</h1>
              <div className="row">
                <StarRating value={org.rating.average} count={org.rating.count} />
                {org.city && <span className="row muted" style={{ gap: 4 }}><MapPin size={15} /> {org.city}</span>}
              </div>
              <p className="muted pre">{org.description || 'Описание пока не заполнено'}</p>
            </div>
          </section>

          <h2 className="section-title">Ближайшие мероприятия</h2>
          {upcoming.length ? (
            <div className="grid-cards">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
          ) : (
            <p className="empty card">Сейчас нет запланированных мероприятий.</p>
          )}

          {past.length > 0 && (
            <>
              <h2 className="section-title">Прошедшие</h2>
              <div className="grid-cards">{past.map((e) => <EventCard key={e.id} event={e} />)}</div>
            </>
          )}

          <h2 className="section-title">Отзывы волонтёров</h2>
          {org.reviews.length ? (
            <div className="card card-pad">
              {org.reviews.map((r) => (
                <article key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 4 }}>
                    <div className="row"><strong>{r.author}</strong><StarRating value={r.rating} size={13} /></div>
                    <p>{r.text}</p>
                    <p className="muted small"><Link to={`/events/${r.event.id}`}>{r.event.title}</Link> · {formatDateTime(r.createdAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty card">Отзывов пока нет.</p>
          )}
        </>
      )}
    </div>
  );
}
