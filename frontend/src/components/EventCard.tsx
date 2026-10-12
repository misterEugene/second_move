import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { EventItem } from '@/api/types';
import { formatDate, plural, timeRange } from '@/lib/format';
import { CategoryBadge, EventCover } from './Basics';

export function EventCard({ event }: { event: EventItem }) {
  const range = timeRange(event.shifts);
  return (
    <article className="card event-card">
      <Link to={`/events/${event.id}`} className="stretch" aria-label={event.title} />
      <div className="event-card-media">
        <EventCover category={event.category} imageUrl={event.imageUrl} />
        <CategoryBadge category={event.category} className="event-card-cat" />
      </div>
      <div className="event-card-body">
        <h3>{event.title}</h3>
        <p className="muted small event-card-org">{event.organization.name}</p>
        <p className="meta"><CalendarDays size={16} /> {formatDate(event.date)}{range && `, ${range}`}</p>
        <p className="meta"><MapPin size={16} /> {event.city}{event.address && `, ${event.address}`}</p>
        <div className="places">
          <Users size={16} />
          {event.freePlaces ? (
            <span><strong>{event.freePlaces}</strong> {plural(event.freePlaces, ['место', 'места', 'мест'])} из {event.limit}</span>
          ) : (
            <span className="badge muted">Мест нет</span>
          )}
        </div>
      </div>
    </article>
  );
}
