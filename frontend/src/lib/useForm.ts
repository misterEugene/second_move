import { useCallback, useState } from 'react';
import { ApiError } from '@/api/client';

export function useForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError('');
    setErrors({});
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        if (!Object.keys(e.errors).length) setError(e.message);
      } else {
        setError('Что-то пошло не так');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  return { errors, setErrors, error, busy, submit };
}
