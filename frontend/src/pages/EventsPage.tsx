import { SearchX } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import type { EventItem, Paged } from '@/api/types';
import { Skeleton } from '@/components/Basics';
import { EventCard } from '@/components/EventCard';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { plural, todayInput } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

const KEYS = ['q', 'category', 'dateFrom', 'city', 'hasPlaces', 'sort'] as const;
type Filters = Record<(typeof KEYS)[number], string>;

export function EventsPage() {
  useTitle('Мероприятия');
  const [params, setParams] = useSearchParams();
  const fromParams = (): Filters => Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])) as Filters;
  const [filters, setFilters] = useState<Filters>(fromParams);
  const [cities, setCities] = useState<string[]>([]);
  const [items, setItems] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const paramsKey = params.toString();

  async function load(p: number, append: boolean) {
    setLoading(true);
    try {
      const query = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? undefined]));
      const res = await api<Paged<EventItem>>('/events', { query: { ...query, page: p, pageSize: 9 } });
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilters(fromParams());
    setPage(1);
    void load(1, false);
  }, [paramsKey]);

  useEffect(() => {
    api<{ cities: string[] }>('/events/meta').then((m) => setCities(m.cities));
  }, []);

  function apply(next: Filters) {
    const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'sort' && v === 'date')));
    setParams(clean, { replace: true });
  }

  function change(key: keyof Filters, value: string, immediate = true) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (immediate) apply(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    apply(filters);
  }

  function more() {
    setPage(page + 1);
    void load(page + 1, true);
  }

  const hasFilters = KEYS.some((k) => k !== 'sort' && params.get(k));

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Мероприятия</h1>
          <p className="muted">
            {!loading || items.length ? `Найдено ${total} ${plural(total, ['мероприятие', 'мероприятия', 'мероприятий'])}` : 'Загрузка…'}
          </p>
        </div>
        <label className="sort">
          <span className="sr-only">Сортировка</span>
          <select className="input" value={filters.sort || 'date'} onChange={(e) => change('sort', e.target.value)}>
            <option value="date">Сортировка: по дате</option>
            <option value="new">Сначала новые</option>
            <option value="places">Больше свободных мест</option>
          </select>
        </label>
      </div>

      <form className="filters card" onSubmit={submit}>
        <label className="field search-field">
          <span>Поиск</span>
          <input className="input" type="search" placeholder="Название или организация" value={filters.q} onChange={(e) => change('q', e.target.value, false)} />
        </label>
        <label className="field">
          <span>Направление</span>
          <select className="input" value={filters.category} onChange={(e) => change('category', e.target.value)}>
            <option value="">Все направления</option>
            {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Дата, с</span>
          <input className="input" type="date" min={todayInput()} value={filters.dateFrom} onChange={(e) => change('dateFrom', e.target.value)} />
        </label>
        <label className="field">
          <span>Город</span>
          <select className="input" value={filters.city} onChange={(e) => change('city', e.target.value)}>
            <option value="">Все города</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Свободные места</span>
          <select className="input" value={filters.hasPlaces} onChange={(e) => change('hasPlaces', e.target.value)}>
            <option value="">Не важно</option>
            <option value="true">Только со свободными</option>
          </select>
        </label>
        <div className="filters-actions">
          <button className="btn">Найти</button>
          {hasFilters && <button type="button" className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>Сбросить</button>}
        </div>
      </form>

      {loading && !items.length ? (
        <div className="grid-cards">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} height={330} />)}</div>
      ) : items.length ? (
        <div className="grid-cards">{items.map((e) => <EventCard key={e.id} event={e} />)}</div>
      ) : (
        <div className="empty card">
          <SearchX size={40} />
          <p><strong>Ничего не нашлось</strong></p>
          <p>Попробуйте изменить фильтры или выбрать другую дату.</p>
          {hasFilters && <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => setParams({}, { replace: true })}>Сбросить фильтры</button>}
        </div>
      )}

      {items.length < total && (
        <div className="load-more"><button className="btn btn-ghost" disabled={loading} onClick={more}>Показать ещё</button></div>
      )}
    </div>
  );
}
