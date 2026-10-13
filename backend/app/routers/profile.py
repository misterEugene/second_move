from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..deps import DB, CurrentUser, Volunteer
from ..models import Application, ApplicationStatus, Participation, Shift, VolunteerHours
from ..schemas import ProfileIn
from ..services import get_or_create_skills, shift_view

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
def get_profile(user: CurrentUser):
    org = user.organization
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "city": user.city,
        "about": user.about,
        "createdAt": user.created_at,
        "skills": [s.name for s in user.skills],
        "organization": org and {"id": org.id, "name": org.name, "description": org.description, "city": org.city},
    }


@router.patch("")
def update_profile(body: ProfileIn, db: DB, user: CurrentUser):
    data = body.model_dump(exclude_unset=True, exclude={"skills"})
    for key, value in data.items():
        if key != "name" or value:
            setattr(user, key, value)
    if body.skills is not None:
        user.skills = get_or_create_skills(db, body.skills)
    db.commit()
    return get_profile(user)


@router.get("/statistics")
def statistics(db: DB, user: Volunteer):
    hours = db.scalars(
        select(VolunteerHours)
        .join(Participation)
        .join(Application)
        .where(Application.volunteer_id == user.id)
        .order_by(VolunteerHours.confirmed_at.desc())
        .options(selectinload(VolunteerHours.participation).selectinload(Participation.application).selectinload(Application.event))
    ).all()
    by_category: dict[str, float] = {}
    history = []
    total = 0.0
    for h in hours:
        value = float(h.hours)
        event = h.participation.application.event
        total += value
        by_category[event.category.value] = by_category.get(event.category.value, 0) + value
        history.append({
            "event": {"id": event.id, "title": event.title, "category": event.category.value, "date": event.date},
            "hours": value,
            "confirmedAt": h.confirmed_at,
        })

    counts = db.execute(
        select(Application.status, func.count(func.distinct(Application.event_id)))
        .where(Application.volunteer_id == user.id)
        .group_by(Application.status)
    ).all()
    upcoming = db.scalars(
        select(Application)
        .join(Shift, Application.shift_id == Shift.id)
        .where(
            Application.volunteer_id == user.id,
            Application.status == ApplicationStatus.APPROVED,
            Shift.start_at >= datetime.now(timezone.utc),
        )
        .order_by(Shift.start_at)
        .limit(5)
        .options(selectinload(Application.event), selectinload(Application.shift))
    ).all()

    return {
        "totalHours": total,
        "eventsCount": len(history),
        "byCategory": sorted(
            ({"category": c, "hours": v} for c, v in by_category.items()), key=lambda r: r["hours"], reverse=True
        ),
        "applications": {status.value: count for status, count in counts},
        "history": history,
        "upcoming": [
            {
                "applicationId": a.id,
                "event": {
                    "id": a.event.id, "title": a.event.title, "city": a.event.city,
                    "address": a.event.address, "category": a.event.category.value,
                },
                "shift": shift_view(a.shift),
            }
            for a in upcoming
        ],
    }
