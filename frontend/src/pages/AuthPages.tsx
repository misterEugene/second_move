import { Building2, HandHeart } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FieldError } from '@/components/Basics';
import { homeFor, useAuth } from '@/lib/auth';
import { useForm } from '@/lib/useForm';
import { useTitle } from '@/lib/useTitle';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  useTitle(title);
  return (
    <div className="container page auth">
      <div className="card card-pad auth-box">
        <h1>{title}</h1>
        <p className="muted auth-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function useAfterAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  return {
    query: params.toString() ? `?${params.toString()}` : '',
    go: (user: Parameters<typeof homeFor>[0]) => navigate(redirect && redirect.startsWith('/') ? redirect : homeFor(user), { replace: true }),
  };
}

export function LoginPage() {
  const auth = useAuth();
  const after = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { errors, error, busy, submit } = useForm();

  async function login(e: FormEvent) {
    e.preventDefault();
    const user = await submit(() => auth.login(email, password));
    if (user) after.go(user);
  }

  return (
    <AuthShell title="Вход" subtitle="Рады видеть вас снова">
      <form className="stack" noValidate onSubmit={login}>
        <label className="field">
          <span>Email</span>
          <input className={`input ${errors.email ? 'has-error' : ''}`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError text={errors.email} />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input className={`input ${errors.password ? 'has-error' : ''}`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FieldError text={errors.password} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-lg btn-block" disabled={busy}>Войти</button>
        <p className="muted small center">Нет аккаунта? <Link to={`/register${after.query}`}>Зарегистрироваться</Link></p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const auth = useAuth();
  const after = useAfterAuth();
  const [form, setForm] = useState({ role: 'VOLUNTEER', name: '', email: '', password: '', city: '', organizationName: '' });
  const { errors, error, busy, submit } = useForm();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function register(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { role: form.role, name: form.name, email: form.email, password: form.password };
    if (form.city.trim()) body.city = form.city;
    if (form.role === 'ORGANIZER') body.organizationName = form.organizationName;
    const user = await submit(() => auth.register(body));
    if (user) after.go(user);
  }

  return (
    <AuthShell title="Регистрация" subtitle="Создайте аккаунт за минуту">
      <form className="stack" noValidate onSubmit={register}>
        <div className="roles" role="radiogroup" aria-label="Тип аккаунта">
          <label className={form.role === 'VOLUNTEER' ? 'on' : ''}>
            <input type="radio" value="VOLUNTEER" className="sr-only" checked={form.role === 'VOLUNTEER'} onChange={set('role')} />
            <HandHeart size={22} /> <strong>Я волонтёр</strong>
            <span className="small muted">Ищу мероприятия</span>
          </label>
          <label className={form.role === 'ORGANIZER' ? 'on' : ''}>
            <input type="radio" value="ORGANIZER" className="sr-only" checked={form.role === 'ORGANIZER'} onChange={set('role')} />
            <Building2 size={22} /> <strong>Я организатор</strong>
            <span className="small muted">Провожу мероприятия</span>
          </label>
        </div>
        <label className="field">
          <span>Имя и фамилия</span>
          <input className={`input ${errors.name ? 'has-error' : ''}`} autoComplete="name" value={form.name} onChange={set('name')} />
          <FieldError text={errors.name} />
        </label>
        {form.role === 'ORGANIZER' && (
          <label className="field">
            <span>Название организации</span>
            <input className={`input ${errors.organizationName ? 'has-error' : ''}`} autoComplete="organization" value={form.organizationName} onChange={set('organizationName')} />
            <FieldError text={errors.organizationName} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className={`input ${errors.email ? 'has-error' : ''}`} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          <FieldError text={errors.email} />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input className={`input ${errors.password ? 'has-error' : ''}`} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          {errors.password ? <FieldError text={errors.password} /> : <small className="muted small">Минимум 8 символов</small>}
        </label>
        <label className="field">
          <span>Город (необязательно)</span>
          <input className={`input ${errors.city ? 'has-error' : ''}`} autoComplete="address-level2" value={form.city} onChange={set('city')} />
          <FieldError text={errors.city} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-lg btn-block" disabled={busy}>Зарегистрироваться</button>
        <p className="muted small center">Уже есть аккаунт? <Link to={`/login${after.query}`}>Войти</Link></p>
      </form>
    </AuthShell>
  );
}
