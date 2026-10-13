from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .errors import forbidden, not_found
from .models import Application, ApplicationStatus, Event, Notification, Organization, Review, Role, Skill, User


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def as_float(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def notify(db: Session, user_id: int, text: str, link: str | None = None) -> None:
    db.add(Notification(user_id=user_id, text=text, link=link))


def get_manageable_event(db: Session, user: User, event_id: int, *, lock: bool = False) -> Event:
    query = select(Event).where(Event.id == event_id)
    if lock:
        query = query.with_for_update()
    event = db.scalars(query).first()
    if event is None:
        raise not_found("Мероприятие не найдено")
    if user.role != Role.ADMIN and event.organization.owner_id != user.id:
        raise forbidden("Это мероприятие принадлежит другому организатору")
    return event


def lock_event(db: Session, event_id: int) -> Event | None:
    return db.scalars(select(Event).where(Event.id == event_id).with_for_update()).first()


def event_query():
    return select(Event).options(
        selectinload(Event.organization), selectinload(Event.shifts), selectinload(Event.skills)
    )


class Occupancy:
    def __init__(self, db: Session, event_ids: list[int]):
        self.approved: dict[int, int] = {}
        self.taken: dict[int, int] = {}
        if not event_ids:
            return
        approved = Application.status == ApplicationStatus.APPROVED
        rows = db.execute(
            select(Application.event_id, func.count(func.distinct(Application.volunteer_id)))
            .where(Application.event_id.in_(event_ids), approved)
            .group_by(Application.event_id)
        )
        self.approved = {event_id: count for event_id, count in rows}
        rows = db.execute(
            select(Application.shift_id, func.count())
            .where(Application.event_id.in_(event_ids), approved, Application.shift_id.is_not(None))
            .group_by(Application.shift_id)
        )
        self.taken = {shift_id: count for shift_id, count in rows}


def shift_view(shift, taken: int | None = None) -> dict:
    data = {"id": shift.id, "startAt": shift.start_at, "endAt": shift.end_at, "capacity": shift.capacity}
    if taken is not None:
        data["taken"] = taken
    return data


def event_view(event: Event, occ: Occupancy) -> dict:
    approved = occ.approved.get(event.id, 0)
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "requirements": event.requirements,
        "category": event.category.value,
        "date": event.date,
        "city": event.city,
        "address": event.address,
        "limit": event.limit,
        "imageUrl": event.image_url,
        "status": event.status.value,
        "createdAt": event.created_at,
        "organization": {"id": event.organization.id, "name": event.organization.name},
        "skills": [s.name for s in event.skills],
        "approvedCount": approved,
        "freePlaces": max(0, event.limit - approved),
        "shifts": [shift_view(s, occ.taken.get(s.id, 0)) for s in event.shifts],
    }


def get_or_create_skills(db: Session, names: list[str]) -> list[Skill]:
    unique = list(dict.fromkeys(n.strip() for n in names if n.strip()))
    existing = {s.name: s for s in db.scalars(select(Skill).where(Skill.name.in_(unique)))}
    result = []
    for name in unique:
        skill = existing.get(name)
        if skill is None:
            skill = Skill(name=name)
            db.add(skill)
        result.append(skill)
    return result


def org_ratings(db: Session, org_ids: list[int]) -> dict[int, dict]:
    rows = db.execute(
        select(Event.organization_id, func.avg(Review.rating), func.count(Review.id))
        .join(Review, Review.event_id == Event.id)
        .where(Event.organization_id.in_(org_ids), Review.hidden.is_(False))
        .group_by(Event.organization_id)
    )
    found = {org_id: {"average": round(float(avg), 1), "count": count} for org_id, avg, count in rows}
    return {org_id: found.get(org_id, {"average": None, "count": 0}) for org_id in org_ids}


def review_view(review: Review) -> dict:
    return {
        "id": review.id,
        "rating": review.rating,
        "text": review.text,
        "createdAt": review.created_at,
        "author": review.volunteer.name,
        "event": {"id": review.event.id, "title": review.event.title},
    }


def organization_of(db: Session, user: User) -> Organization | None:
    return db.scalars(select(Organization).where(Organization.owner_id == user.id)).first()
