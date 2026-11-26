import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import blueprint, health
from app.utils.errors import AppError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("flowforge")

app = FastAPI(title="FlowForge AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(blueprint.router)


@app.get("/")
def root():
    return {"message": "FlowForge Backend Running"}


@app.exception_handler(AppError)
def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    # AppError (and its AIProviderError subclass) carries a safe, already
    # user-facing message — nothing internal ever reaches this point.
    logger.error("AppError [%s]: %s", exc.code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    message = first.get("msg") or "Invalid request."
    if field:
        message = f"{field}: {message}"
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": message}},
    )


@app.exception_handler(Exception)
def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Full detail goes to the server log only; the client gets a generic,
    # safe message with no stack trace or environment information.
    logger.exception("Unhandled server error")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Something went wrong on our end. Please try again.",
            }
        },
    )
