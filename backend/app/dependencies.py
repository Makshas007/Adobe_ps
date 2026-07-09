from __future__ import annotations


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
        api_key=settings.gemini_api_key.get_secret_value(),
        model=settings.gemini_model,
    )


def get_planner(
    gemini: GeminiService = Depends(get_gemini_service),
) -> Planner:
    return Planner(gemini_service=gemini)


_pipeline_executor: PipelineExecutor | None = None

def get_pipeline_executor() -> PipelineExecutor:
    global _pipeline_executor
    if _pipeline_executor is None:
        _pipeline_executor = PipelineExecutor()
    return _pipeline_executor
