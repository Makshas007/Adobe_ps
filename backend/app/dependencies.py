from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status

from app.config import Settings, settings
from app.services.gemini_service import GeminiService
from app.services.planner import Planner
from app.services.pipeline import PipelineExecutor
from app.utils.logger import get_logger

logger = get_logger(__name__)


def get_settings() -> Settings:
    return settings


def get_gemini_service(settings: Settings = Depends(get_settings)) -> GeminiService:
    if not settings.is_gemini_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "GEMINI_NOT_CONFIGURED",
                "detail": "Gemini API key not configured. Set GEMINI_API_KEY in .env",
                "suggestion": "Create a .env file with GEMINI_API_KEY=your_key",
            },
        )
    return GeminiService(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
    )


def get_planner(
    gemini: GeminiService = Depends(get_gemini_service),
) -> Planner:
    return Planner(gemini_service=gemini)


def get_pipeline_executor() -> PipelineExecutor:
    return PipelineExecutor()
