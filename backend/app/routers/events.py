from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from ..deps import DB, OptionalUser, Organizer
from ..errors import bad_request, conflict, field_error, not_found
from ..models import (
    Application, ApplicationStatus, Category, Event, EventStatus, Organization, Participation, Review, Role, Shift,
    VolunteerHours,
)
from ..schemas import EventIn, EventUpdateIn, ShiftIn
from ..services import (
    Occupancy, as_float, event_query, event_view, get_manageable_event, get_or_create_skills, org_ratings,
    organization_of, today_utc,
)

router = APIRouter(tags=["events"])


@router.get("/events")
def list_events(
    db: DB,
    q: Annotated[str | None, Query(max_length=100)] = None,
    category: Category | None = None,
    city: Annotated[str | None, Query(max_length=100)] = None,
    date_from: Annotated[str | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[str | None, Query(alias="dateTo")] = None,
    has_places: Annotated[bool, Query(alias="hasPlaces")] = False,
    sort: Literal["date", "new", "places"] = "date",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=50)] = 12,
):
    try:
        start = date.fromisoformat(date_from) if date_from else today_utc()
        end = date.fromisoformat(date_to) if date_to else None
    except ValueError:
        raise field_error("dateFrom", "Некорректная дата")

    query = event_query().where(Event.status == EventStatus.PUBLISHED, Event.date >= start)
    if end:
        query = query.where(Event.date <= end)
    if category:
        query = query.where(Event.category == category)
    if city:
        query = query.where(func.lower(Event.city) == city.strip().lower())
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.join(Event.organization).where(
            or_(Event.title.ilike(like), Event.description.ilike(like), Organization.name.ilike(like))
        )

    events = db.scalars(query).all()
    occ = Occupancy(db, [e.id for e in events])
    items = [event_view(e, occ) for e in events]

    # Учебный объём данных: свободные места и сортировку по ним считаем в памяти.
    if has_places:
        items = [e for e in items if e["freePlaces"] > 0]
    if sort == "new":
        items.sort(key=lambda e: e["createdAt"], reverse=True)
    elif sort == "places":
        items.sort(key=lambda e: e["freePlaces"], reverse=True)
    else:
        items.sort(key=lambda e: (e["date"], e["id"]))

    return {
        "items": items[(page - 1) * page_size : page * page_size],
        "total": len(items),
        "page": page,
        "pageSize": page_size,
    }


@router.get("/events/meta")
def meta(db: DB):
    upcoming = (Event.status == EventStatus.PUBLISHED, Event.date >= today_utc())
    cities = db.scalars(select(Event.city).where(*upcoming).distinct().order_by(Event.city)).all()
    counts = dict(db.execute(select(Event.category, func.count()).where(*upcoming).group_by(Event.category)).all())
    return {
        "cities": cities,
        "categories": [{"category": c.value, "count": counts.get(c, 0)} for c in Category],
    }


@router.get("/events/{event_id}")
def get_event(event_id: int, db: DB, user: OptionalUser):
    event = db.scalars(event_query().where(Event.id == event_id)).first()
    if event is None:
        raise not_found("Мероприятие не найдено")
    can_manage = user is not None and (user.role == Role.ADMIN or event.organization.owner_id == user.id)
    if event.status == EventStatus.HIDDEN and not can_manage:
        raise not_found("Мероприятие не найдено")

    my_application = my_review = None
    if user:
        app = db.scalars(
            select(Application).where(Application.event_id == event_id, Application.volunteer_id == user.id)
        ).first()
        if app:
            p = app.participation
            my_application = {
                "id": app.id,
                "status": app.status.value,
                "shiftId": app.shift_id,
                "attended": p.attended if p else None,
                "hours": as_float(p.hours.hours) if p and p.hours else None,
            }
        review = db.scalars(
            select(Review).where(Review.event_id == event_id, Review.volunteer_id == user.id)
        ).first()
        if review:
            my_review = {"rating": review.rating, "text": review.text}

    return {
        **event_view(event, Occupancy(db, [event_id])),
        "organizationRating": org_ratings(db, [event.organization_id])[event.organization_id],
        "canManage": can_manage,
        "myApplication": my_application,
        "myReview": my_review,
    }


def _resolve_organization(db: DB, user, organization_id: int | None) -> int:
    if user.role == Role.ADMIN:
        if not organization_id:
            raise field_error("organizationId", "Выберите организацию")
        if db.get(Organization, organization_id) is None:
            raise field_error("organizationId", "Организация не найдена")
        return organization_id
    org = organization_of(db, user)
    if org is None:
        raise bad_request("Сначала заполните профиль организации")
    return org.id


@router.post("/events", status_code=201)
def create_event(body: EventIn, db: DB, user: Organizer):
    organization_id = _resolve_organization(db, user, body.organization_id)
    if body.date < today_utc():
        raise field_error("date", "Дата не может быть в прошлом")
    event = Event(
        organization_id=organization_id,
        title=body.title,
        description=body.description,
        requirements=body.requirements,
        category=body.category,
        date=body.date,
        city=body.city,
        address=body.address,
        limit=body.limit,
        image_url=body.image_url,
        skills=get_or_create_skills(db, body.skills),
    )
    db.add(event)
    db.commit()
    return get_event(event.id, db, user)


@router.patch("/events/{event_id}")
def update_event(event_id: int, body: EventUpdateIn, db: DB, user: Organizer):
    event = get_manageable_event(db, user, event_id, lock=True)
    data = body.model_dump(exclude_unset=True, exclude={"organization_id", "skills"})
    if data.get("limit") is not None:
        approved = db.scalar(
            select(func.count()).where(
                Application.event_id == event_id, Application.status == ApplicationStatus.APPROVED
            )
        )
        if data["limit"] < approved:
            raise field_error("limit", f"Уже одобрено {approved} участников — лимит не может быть меньше")
    for key, value in data.items():
        if value is not None or key == "image_url":
            setattr(event, key, value)
    if body.skills is not None:
        event.skills = get_or_create_skills(db, body.skills)
    db.commit()
    return get_event(event_id, db, user)


@router.delete("/events/{event_id}")
def delete_event(event_id: int, db: DB, user: Organizer):
    event = get_manageable_event(db, user, event_id)
    confirmed = db.scalar(
        select(func.count())
        .select_from(VolunteerHours)
        .join(Participation)
        .join(Application)
        .where(Application.event_id == event_id)
    )
    if confirmed:
        raise conflict("По мероприятию уже подтверждены часы — его можно только скрыть")
    db.delete(event)
    db.commit()
    return {"ok": True}


@router.post("/events/{event_id}/shifts", status_code=201)
def add_shift(event_id: int, body: ShiftIn, db: DB, user: Organizer):
    event = get_manageable_event(db, user, event_id)
    if body.end_at <= body.start_at:
        raise field_error("endAt", "Окончание смены должно быть позже начала")
    if body.end_at - body.start_at > timedelta(hours=24):
        raise field_error("endAt", "Смена не может длиться больше 24 часов")
    if body.capacity > event.limit:
        raise field_error("capacity", f"Вместимость смены не может превышать лимит мероприятия ({event.limit})")
    shift = Shift(event_id=event_id, start_at=body.start_at, end_at=body.end_at, capacity=body.capacity)
    db.add(shift)
    db.commit()
    return {"id": shift.id, "eventId": event_id, "startAt": shift.start_at, "endAt": shift.end_at, "capacity": shift.capacity}


@router.delete("/shifts/{shift_id}")
def delete_shift(shift_id: int, db: DB, user: Organizer):
    shift = db.get(Shift, shift_id)
    if shift is None:
        raise not_found("Смена не найдена")
    get_manageable_event(db, user, shift.event_id)
    if db.scalar(select(func.count()).where(Application.shift_id == shift_id)):
        raise conflict("На смену уже записаны волонтёры — удалить её нельзя")
    db.delete(shift)
    db.commit()
    return {"ok": True}
