import { BellOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import type { NotificationItem } from '@/api/types';
import { Skeleton } from '@/components/Basics';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { useTitle } from '@/lib/useTitle';

export function NotificationsPage() {
  useTitle('Уведомления');
  const { setUnread } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ items: NotificationItem[]; unread: number }>('/notifications');
    setItems(res.items);
    setUnread(res.unread);
  }, [setUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(n: NotificationItem) {
    if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: 'POST' });
    if (n.link) navigate(n.link);
    else await load();
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    await load();
  }

  return (
    <div className="container page narrow">
      <div className="page-head">
        <h1>Уведомления</h1>
        {items?.some((n) => !n.isRead) && <button className="btn btn-ghost btn-sm" onClick={readAll}>Прочитать все</button>}
      </div>
      {!items ? (
        <Skeleton height={240} />
      ) : items.length ? (
        <div className="card">
          {items.map((n) => (
            <button key={n.id} className={`notice ${n.isRead ? '' : 'unread'}`} onClick={() => open(n)}>
              <span className="notice-dot" aria-hidden="true" />
              <span className="stack" style={{ gap: 2 }}>
                <span>{n.text}</span>
                <span className="muted small">{formatDateTime(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty card"><BellOff size={36} /><p>Уведомлений пока нет</p></div>
      )}
    </div>
  );
}
