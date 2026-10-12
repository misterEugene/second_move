from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..deps import DB
from ..errors import not_found
from ..models import Event, EventStatus, Organization, Review, User
from ..services import Occupancy, event_query, event_view, org_ratings, review_view

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
def list_organizations(db: DB, q: str | None = None):
    query = select(Organization).join(Organization.owner).where(User.blocked.is_(False)).order_by(Organization.name)
    if q and q.strip():
        query = query.where(Organization.name.ilike(f"%{q.strip()}%"))
    orgs = db.scalars(query).all()
    ids = [o.id for o in orgs]
    counts = dict(
        db.execute(
            select(Event.organization_id, func.count())
            .where(Event.organization_id.in_(ids), Event.status == EventStatus.PUBLISHED)
            .group_by(Event.organization_id)
        ).all()
    )
    ratings = org_ratings(db, ids)
    return [
        {
            "id": o.id, "name": o.name, "description": o.description, "city": o.city,
            "eventsCount": counts.get(o.id, 0), "rating": ratings[o.id],
        }
        for o in orgs
    ]


@router.get("/{organization_id}")
def get_organization(organization_id: int, db: DB):
    org = db.get(Organization, organization_id)
    if org is None or org.owner.blocked:
        raise not_found("Организация не найдена")
    events = db.scalars(
        event_query()
        .where(Event.organization_id == organization_id, Event.status == EventStatus.PUBLISHED)
        .order_by(Event.date.desc())
    ).all()
    reviews = db.scalars(
        select(Review)
        .join(Review.event)
        .where(Event.organization_id == organization_id, Review.hidden.is_(False))
        .order_by(Review.created_at.desc())
        .limit(30)
        .options(selectinload(Review.volunteer), selectinload(Review.event))
    ).all()
    occ = Occupancy(db, [e.id for e in events])
    return {
        "id": org.id,
        "name": org.name,
        "description": org.description,
        "city": org.city,
        "createdAt": org.created_at,
        "rating": org_ratings(db, [org.id])[org.id],
        "events": [event_view(e, occ) for e in events],
        "reviews": [review_view(r) for r in reviews],
    }
