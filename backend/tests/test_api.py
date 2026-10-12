"""Сценарии TC-01…TC-11 из ТЗ, плюс проверки ролей и лимитов. Тесты идут по порядку и делят состояние."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Role, User
from app.security import hash_password

API = "/api/v1"
S: dict = {"tokens": {}, "apps": {}}


def day(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


EVENT_DATE = day(3)


def auth(who: str) -> dict:
    return {"Authorization": f"Bearer {S['tokens'][who]}"}


def register(client, who: str, **body):
    r = client.post(f"{API}/auth/register", json={"password": "password123", **body})
    assert r.status_code == 201, r.text
    S["tokens"][who] = r.json()["token"]
    return r.json()


# --- Регистрация и вход ---

def test_admin_login(client):
    with SessionLocal() as db:
        db.add(User(name="Админ", email="admin@test.ru", role=Role.ADMIN, password_hash=hash_password("password123")))
        db.commit()
    r = client.post(f"{API}/auth/login", json={"email": "admin@test.ru", "password": "password123"})
    assert r.status_code == 200
    S["tokens"]["admin"] = r.json()["token"]


def test_tc01_register_new_email(client):
    body = register(client, "v1", name="Волонтёр Один", email="V1@Test.ru")
    assert body["user"]["email"] == "v1@test.ru" and body["user"]["role"] == "VOLUNTEER"
    assert "password_hash" not in body["user"]
    with SessionLocal() as db:
        stored = db.scalars(select(User).where(User.email == "v1@test.ru")).one()
        assert "password123" not in stored.password_hash


def test_tc02_duplicate_email(client):
    r = client.post(f"{API}/auth/register", json={"name": "Двойник", "email": "v1@test.ru", "password": "password123"})
    assert r.status_code == 400 and "email" in r.json()["errors"]


def test_field_errors(client):
    r = client.post(f"{API}/auth/register", json={"name": "А", "email": "bad", "password": "1"})
    assert r.status_code == 400
    assert sorted(r.json()["errors"]) == ["email", "name", "password"]


def test_cannot_register_admin(client):
    r = client.post(f"{API}/auth/register", json={"name": "Хакер", "email": "h@test.ru", "password": "password123", "role": "ADMIN"})
    assert r.status_code == 400


def test_organizer_needs_organization_name(client):
    r = client.post(f"{API}/auth/register", json={"name": "Орг", "email": "o@test.ru", "password": "password123", "role": "ORGANIZER"})
    assert r.status_code == 400 and "organizationName" in r.json()["errors"]


def test_wrong_password(client):
    assert client.post(f"{API}/auth/login", json={"email": "v1@test.ru", "password": "wrong-pass"}).status_code == 401


def test_register_others(client):
    register(client, "v2", name="Волонтёр Два", email="v2@test.ru")
    register(client, "v3", name="Волонтёр Три", email="v3@test.ru")
    register(client, "org", name="Организатор", email="org@test.ru", role="ORGANIZER", organizationName="Эко-клуб")
    register(client, "org2", name="Чужой организатор", email="org2@test.ru", role="ORGANIZER", organizationName="Другие")


# --- Мероприятия и каталог ---

def test_create_event_and_shift(client):
    r = client.post(f"{API}/events", headers=auth("org"), json={
        "title": "Уборка набережной", "description": "Собираем мусор на набережной вместе с жителями района.",
        "category": "ECOLOGY", "date": EVENT_DATE, "city": "Ростов-на-Дону", "limit": 2, "skills": ["Командная работа"],
    })
    assert r.status_code == 201, r.text
    body = r.json()
    S["event"] = body["id"]
    assert body["freePlaces"] == 2 and body["skills"] == ["Командная работа"] and body["canManage"]

    r = client.post(f"{API}/events/{S['event']}/shifts", headers=auth("org"), json={
        "startAt": f"{EVENT_DATE}T10:00:00Z", "endAt": f"{EVENT_DATE}T14:00:00Z", "capacity": 1,
    })
    assert r.status_code == 201, r.text
    S["shift"] = r.json()["id"]

    r = client.post(f"{API}/events", headers=auth("org"), json={
        "title": "Чтения в библиотеке", "description": "Читаем детям сказки в районной библиотеке по выходным.",
        "category": "EDUCATION", "date": day(5), "city": "Краснодар", "limit": 5,
    })
    assert r.status_code == 201


def test_shift_end_before_start(client):
    r = client.post(f"{API}/events/{S['event']}/shifts", headers=auth("org"), json={
        "startAt": f"{EVENT_DATE}T14:00:00Z", "endAt": f"{EVENT_DATE}T10:00:00Z", "capacity": 1,
    })
    assert r.status_code == 400 and "endAt" in r.json()["errors"]


def test_tc03_guest_catalog(client):
    r = client.get(f"{API}/events")
    assert r.status_code == 200 and r.json()["total"] == 2


def test_tc04_filters(client):
    eco = client.get(f"{API}/events", params={"category": "ECOLOGY"}).json()
    assert [e["title"] for e in eco["items"]] == ["Уборка набережной"]
    city = client.get(f"{API}/events", params={"city": "краснодар"}).json()
    assert [e["title"] for e in city["items"]] == ["Чтения в библиотеке"]
    assert client.get(f"{API}/events", params={"category": "UNKNOWN"}).status_code == 400


def test_foreign_organizer_cannot_edit(client):
    assert client.patch(f"{API}/events/{S['event']}", headers=auth("org2"), json={"limit": 50}).status_code == 403


# --- Заявки, лимиты и роли ---

def test_guest_cannot_apply(client):
    assert client.post(f"{API}/events/{S['event']}/apply", json={}).status_code == 401


def test_tc05_apply(client):
    for v in ("v1", "v2", "v3"):
        r = client.post(f"{API}/events/{S['event']}/apply", headers=auth(v), json={})
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "PENDING"
        S["apps"][v] = r.json()["id"]
    assert client.post(f"{API}/events/{S['event']}/apply", headers=auth("v1"), json={}).status_code == 409
    assert client.get(f"{API}/notifications", headers=auth("org")).json()["unread"] == 3


def test_tc06_rbac(client):
    assert client.get(f"{API}/organizer/events", headers=auth("v1")).status_code == 403
    assert client.get(f"{API}/events/{S['event']}/applications", headers=auth("v1")).status_code == 403
    assert client.patch(f"{API}/applications/{S['apps']['v1']}", headers=auth("v1"), json={"status": "APPROVED"}).status_code == 403
    assert client.get(f"{API}/admin/users", headers=auth("org")).status_code == 403


def test_foreign_organizer_cannot_process(client):
    r = client.patch(f"{API}/applications/{S['apps']['v1']}", headers=auth("org2"), json={"status": "APPROVED"})
    assert r.status_code == 403


def test_shift_before_approval(client):
    r = client.put(f"{API}/applications/{S['apps']['v1']}/shift", headers=auth("v1"), json={"shiftId": S["shift"]})
    assert r.status_code == 403


def test_approve_within_limit(client):
    for v in ("v1", "v2"):
        r = client.patch(f"{API}/applications/{S['apps'][v]}", headers=auth("org"), json={"status": "APPROVED"})
        assert r.status_code == 200
    r = client.patch(f"{API}/applications/{S['apps']['v3']}", headers=auth("org"), json={"status": "APPROVED"})
    assert r.status_code == 409 and "лимит" in r.json()["message"]
    assert client.get(f"{API}/events/{S['event']}").json()["freePlaces"] == 0


def test_tc07_shift_without_places(client):
    shift = {"shiftId": S["shift"]}
    assert client.put(f"{API}/applications/{S['apps']['v1']}/shift", headers=auth("v1"), json=shift).status_code == 200
    assert client.put(f"{API}/applications/{S['apps']['v2']}/shift", headers=auth("v2"), json=shift).status_code == 409
    assert client.put(f"{API}/applications/{S['apps']['v1']}/shift", headers=auth("v2"), json=shift).status_code == 404


def test_parallel_approvals_respect_limit(client):
    r = client.post(f"{API}/events", headers=auth("org"), json={
        "title": "Одно место", "description": "Мероприятие с одним местом для проверки гонок.",
        "category": "SOCIAL", "date": day(4), "city": "Ростов-на-Дону", "limit": 1,
    })
    event_id = r.json()["id"]
    ids = [client.post(f"{API}/events/{event_id}/apply", headers=auth(v), json={}).json()["id"] for v in ("v1", "v2", "v3")]
    with ThreadPoolExecutor(3) as pool:
        codes = list(pool.map(
            lambda i: client.patch(f"{API}/applications/{i}", headers=auth("org"), json={"status": "APPROVED"}).status_code,
            ids,
        ))
    assert sorted(codes) == [200, 409, 409]


# --- Участие и часы ---

def test_tc08_mark_attendance(client):
    r = client.post(f"{API}/participations/{S['apps']['v1']}", headers=auth("org"), json={"attended": True})
    assert r.status_code == 200
    S["participation"] = r.json()["id"]
    assert client.post(f"{API}/participations/{S['apps']['v2']}", headers=auth("org"), json={"attended": True}).status_code == 200
    assert client.post(f"{API}/participations/{S['apps']['v3']}", headers=auth("org"), json={"attended": True}).status_code == 409


def test_tc10_volunteer_cannot_change_hours(client):
    r = client.post(f"{API}/hours/{S['participation']}/confirm", headers=auth("v1"), json={"hours": 100})
    assert r.status_code == 403
    r = client.patch(f"{API}/profile", headers=auth("v1"), json={"totalHours": 100})
    assert r.status_code == 400 and "totalHours" in r.json()["errors"]


def test_foreign_organizer_cannot_confirm(client):
    r = client.post(f"{API}/hours/{S['participation']}/confirm", headers=auth("org2"), json={"hours": 4})
    assert r.status_code == 403


def test_hours_not_above_shift(client):
    r = client.post(f"{API}/hours/{S['participation']}/confirm", headers=auth("org"), json={"hours": 5})
    assert r.status_code == 400 and "hours" in r.json()["errors"]


def test_tc09_confirm_hours_visible_in_stats(client):
    r = client.post(f"{API}/hours/{S['participation']}/confirm", headers=auth("org"), json={"hours": 4})
    assert r.status_code == 201, r.text
    stats = client.get(f"{API}/profile/statistics", headers=auth("v1")).json()
    assert stats["totalHours"] == 4
    assert stats["byCategory"] == [{"category": "ECOLOGY", "hours": 4}]


def test_unconfirmed_hours_not_counted(client):
    assert client.get(f"{API}/profile/statistics", headers=auth("v2")).json()["totalHours"] == 0


def test_no_reconfirm_or_remark(client):
    assert client.post(f"{API}/hours/{S['participation']}/confirm", headers=auth("org"), json={"hours": 2}).status_code == 409
    assert client.post(f"{API}/participations/{S['apps']['v1']}", headers=auth("org"), json={"attended": False}).status_code == 409


# --- Отзывы ---

def test_tc11_review_after_participation(client):
    body = {"eventId": S["event"], "rating": 5, "text": "Отлично!"}
    assert client.post(f"{API}/reviews", headers=auth("v1"), json=body).status_code == 201
    assert client.post(f"{API}/reviews", headers=auth("v1"), json={**body, "rating": 4}).status_code == 409
    orgs = client.get(f"{API}/organizations").json()
    assert next(o for o in orgs if o["name"] == "Эко-клуб")["rating"] == {"average": 5, "count": 1}


def test_review_requires_participation(client):
    r = client.post(f"{API}/reviews", headers=auth("v3"), json={"eventId": S["event"], "rating": 1, "text": "Плохо"})
    assert r.status_code == 403


# --- Администрирование ---

def test_admin_hides_event(client):
    assert client.patch(f"{API}/admin/events/{S['event']}", headers=auth("admin"), json={"status": "HIDDEN"}).status_code == 200
    assert client.get(f"{API}/events/{S['event']}").status_code == 404
    assert client.get(f"{API}/events/{S['event']}", headers=auth("org")).status_code == 200


def test_blocked_user_loses_access(client):
    with SessionLocal() as db:
        user_id = db.scalars(select(User.id).where(User.email == "v3@test.ru")).one()
    assert client.patch(f"{API}/admin/users/{user_id}", headers=auth("admin"), json={"blocked": True}).status_code == 200
    assert client.get(f"{API}/applications/my", headers=auth("v3")).status_code == 403
    assert client.post(f"{API}/auth/login", json={"email": "v3@test.ru", "password": "password123"}).status_code == 403
