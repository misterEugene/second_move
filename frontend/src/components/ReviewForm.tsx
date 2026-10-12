import { Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { toast } from '@/lib/toast';
import { useForm } from '@/lib/useForm';
import { FieldError } from './Basics';

export function ReviewForm({ eventId, onDone }: { eventId: number; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const { errors, setErrors, error, busy, submit } = useForm();

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!rating) {
      setErrors({ rating: 'Поставьте оценку' });
      return;
    }
    const ok = await submit(() => api('/reviews', { method: 'POST', body: { eventId, rating, text } }));
    if (ok) {
      toast('Спасибо за отзыв!');
      onDone();
    }
  }

  return (
    <form className="stack" onSubmit={send}>
      <fieldset className="field">
        <legend className="legend-label">Оценка</legend>
        <div className="stars-input" role="radiogroup">
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className={i <= rating ? 'on' : ''}>
              <input type="radio" name="rating" value={i} className="sr-only" checked={rating === i} onChange={() => setRating(i)} />
              <Star size={28} fill={i <= rating ? 'currentColor' : 'none'} />
              <span className="sr-only">{i} из 5</span>
            </label>
          ))}
        </div>
        <FieldError text={errors.rating} />
      </fieldset>
      <label className="field">
        <span>Отзыв</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className={`input ${errors.text ? 'has-error' : ''}`} maxLength={2000} placeholder="Как всё прошло?" />
        <FieldError text={errors.text} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div><button className="btn" disabled={busy}>Отправить отзыв</button></div>
    </form>
  );
}
