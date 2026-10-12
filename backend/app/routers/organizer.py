from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..deps import DB, OrganizerOnly
from ..errors import not_found
from ..models import Application, ApplicationStatus, Event, Participation, Review, User, VolunteerHours
from ..schemas import OrganizationIn
from ..services import Occupancy, event_query, event_view, org_ratings, organization_of, review_view

router = APIRouter(prefix="/organizer", tags=["organizer"])


def _org(db: DB, user: User):
    org = organization_of(db, user)
    if org is None:
        raise not_found("У вас нет организации")
    return org


@router.get("/organization")
def organization(db: DB, user: OrganizerOnly):
    org = _org(db, user)
    return {
        "id": org.id, "name": org.name, "description": org.description, "city": org.city,
        "rating": org_ratings(db, [org.id])[org.id],
    }


@router.patch("/organization")
def update_organization(body: OrganizationIn, db: DB, user: OrganizerOnly):
    org = _org(db, user)
    for key, value in body.model_dump(exclude_unset=True).items():
        if key != "name" or value:
            setattr(org, key, value if value is not None or key == "city" else "")
    db.commit()
    return organization(db, user)


@router.get("/events")
def events(db: DB, user: OrganizerOnly):
    org = _org(db, user)
    items = db.scalars(event_query().where(Event.organization_id == org.id).order_by(Event.date.desc())).all()
    ids = [e.id for e in items]
    pending = dict(
        db.execute(
            select(Application.event_id, func.count())
            .where(Application.event_id.in_(ids), Application.status == ApplicationStatus.PENDING)
            .group_by(Application.event_id)
        ).all()
    )
    occ = Occupancy(db, ids)
    return [{**event_view(e, occ), "pendingCount": pending.get(e.id, 0)} for e in items]


@router.get("/reviews")
def reviews(db: DB, user: OrganizerOnly):
    org = _org(db, user)
    rows = db.scalars(
        select(Review)
        .join(Review.event)
        .where(Event.organization_id == org.id, Review.hidden.is_(False))
        .order_by(Review.created_at.desc())
        .options(selectinload(Review.volunteer), selectinload(Review.event))
    ).all()
    return [review_view(r) for r in rows]


@router.get("/stats")
def stats(db: DB, user: OrganizerOnly):
    org = _org(db, user)
    in_org = Application.event_id.in_(select(Event.id).where(Event.organization_id == org.id))

    def count(status):
        return db.scalar(select(func.count()).where(in_org, Application.status == status))

    hours = db.scalar(select(func.coalesce(func.sum(VolunteerHours.hours), 0)).join(Participation).join(Application).where(in_org))
    volunteers = db.scalar(
        select(func.count(func.distinct(Application.volunteer_id))).join(Participation).where(in_org, Participation.attended)
    )
    return {
        "events": db.scalar(select(func.count()).where(Event.organization_id == org.id)),
        "pendingApplications": count(ApplicationStatus.PENDING),
        "approvedApplications": count(ApplicationStatus.APPROVED),
        "confirmedHours": float(hours),
        "volunteers": volunteers,
    }
