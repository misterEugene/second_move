from fastapi import APIRouter
from sqlalchemy import func, select, update

from ..deps import DB, CurrentUser
from ..errors import not_found
from ..models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(db: DB, user: CurrentUser):
    items = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(50)
    ).all()
    unread = db.scalar(select(func.count()).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    return {
        "items": [
            {"id": n.id, "text": n.text, "link": n.link, "isRead": n.is_read, "createdAt": n.created_at} for n in items
        ],
        "unread": unread,
    }


@router.post("/read-all")
def read_all(db: DB, user: CurrentUser):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return {"ok": True}


@router.post("/{notification_id}/read")
def read_one(notification_id: int, db: DB, user: CurrentUser):
    result = db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user.id)
        .values(is_read=True)
    )
    if not result.rowcount:
        raise not_found("Уведомление не найдено")
    db.commit()
    return {"ok": True}
