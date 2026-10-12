import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import type { Category, EventDetails } from '@/api/types';
import { FieldError, Skeleton } from '@/components/Basics';
import { SkillsInput } from '@/components/SkillsInput';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { todayInput } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useForm } from '@/lib/useForm';
import { useTitle } from '@/lib/useTitle';

const EMPTY = {
  title: '', category: '' as Category | '', date: '', city: '', address: '', limit: 10 as number | '',
  description: '', requirements: '', imageUrl: '', skills: [] as string[], organizationId: '' as number | '',
};

export function EventFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  useTitle(id ? 'Редактирование' : 'Новое мероприятие');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(!id);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const { errors, error, busy, submit } = useForm();

  useEffect(() => {
    if (isAdmin && !id) api<{ id: number; name: string }[]>('/admin/organizations').then(setOrgs);
    if (id) {
      api<EventDetails>(`/events/${id}`).then((e) => {
        setForm({
          ...EMPTY, title: e.title, category: e.category, date: e.date.slice(0, 10), city: e.city, address: e.address,
          limit: e.limit, description: e.description, requirements: e.requirements, imageUrl: e.imageUrl ?? '', skills: e.skills,
        });
        setLoaded(true);
      });
    }
  }, [id, isAdmin]);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      title: form.title, description: form.description, requirements: form.requirements, city: form.city,
      address: form.address, skills: form.skills, imageUrl: form.imageUrl.trim() || null,
    };
    // Пустые поля не отправляем — сервер вернёт понятную ошибку «Обязательное поле».
    if (form.category) body.category = form.category;
    if (form.date) body.date = form.date;
    if (form.limit !== '') body.limit = Number(form.limit);
    if (isAdmin && !id && form.organizationId !== '') body.organizationId = Number(form.organizationId);
    const res = await submit(() => api<EventDetails>(id ? `/events/${id}` : '/events', { method: id ? 'PATCH' : 'POST', body }));
    if (res) {
      toast(id ? 'Изменения сохранены' : 'Мероприятие создано. Добавьте смены.');
      navigate(`/organizer/events/${res.id}`);
    }
  }

  const cls = (key: string) => `input ${errors[key] ? 'has-error' : ''}`;

  return (
    <section className="card card-pad">
      <h2 className="card-title">{id ? 'Редактирование мероприятия' : 'Новое мероприятие'}</h2>
      {!loaded ? (
        <Skeleton height={400} />
      ) : (
        <form className="form-grid two" noValidate onSubmit={save}>
          {isAdmin && !id && (
            <label className="field span-2">
              <span>Организация</span>
              <select className={cls('organizationId')} value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">Выберите организацию</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <FieldError text={errors.organizationId} />
            </label>
          )}
          <label className="field span-2">
            <span>Название</span>
            <input className={cls('title')} maxLength={150} value={form.title} onChange={set('title')} />
            <FieldError text={errors.title} />
          </label>
          <label className="field">
            <span>Направление</span>
            <select className={cls('category')} value={form.category} onChange={set('category')}>
              <option value="">Выберите направление</option>
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
            </select>
            <FieldError text={errors.category} />
          </label>
          <label className="field">
            <span>Дата проведения</span>
            <input type="date" className={cls('date')} min={id ? undefined : todayInput()} value={form.date} onChange={set('date')} />
            <FieldError text={errors.date} />
          </label>
          <label className="field">
            <span>Город</span>
            <input className={cls('city')} value={form.city} onChange={set('city')} />
            <FieldError text={errors.city} />
          </label>
          <label className="field">
            <span>Адрес / место встречи</span>
            <input className={cls('address')} value={form.address} onChange={set('address')} />
            <FieldError text={errors.address} />
          </label>
          <label className="field">
            <span>Лимит участников</span>
            <input type="number" min={1} max={1000} className={cls('limit')} value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value === '' ? '' : Number(e.target.value) })} />
            <FieldError text={errors.limit} />
          </label>
          <label className="field">
            <span>Ссылка на фото (необязательно)</span>
            <input type="url" className={cls('imageUrl')} placeholder="https://…" value={form.imageUrl} onChange={set('imageUrl')} />
            <FieldError text={errors.imageUrl} />
          </label>
          <label className="field span-2">
            <span>Описание</span>
            <textarea className={cls('description')} rows={5} value={form.description} onChange={set('description')} />
            <FieldError text={errors.description} />
          </label>
          <label className="field span-2">
            <span>Что нужно для участия (каждый пункт с новой строки)</span>
            <textarea className={cls('requirements')} rows={3} value={form.requirements} onChange={set('requirements')} />
            <FieldError text={errors.requirements} />
          </label>
          <div className="field span-2">
            <span>Необходимые навыки</span>
            <SkillsInput value={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
            <FieldError text={errors.skills} />
          </div>
          {error && <p className="form-error span-2">{error}</p>}
          <div className="row span-2">
            <button className="btn" disabled={busy}>{id ? 'Сохранить' : 'Создать мероприятие'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Отмена</button>
          </div>
        </form>
      )}
    </section>
  );
}
