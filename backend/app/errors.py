from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Ошибка с ответом вида { message, errors: { field: text } }."""

    def __init__(self, status: int, message: str, errors: dict[str, str] | None = None):
        self.status = status
        self.message = message
        self.errors = errors or {}


def bad_request(message: str) -> AppError:
    return AppError(400, message)


def field_error(field: str, message: str) -> AppError:
    return AppError(400, message, {field: message})


def unauthorized(message: str = "Требуется авторизация") -> AppError:
    return AppError(401, message)


def forbidden(message: str = "Недостаточно прав для этого действия") -> AppError:
    return AppError(403, message)


def not_found(message: str) -> AppError:
    return AppError(404, message)


def conflict(message: str) -> AppError:
    return AppError(409, message)


def _translate(err: dict) -> str:
    """Сообщения Pydantic по-русски; свои ValueError из валидаторов передаются как есть."""
    kind = err["type"]
    ctx = err.get("ctx", {})
    if kind == "value_error" and "email address" in err["msg"]:
        return "Укажите корректный email"
    if kind == "value_error":
        return str(ctx.get("error", err["msg"])).removeprefix("Value error, ")
    messages = {
        "missing": "Обязательное поле",
        "string_too_short": f"Минимум {ctx.get('min_length')} симв.",
        "string_too_long": f"Максимум {ctx.get('max_length')} симв.",
        "too_long": f"Не больше {ctx.get('max_length')} элементов",
        "greater_than_equal": f"Значение должно быть не меньше {ctx.get('ge')}",
        "less_than_equal": f"Значение должно быть не больше {ctx.get('le')}",
        "greater_than": f"Значение должно быть больше {ctx.get('gt')}",
        "int_parsing": "Укажите целое число",
        "int_type": "Укажите целое число",
        "int_from_float": "Укажите целое число",
        "float_parsing": "Укажите число",
        "decimal_parsing": "Укажите число",
        "decimal_max_places": "Слишком много знаков после запятой",
        "bool_parsing": "Укажите да или нет",
        "bool_type": "Укажите да или нет",
        "date_from_datetime_parsing": "Некорректная дата",
        "date_parsing": "Некорректная дата",
        "datetime_from_date_parsing": "Некорректные дата и время",
        "datetime_parsing": "Некорректные дата и время",
        "enum": "Недопустимое значение",
        "literal_error": "Недопустимое значение",
        "extra_forbidden": "Это поле нельзя передавать",
        "url_parsing": "Укажите корректную ссылку",
        "url_scheme": "Ссылка должна начинаться с http:// или https://",
        "string_type": "Ожидается строка",
    }
    return messages.get(kind, err["msg"])


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse({"statusCode": exc.status, "message": exc.message, "errors": exc.errors}, exc.status)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Ошибка запроса"
        if exc.status_code == 404 and message == "Not Found":
            message = "Не найдено"
        return JSONResponse({"statusCode": exc.status_code, "message": message, "errors": {}}, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        errors: dict[str, str] = {}
        for err in exc.errors():
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            # Ошибки валидаторов уровня модели указывают поле через ctx["field"].
            key = (err.get("ctx") or {}).get("field") or ".".join(loc) or "body"
            errors.setdefault(key, _translate(err))
        return JSONResponse(
            {"statusCode": 400, "message": "Проверьте правильность заполнения полей", "errors": errors}, 400
        )
