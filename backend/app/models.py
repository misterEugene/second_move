import enum
import datetime as dt
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Role(str, enum.Enum):
    VOLUNTEER = "VOLUNTEER"
    ORGANIZER = "ORGANIZER"
    ADMIN = "ADMIN"


class Category(str, enum.Enum):
    SOCIAL = "SOCIAL"
    ECOLOGY = "ECOLOGY"
    EDUCATION = "EDUCATION"
    HEALTH = "HEALTH"
    CULTURE = "CULTURE"
    SPORT = "SPORT"
    ANIMALS = "ANIMALS"


class EventStatus(str, enum.Enum):
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class ApplicationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


def pg_enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(pg_enum(Role, "role"), default=Role.VOLUNTEER)
    city: Mapped[str | None] = mapped_column(String(100))
    about: Mapped[str | None] = mapped_column(Text)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped["Organization | None"] = relationship(back_populates="owner")
    skills: Mapped[list["Skill"]] = relationship(secondary="user_skills")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str | None] = mapped_column(String(100))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[User] = relationship(back_populates="organization")
    events: Mapped[list["Event"]] = relationship(back_populates="organization")


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint('"limit" > 0', name="events_limit_positive"),
        Index("ix_events_date", "date"),
        Index("ix_events_city", "city"),
        Index("ix_events_category", "category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[Category] = mapped_column(pg_enum(Category, "category"))
    date: Mapped[dt.date] = mapped_column(Date)
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(250), default="")
    limit: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[EventStatus] = mapped_column(pg_enum(EventStatus, "event_status"), default=EventStatus.PUBLISHED)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Organization] = relationship(back_populates="events")
    shifts: Mapped[list["Shift"]] = relationship(
        back_populates="event", order_by="Shift.start_at", cascade="all, delete-orphan", passive_deletes=True
    )
    skills: Mapped[list["Skill"]] = relationship(secondary="event_skills")


class Shift(Base):
    __tablename__ = "shifts"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="shifts_capacity_positive"),
        CheckConstraint("end_at > start_at", name="shifts_time_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    start_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer)

    event: Mapped[Event] = relationship(back_populates="shifts")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("volunteer_id", "shift_id", name="applications_volunteer_shift_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    volunteer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id", ondelete="SET NULL"))
    status: Mapped[ApplicationStatus] = mapped_column(
        pg_enum(ApplicationStatus, "application_status"), default=ApplicationStatus.PENDING
    )
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    event: Mapped[Event] = relationship()
    volunteer: Mapped[User] = relationship()
    shift: Mapped[Shift | None] = relationship()
    participation: Mapped["Participation | None"] = relationship(back_populates="application")


class Participation(Base):
    __tablename__ = "participations"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), unique=True)
    attended: Mapped[bool] = mapped_column(Boolean)
    marked_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    marked_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[Application] = relationship(back_populates="participation")
    hours: Mapped["VolunteerHours | None"] = relationship(back_populates="participation")


class VolunteerHours(Base):
    __tablename__ = "volunteer_hours"
    __table_args__ = (CheckConstraint("hours > 0 AND hours <= 24", name="volunteer_hours_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    participation_id: Mapped[int] = mapped_column(ForeignKey("participations.id", ondelete="CASCADE"), unique=True)
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    confirmed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    confirmed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    participation: Mapped[Participation] = relationship(back_populates="hours")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)


class EventSkill(Base):
    __tablename__ = "event_skills"

    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)


class UserSkill(Base):
    __tablename__ = "user_skills"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("event_id", "volunteer_id", name="reviews_event_volunteer_key"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="reviews_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    volunteer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship()
    volunteer: Mapped[User] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
