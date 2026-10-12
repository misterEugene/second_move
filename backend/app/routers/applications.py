from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..deps import DB, Organizer, Volunteer
from ..errors import bad_request, conflict, forbidden, not_found
from ..models import Application, ApplicationStatus, Event, EventStatus, Participation, Review, Shift
from ..schemas import ApplyIn, ChooseShiftIn, StatusIn
from ..services import as_float, get_manageable_event, lock_event, notify, shift_view, today_utc

router = APIRouter(tags=["applications"])

APPROVED = ApplicationStatus.APPROVED


def approved_count(db: DB, event_id: int) -> int:
    return db.scalar(select(func.count()).where(Application.event_id == event_id, Application.status == APPROVED))


@router.post("/events/{event_id}/apply", status_code=201)
def apply(event_id: int, body: ApplyIn, db: DB, user: Volunteer):
    event = lock_event(db, event_id)
    if event is None or event.status != EventStatus.PUBLISHED:
        raise not_found("Мероприятие не найдено")
    if event.organization.owner_id == user.id:
        raise forbidden("Нельзя подать заявку на своё мероприятие")
    if event.date < today_utc():
        raise conflict("Мероприятие уже прошло")
    if approved_count(db, event_id) >= event.limit:
        raise conflict("Свободных мест нет")

    app = db.scalars(
        select(Application).where(Application.event_id == event_id, Application.volunteer_id == user.id)
    ).first()
    if app:
        if app.status != ApplicationStatus.CANCELLED:
            raise conflict("Вы уже подали заявку на это мероприятие")
        app.status, app.message, app.shift_id = ApplicationStatus.PENDING, body.message, None
    else:
        app = Application(event_id=event_id, volunteer_id=user.id, message=body.message)
        db.add(app)
    notify(db, event.organization.owner_id, f"Новая заявка от {user.name} на «{event.title}»", f"/organizer/events/{event_id}")
    db.commit()
    return {"id": app.id, "eventId": event_id, "status": app.status.value, "shiftId": app.shift_id}


@router.get("/applications/my")
def my_applications(db: DB, user: Volunteer):
    apps = db.scalars(
        select(Application)
        .where(Application.volunteer_id == user.id)
        .order_by(Application.created_at.desc(), Application.id.desc())
        .options(
            selectinload(Application.event).selectinload(Event.organization),
            selectinload(Application.event).selectinload(Event.shifts),
            selectinload(Application.shift),
            selectinload(Application.participation).selectinload(Participation.hours),
        )
    ).all()
    reviewed = set(db.scalars(select(Review.event_id).where(Review.volunteer_id == user.id)))
    result = []
    for a in apps:
        e, p = a.event, a.participation
        result.append({
            "id": a.id,
            "status": a.status.value,
            "message": a.message,
            "createdAt": a.created_at,
            "event": {
                "id": e.id, "title": e.title, "date": e.date, "city": e.city, "address": e.address,
                "category": e.category.value, "imageUrl": e.image_url,
                "organization": {"id": e.organization.id, "name": e.organization.name},
                "shifts": [shift_view(s) for s in e.shifts],
            },
            "shift": shift_view(a.shift) if a.shift else None,
            "attended": p.attended if p else None,
            "hours": as_float(p.hours.hours) if p and p.hours else None,
            "hoursConfirmedAt": p.hours.confirmed_at if p and p.hours else None,
            "canReview": bool(p and p.attended) and e.id not in reviewed,
            "reviewed": e.id in reviewed,
        })
    return result


@router.get("/events/{event_id}/applications")
def event_applications(event_id: int, db: DB, user: Organizer):
    get_manageable_event(db, user, event_id)
    apps = db.scalars(
        select(Application)
        .where(Application.event_id == event_id)
        .order_by(Application.created_at, Application.id)
        .options(
            selectinload(Application.volunteer),
            selectinload(Application.shift),
            selectinload(Application.participation).selectinload(Participation.hours),
        )
    ).all()
    return [
        {
            "id": a.id,
            "status": a.status.value,
            "message": a.message,
            "createdAt": a.created_at,
            "volunteer": {"id": a.volunteer.id, "name": a.volunteer.name, "email": a.volunteer.email, "city": a.volunteer.city},
            "shift": shift_view(a.shift) if a.shift else None,
            "participation": a.participation and {
                "id": a.participation.id,
                "attended": a.participation.attended,
                "markedAt": a.participation.marked_at,
                "hours": as_float(a.participation.hours.hours) if a.participation.hours else None,
                "confirmedAt": a.participation.hours.confirmed_at if a.participation.hours else None,
            },
        }
        for a in apps
    ]


@router.patch("/applications/{application_id}")
def change_status(application_id: int, body: StatusIn, db: DB, user: Organizer):
    app = db.get(Application, application_id)
    if app is None:
        raise not_found("Заявка не найдена")
    # Блокировка мероприятия: одновременные одобрения не превысят лимит.
    event = get_manageable_event(db, user, app.event_id, lock=True)
    db.refresh(app)
    status = ApplicationStatus(body.status)
    if app.status == status:
        return {"id": app.id, "status": app.status.value}
    if app.status == ApplicationStatus.CANCELLED:
        raise conflict("Волонтёр отменил заявку")
    if app.participation:
        raise conflict("Участие уже отмечено — статус заявки менять нельзя")
    if status == APPROVED and approved_count(db, event.id) >= event.limit:
        raise conflict(f"Достигнут лимит участников ({event.limit})")

    app.status = status
    if status == ApplicationStatus.REJECTED:
        app.shift_id = None
    notify(
        db,
        app.volunteer_id,
        f"Заявка на «{event.title}» одобрена. Выберите удобную смену."
        if status == APPROVED
        else f"Заявка на «{event.title}» отклонена.",
        f"/events/{event.id}",
    )
    db.commit()
    return {"id": app.id, "status": app.status.value}


@router.post("/applications/{application_id}/cancel")
def cancel(application_id: int, db: DB, user: Volunteer):
    app = db.get(Application, application_id)
    if app is None or app.volunteer_id != user.id:
        raise not_found("Заявка не найдена")
    if app.participation:
        raise conflict("Участие уже отмечено — отменить заявку нельзя")
    if app.status not in (ApplicationStatus.PENDING, APPROVED):
        raise conflict("Эту заявку нельзя отменить")
    app.status, app.shift_id = ApplicationStatus.CANCELLED, None
    db.commit()
    return {"id": app.id, "status": app.status.value}


@router.put("/applications/{application_id}/shift")
def choose_shift(application_id: int, body: ChooseShiftIn, db: DB, user: Volunteer):
    app = db.get(Application, application_id)
    if app is None or app.volunteer_id != user.id:
        raise not_found("Заявка не найдена")
    lock_event(db, app.event_id)
    db.refresh(app)
    if app.status != APPROVED:
        raise forbidden("Записаться на смену можно только после одобрения заявки")
    if app.participation:
        raise conflict("Участие уже отмечено — смену менять нельзя")
    if app.shift_id == body.shift_id:
        return {"id": app.id, "shiftId": app.shift_id}

    shift = db.get(Shift, body.shift_id)
    if shift is None or shift.event_id != app.event_id:
        raise bad_request("Смена не относится к этому мероприятию")
    if shift.start_at < datetime.now(timezone.utc):
        raise conflict("Смена уже началась")
    taken = db.scalar(select(func.count()).where(Application.shift_id == shift.id, Application.status == APPROVED))
    if taken >= shift.capacity:
        raise conflict("На этой смене нет свободных мест")
    app.shift_id = shift.id
    db.commit()
    return {"id": app.id, "shiftId": app.shift_id}
