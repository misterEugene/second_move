import datetime as dt
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator, model_validator,
)
from pydantic_core import PydanticCustomError
from pydantic.alias_generators import to_camel

from .models import Category, EventStatus, Role


class In(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


Str = Annotated[str, StringConstraints(strip_whitespace=True)]


def _lower(v: str) -> str:
    return v.strip().lower()


Email = Annotated[EmailStr, AfterValidator(_lower)]
SkillNames = Annotated[list[Annotated[Str, StringConstraints(max_length=50)]], Field(max_length=15)]


class RegisterIn(In):
    name: Annotated[Str, StringConstraints(max_length=100)]
    email: Email
    password: Annotated[str, StringConstraints(max_length=72)]
    role: Literal["VOLUNTEER", "ORGANIZER"] = "VOLUNTEER"
    city: Annotated[Str, StringConstraints(max_length=100)] | None = None
    organization_name: Annotated[Str, StringConstraints(max_length=150)] | None = None

    @field_validator("name")
    @classmethod
    def name_len(cls, v: str) -> str:
        if len(v) < 2:
            raise ValueError("Имя должно содержать минимум 2 символа")
        return v

    @field_validator("password")
    @classmethod
    def password_len(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен содержать минимум 8 символов")
        return v

    @model_validator(mode="after")
    def organization_required(self) -> "RegisterIn":
        if self.role == "ORGANIZER" and (not self.organization_name or len(self.organization_name) < 2):
            raise PydanticCustomError("value_error", "", {"error": "Укажите название организации", "field": "organizationName"})
        return self


class LoginIn(In):
    email: Annotated[str, StringConstraints(min_length=1, max_length=200), AfterValidator(_lower)]
    password: Annotated[str, StringConstraints(min_length=1)]


class EventIn(In):
    title: Annotated[Str, StringConstraints(max_length=150)]
    description: Annotated[Str, StringConstraints(max_length=5000)]
    requirements: Annotated[Str, StringConstraints(max_length=3000)] = ""
    category: Category
    date: dt.date
    city: Annotated[Str, StringConstraints(min_length=2, max_length=100)]
    address: Annotated[Str, StringConstraints(max_length=250)] = ""
    limit: Annotated[int, Field(ge=1, le=1000)]
    image_url: Annotated[Str, StringConstraints(max_length=500)] | None = None
    skills: SkillNames = []
    organization_id: int | None = None

    @field_validator("title")
    @classmethod
    def title_len(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 5:
            raise ValueError("Название должно содержать минимум 5 символов")
        return v

    @field_validator("description")
    @classmethod
    def description_len(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 20:
            raise ValueError("Опишите мероприятие подробнее (минимум 20 символов)")
        return v

    @field_validator("image_url")
    @classmethod
    def image_url_scheme(cls, v: str | None) -> str | None:
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Укажите ссылку на изображение (http/https)")
        return v or None


class EventUpdateIn(EventIn):
    title: Annotated[Str, StringConstraints(max_length=150)] | None = None  # type: ignore[assignment]
    description: Annotated[Str, StringConstraints(max_length=5000)] | None = None  # type: ignore[assignment]
    requirements: Annotated[Str, StringConstraints(max_length=3000)] | None = None  # type: ignore[assignment]
    category: Category | None = None  # type: ignore[assignment]
    date: dt.date | None = None  # type: ignore[assignment]
    city: Annotated[Str, StringConstraints(min_length=2, max_length=100)] | None = None  # type: ignore[assignment]
    address: Annotated[Str, StringConstraints(max_length=250)] | None = None  # type: ignore[assignment]
    limit: Annotated[int, Field(ge=1, le=1000)] | None = None  # type: ignore[assignment]
    skills: SkillNames | None = None  # type: ignore[assignment]


class ShiftIn(In):
    start_at: dt.datetime
    end_at: dt.datetime
    capacity: Annotated[int, Field(ge=1, le=1000)]


class ApplyIn(In):
    message: Annotated[Str, StringConstraints(max_length=1000)] = ""


class StatusIn(In):
    status: Literal["APPROVED", "REJECTED"]


class ChooseShiftIn(In):
    shift_id: int


class AttendanceIn(In):
    attended: bool


class HoursIn(In):
    hours: Annotated[Decimal, Field(ge=Decimal("0.25"), le=24, multiple_of=Decimal("0.25"))]


class ProfileIn(In):
    name: Annotated[Str, StringConstraints(min_length=2, max_length=100)] | None = None
    city: Annotated[Str, StringConstraints(max_length=100)] | None = None
    about: Annotated[Str, StringConstraints(max_length=1000)] | None = None
    skills: SkillNames | None = None


class ReviewIn(In):
    event_id: int
    rating: Annotated[int, Field(ge=1, le=5)]
    text: Annotated[Str, StringConstraints(min_length=3, max_length=2000)]


class OrganizationIn(In):
    name: Annotated[Str, StringConstraints(min_length=2, max_length=150)] | None = None
    description: Annotated[Str, StringConstraints(max_length=3000)] | None = None
    city: Annotated[Str, StringConstraints(max_length=100)] | None = None


class AdminUserIn(In):
    role: Role | None = None
    blocked: bool | None = None


class AdminEventIn(In):
    status: EventStatus


class AdminReviewIn(In):
    hidden: bool

