import { Link } from 'react-router-dom';
import { useTitle } from '@/lib/useTitle';

export function NotFoundPage() {
  useTitle('Страница не найдена');
  return (
    <div className="container page">
      <div className="empty card">
        <h1>404</h1>
        <p style={{ margin: '8px 0 18px' }}>Такой страницы нет. Зато есть много добрых дел!</p>
        <Link to="/events" className="btn">К мероприятиям</Link>
      </div>
    </div>
  );
}
