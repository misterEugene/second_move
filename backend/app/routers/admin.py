from fastapi import APIRouter
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from ..deps import DB, Admin
from ..errors import bad_request, not_found
from ..models import Application, ApplicationStatus, Event, EventStatus, Organization, Review, Role, User, VolunteerHours
from ..schemas import AdminEventIn, AdminReviewIn, AdminUserIn
from ..services import notify

router = APIRouter(prefix="/admin", tags=["admin"])

ROLE_LABEL = {Role.VOLUNTEER: "Волонтёр", Role.ORGANIZER: "Организатор", Role.ADMIN: "Администратор"}


@router.get("/stats")
def stats(db: DB, _: Admin):
    users = dict(db.execute(select(User.role, func.count()).group_by(User.role)).all())
    return {
        "users": {role.value: count for role, count in users.items()},
        "organizations": db.scalar(select(func.count()).select_from(Organization)),
        "events": db.scalar(select(func.count()).select_from(Event)),
        "pendingApplications": db.scalar(select(func.count()).where(Application.status == ApplicationStatus.PENDING)),
        "confirmedHours": float(db.scalar(select(func.coalesce(func.sum(VolunteerHours.hours), 0)))),
        "reviews": db.scalar(select(func.count()).select_from(Review)),
    }


def user_row(u: User) -> dict:
    org = u.organization
    return {
        "id": u.id, "name": u.name, "email": u.email, "role": u.role.value, "city": u.city,
        "blocked": u.blocked, "createdAt": u.created_at,
        "organization": org and {"id": org.id, "name": org.name},
    }


@router.get("/users")
def users(db: DB, _: Admin, q: str | None = None):
    query = select(User).order_by(User.created_at.desc(), User.id.desc()).options(selectinload(User.organization))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.where(or_(User.name.ilike(like), User.email.ilike(like)))
    return [user_row(u) for u in db.scalars(query)]


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: AdminUserIn, db: DB, admin: Admin):
    if user_id == admin.id:
        raise bad_request("Нельзя изменить роль или заблокировать самого себя")
    user = db.get(User, user_id)
    if user is None:
        raise not_found("Пользователь не найден")
    if body.role and body.role != user.role:
        if body.role == Role.ORGANIZER and user.organization is None:
            db.add(Organization(owner_id=user.id, name=f"Организация {user.name}", city=user.city))
        notify(db, user.id, f"Администратор изменил вашу роль на «{ROLE_LABEL[body.role]}»")
        user.role = body.role
    if body.blocked is not None:
        user.blocked = body.blocked
    db.commit()
    db.refresh(user)
    return user_row(user)


@router.get("/organizations")
def organizations(db: DB, _: Admin):
    orgs = db.scalars(select(Organization).order_by(Organization.name).options(selectinload(Organization.owner))).all()
    counts = dict(db.execute(select(Event.organization_id, func.count()).group_by(Event.organization_id)).all())
    return [
        {
            "id": o.id, "name": o.name, "city": o.city,
            "owner": {"id": o.owner.id, "name": o.owner.name, "email": o.owner.email, "blocked": o.owner.blocked},
            "eventsCount": counts.get(o.id, 0),
        }
        for o in orgs
    ]


@router.get("/events")
def events(db: DB, _: Admin, q: str | None = None):
    query = select(Event).order_by(Event.date.desc()).options(selectinload(Event.organization))
    if q and q.strip():
        query = query.where(Event.title.ilike(f"%{q.strip()}%"))
    items = db.scalars(query).all()
    counts = dict(
        db.execute(
            select(Application.event_id, func.count())
            .where(Application.event_id.in_([e.id for e in items]))
            .group_by(Application.event_id)
        ).all()
    )
    return [
        {
            "id": e.id, "title": e.title, "date": e.date, "city": e.city, "category": e.category.value,
            "status": e.status.value, "limit": e.limit, "organization": {"id": e.organization.id, "name": e.organization.name},
            "applicationsCount": counts.get(e.id, 0),
        }
        for e in items
    ]


@router.patch("/events/{event_id}")
def set_event_status(event_id: int, body: AdminEventIn, db: DB, _: Admin):
    event = db.get(Event, event_id)
    if event is None:
        raise not_found("Мероприятие не найдено")
    if body.status != event.status:
        notify(
            db,
            event.organization.owner_id,
            f"Мероприятие «{event.title}» скрыто администратором"
            if body.status == EventStatus.HIDDEN
            else f"Мероприятие «{event.title}» снова опубликовано",
            f"/organizer/events/{event.id}",
        )
        event.status = body.status
    db.commit()
    return {"id": event.id, "status": event.status.value}


@router.get("/reviews")
def reviews(db: DB, _: Admin):
    rows = db.scalars(
        select(Review)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .options(selectinload(Review.volunteer), selectinload(Review.event).selectinload(Event.organization))
    ).all()
    return [
        {
            "id": r.id, "rating": r.rating, "text": r.text, "hidden": r.hidden, "createdAt": r.created_at,
            "volunteer": {"id": r.volunteer.id, "name": r.volunteer.name},
            "event": {"id": r.event.id, "title": r.event.title, "organization": {"name": r.event.organization.name}},
        }
        for r in rows
    ]


@router.patch("/reviews/{review_id}")
def set_review_hidden(review_id: int, body: AdminReviewIn, db: DB, _: Admin):
    review = db.get(Review, review_id)
    if review is None:
        raise not_found("Отзыв не найден")
    review.hidden = body.hidden
    db.commit()
    return {"ok": True}
