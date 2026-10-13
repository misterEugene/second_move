const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const localDateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatShortDate = (iso: string) => shortDateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function formatShift(s: { startAt: string; endAt: string }) {
  return `${localDateFmt.format(new Date(s.startAt))}, ${formatTime(s.startAt)} – ${formatTime(s.endAt)}`;
}

export function timeRange(shifts: { startAt: string; endAt: string }[]) {
  if (!shifts.length) return null;
  const start = shifts.reduce((m, s) => (s.startAt < m ? s.startAt : m), shifts[0].startAt);
  const end = shifts.reduce((m, s) => (s.endAt > m ? s.endAt : m), shifts[0].endAt);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export const shiftHours = (s: { startAt: string; endAt: string }) =>
  (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 3600_000;

export function formatHours(h: number) {
  const total = Math.round(h * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!minutes) return `${hours.toLocaleString('ru-RU')} ч`;
  return hours ? `${hours.toLocaleString('ru-RU')} ч ${minutes} мин` : `${minutes} мин`;
}

export const shiftHoursLimit = (s: { startAt: string; endAt: string }) => Math.min(24, Math.ceil(shiftHours(s) * 4) / 4);

export function plural(n: number, forms: [string, string, string]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

export function todayInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
