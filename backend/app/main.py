from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import edit, health, upload
from app.config import settings
from app.utils.logger import app_logger, setup_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logger(level=settings.log_level)
    app_logger.info("Starting Adobe Mock PS backend")
    app_logger.info("Device: %s", settings.resolved_device)
    from app.utils.gpu import cuda_available
    cuda_ok = cuda_available()
    app_logger.info("CUDA available: %s", cuda_ok)
    app_logger.info("Gemini configured: %s", settings.is_gemini_configured)

    for path_key in ("upload_path", "output_path", "temp_path"):
        p: Path = getattr(settings, path_key)
        p.mkdir(parents=True, exist_ok=True)
        app_logger.info("Ensured directory: %s", p)

    yield

    app_logger.info("Shutting down Adobe Mock PS backend")


app = FastAPI(
    title="Adobe Mock PS Backend",
    description="Prompt-based image editing backend with Gemini planning and local AI models",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    app_logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred",
            "error_code": "INTERNAL_ERROR",
            "suggestion": "Check server logs for details",
        },
    )


app.include_router(health.router)
app.include_router(upload.router)
app.include_router(edit.router)


@app.get("/")
async def root():
    return {
        "name": "Adobe Mock PS Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
