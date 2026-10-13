import math
from datetime import datetime

from fastapi import APIRouter
from sqlalchemy.exc import IntegrityError

from ..deps import DB, Organizer
from ..errors import conflict, field_error, not_found
from ..models import Application, ApplicationStatus, Participation, VolunteerHours
from ..schemas import AttendanceIn, HoursIn
from ..services import get_manageable_event, notify

router = APIRouter(tags=["attendance"])


def shift_hours_limit(shift) -> float:
    return math.ceil((shift.end_at - shift.start_at).total_seconds() / 900) / 4


def format_hours(hours: float) -> str:
    h, m = divmod(round(hours * 60), 60)
    return " ".join(part for part in (f"{h} ч" if h else "", f"{m} мин" if m else "") if part) or "0 ч"


@router.post("/participations/{application_id}")
def mark(application_id: int, body: AttendanceIn, db: DB, user: Organizer):
    app = db.get(Application, application_id)
    if app is None:
        raise not_found("Заявка не найдена")
    event = get_manageable_event(db, user, app.event_id)
    if app.status != ApplicationStatus.APPROVED:
        raise conflict("Участие можно отметить только по одобренной заявке")
    p = app.participation
    if p and p.hours:
        raise conflict("Часы уже подтверждены — отметку участия менять нельзя")
    if p is None:
        p = Participation(application_id=app.id, attended=body.attended, marked_by=user.id)
        db.add(p)
    else:
        p.attended, p.marked_by, p.marked_at = body.attended, user.id, datetime.now().astimezone()
    notify(
        db,
        app.volunteer_id,
        f"Организатор отметил ваше участие в «{event.title}». Часы будут начислены после подтверждения."
        if body.attended
        else f"Организатор отметил, что вы не участвовали в «{event.title}».",
        "/cabinet/applications",
    )
    db.commit()
    return {"id": p.id, "applicationId": app.id, "attended": p.attended}


@router.post("/hours/{participation_id}/confirm", status_code=201)
def confirm_hours(participation_id: int, body: HoursIn, db: DB, user: Organizer):
    p = db.get(Participation, participation_id)
    if p is None:
        raise not_found("Отметка участия не найдена")
    event = get_manageable_event(db, user, p.application.event_id)
    if not p.attended:
        raise conflict("Волонтёр не отмечен как участник — часы начислить нельзя")
    if p.hours:
        raise conflict("Часы по этому участию уже подтверждены")
    shift = p.application.shift
    if shift:
        max_hours = shift_hours_limit(shift)
        if float(body.hours) > max_hours:
            raise field_error("hours", f"Не больше продолжительности смены ({format_hours(max_hours)})")

    record = VolunteerHours(participation_id=p.id, hours=body.hours, confirmed_by=user.id)
    db.add(record)
    notify(
        db,
        p.application.volunteer_id,
        f"Подтверждено {format_hours(float(body.hours))} за «{event.title}». Спасибо! Теперь можно оставить отзыв.",
        "/cabinet/hours",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("Часы по этому участию уже подтверждены")
    return {"id": record.id, "participationId": p.id, "hours": float(record.hours)}
