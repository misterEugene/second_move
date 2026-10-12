# ДоброРядом

Веб-приложение для поиска и организации волонтёрских мероприятий: волонтёр находит мероприятие, подаёт заявку, записывается на смену и получает часы, подтверждённые организатором.

## Стек

| Часть | Технологии |
|---|---|
| Frontend | React 18 + TypeScript, Vite, React Router, CSS |
| Backend | Python, FastAPI, REST API, OpenAPI-документация |
| База данных | PostgreSQL, SQLAlchemy 2, миграции Alembic |
| Аутентификация | JWT, пароли хранятся в виде bcrypt-хэша |
| Развёртывание | Docker Compose (PostgreSQL + API + nginx) |

## Запуск через Docker

```bash
cp .env.example .env   # задайте JWT_SECRET
docker compose up --build
```

Приложение: http://localhost:8080, документация API: http://localhost:8080/api/docs.

## Локальная разработка

Нужны Python 3.10+, Node.js 20+ и PostgreSQL 14+ (с UTF-8 локалью).

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # укажите DATABASE_URL и JWT_SECRET
alembic upgrade head
python -m app.seed                # демо-данные
uvicorn app.main:app --reload     # http://localhost:8000/api/v1

# frontend (в другом терминале)
cd frontend
npm install
npm run dev                       # http://localhost:5173, /api проксируется на :8000
```

## Демо-пользователи

Пароль у всех: `password123`.

| Роль | Email |
|---|---|
| Волонтёр | ivan@dobro.local, anna@dobro.local, dmitry@dobro.local, elena@dobro.local |
| Организатор | eco@dobro.local, care@dobro.local, kids@dobro.local |
| Администратор | admin@dobro.local |

## Тесты

Тесты API покрывают сценарии TC-01…TC-11 из ТЗ, а также проверки ролей, лимитов и параллельных одобрений. Им нужна отдельная база, которая очищается перед запуском:

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/dobro_test pytest
```

## Структура

```
backend/
  alembic/              миграции БД
  app/
    main.py             приложение FastAPI
    models.py           таблицы (SQLAlchemy)
    schemas.py          входные данные и валидация (Pydantic)
    deps.py             текущий пользователь и проверка ролей
    services.py         общие правила: права на мероприятие, занятость мест
    seed.py             демо-данные
    routers/            auth, events, applications, attendance, profile,
                        reviews, organizations, organizer, admin, notifications
  tests/                тесты API
frontend/
  src/pages/            страницы: публичные, cabinet/, organizer/, admin/
  src/components/       общие компоненты
  src/lib/              авторизация, форматирование, формы
```

## Ключевые правила

- Права проверяются на сервере: зависимости FastAPI проверяют роль, а каждое действие организатора — владение мероприятием.
- Часы начисляются только организатором мероприятия (или администратором) после отметки фактического участия. Подтвердить их можно один раз; у волонтёра нет эндпоинта для изменения часов.
- Лимиты участников мероприятия и вместимость смен проверяются в транзакции с блокировкой строки мероприятия (`SELECT … FOR UPDATE`), поэтому одновременные одобрения не превышают лимит.
- Ошибки валидации возвращаются по полям (`{ message, errors: { field: text } }`) и показываются рядом с полями формы.
