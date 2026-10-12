import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { FieldError, Skeleton } from '@/components/Basics';
import { SkillsInput } from '@/components/SkillsInput';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { useForm } from '@/lib/useForm';
import { useTitle } from '@/lib/useTitle';

interface Profile { name: string; email: string; city: string | null; about: string | null; skills: string[] }

export function ProfilePage() {
  useTitle('Профиль');
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [form, setForm] = useState<{ name: string; city: string; about: string; skills: string[] } | null>(null);
  const { errors, error, busy, submit } = useForm();

  useEffect(() => {
    api<Profile>('/profile').then((p) => {
      setEmail(p.email);
      setForm({ name: p.name, city: p.city ?? '', about: p.about ?? '', skills: p.skills });
    });
  }, []);

  if (!form) return <section className="card card-pad"><Skeleton height={300} /></section>;

  async function save(e: FormEvent) {
    e.preventDefault();
    const p = await submit(() => api<Profile>('/profile', { method: 'PATCH', body: form }));
    if (p) {
      auth.setUserName(p.name);
      toast('Профиль сохранён');
    }
  }

  return (
    <section className="card card-pad">
      <h2 className="card-title">Профиль</h2>
      <form className="form-grid two" onSubmit={save}>
        <label className="field">
          <span>Имя и фамилия</span>
          <input className={`input ${errors.name ? 'has-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FieldError text={errors.name} />
        </label>
        <label className="field">
          <span>Email</span>
          <input className="input" value={email} disabled />
        </label>
        <label className="field">
          <span>Город</span>
          <input className={`input ${errors.city ? 'has-error' : ''}`} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <FieldError text={errors.city} />
        </label>
        <div className="field">
          <span>Навыки</span>
          <SkillsInput value={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
          <FieldError text={errors.skills} />
        </div>
        <label className="field span-2">
          <span>О себе</span>
          <textarea className="input" maxLength={1000} placeholder="Чем любите заниматься, какой есть опыт" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
          <FieldError text={errors.about} />
        </label>
        {error && <p className="form-error span-2">{error}</p>}
        <div><button className="btn" disabled={busy}>Сохранить</button></div>
      </form>
    </section>
  );
}
