from fastapi import APIRouter
from sqlalchemy import select

from ..deps import DB, CurrentUser
from ..errors import AppError, field_error, forbidden
from ..models import Organization, Role, User
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role.value}


def session(user: User) -> dict:
    return {"token": create_token(user.id, user.role.value), "user": user_out(user)}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: DB):
    if db.scalars(select(User).where(User.email == body.email)).first():
        raise field_error("email", "Пользователь с таким email уже зарегистрирован")
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=Role(body.role),
        city=body.city or None,
    )
    db.add(user)
    if user.role == Role.ORGANIZER:
        db.add(Organization(owner=user, name=body.organization_name, city=user.city))
    db.commit()
    return session(user)


@router.post("/login")
def login(body: LoginIn, db: DB):
    user = db.scalars(select(User).where(User.email == body.email)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise AppError(401, "Неверный email или пароль")
    if user.blocked:
        raise forbidden("Учётная запись заблокирована")
    return session(user)


@router.get("/me")
def me(user: CurrentUser):
    return user_out(user)
