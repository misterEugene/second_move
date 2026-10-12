from fastapi import APIRouter
from sqlalchemy import select

from ..deps import DB, Volunteer
from ..errors import conflict, forbidden, not_found
from ..models import Application, Review
from ..schemas import ReviewIn
from ..services import notify

router = APIRouter(tags=["reviews"])


@router.post("/reviews", status_code=201)
def create_review(body: ReviewIn, db: DB, user: Volunteer):
    """Отзыв можно оставить только после фактического участия в мероприятии."""
    app = db.scalars(
        select(Application).where(Application.event_id == body.event_id, Application.volunteer_id == user.id)
    ).first()
    if app is None:
        raise not_found("Вы не участвовали в этом мероприятии")
    if not (app.participation and app.participation.attended):
        raise forbidden("Отзыв можно оставить только после участия")
    exists = db.scalars(
        select(Review).where(Review.event_id == body.event_id, Review.volunteer_id == user.id)
    ).first()
    if exists:
        raise conflict("Вы уже оставили отзыв об этом мероприятии")

    review = Review(event_id=body.event_id, volunteer_id=user.id, rating=body.rating, text=body.text)
    db.add(review)
    notify(db, app.event.organization.owner_id, f"Новый отзыв ({body.rating}★) о «{app.event.title}»", "/organizer/reviews")
    db.commit()
    return {"id": review.id, "eventId": review.event_id, "rating": review.rating, "text": review.text}
