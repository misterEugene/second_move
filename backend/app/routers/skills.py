from fastapi import APIRouter
from sqlalchemy import select

from ..deps import DB
from ..models import Skill

router = APIRouter(tags=["skills"])


@router.get("/skills")
def list_skills(db: DB):
    return db.scalars(select(Skill.name).order_by(Skill.name)).all()
