from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .errors import register_error_handlers
from .routers import (
    admin, applications, attendance, auth, events, notifications, organizations, organizer, profile, reviews, skills,
)

app = FastAPI(
    title="ДоброРядом API",
    description="REST API платформы волонтёрских мероприятий",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)
register_error_handlers(app)

origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

api = APIRouter(prefix="/api/v1")
for module in (auth, events, applications, attendance, profile, reviews, organizations, organizer, admin, notifications, skills):
    api.include_router(module.router)
app.include_router(api)
