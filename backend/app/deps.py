from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .db import get_db
from .errors import forbidden, unauthorized
from .models import Role, User
from .security import decode_token

DB = Annotated[Session, Depends(get_db)]


def optional_user(request: Request, db: DB) -> User | None:
    """
    Разбирает Bearer-токен на любом запросе. Пользователь читается из БД,
    поэтому смена роли или блокировка действуют сразу.
    """
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        user_id = decode_token(header[7:])
    except jwt.PyJWTError:
        return None
    user = db.get(User, user_id)
    if user and user.blocked:
        raise forbidden("Учётная запись заблокирована")
    return user


def current_user(request: Request, db: DB) -> User:
    header = request.headers.get("authorization", "")
    user = optional_user(request, db)
    if user is None:
        raise unauthorized("Сессия истекла, войдите снова" if header else "Требуется авторизация")
    return user


def require_roles(*roles: Role) -> Callable[[User], User]:
    """Проверка роли на сервере — скрытая кнопка в интерфейсе защитой не является."""

    def check(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return check


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
Volunteer = Annotated[User, Depends(require_roles(Role.VOLUNTEER, Role.ADMIN))]
Organizer = Annotated[User, Depends(require_roles(Role.ORGANIZER, Role.ADMIN))]
OrganizerOnly = Annotated[User, Depends(require_roles(Role.ORGANIZER))]
Admin = Annotated[User, Depends(require_roles(Role.ADMIN))]
