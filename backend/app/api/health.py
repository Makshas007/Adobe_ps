from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from app.config import Settings
from app.dependencies import get_settings
from app.schemas.responses import HealthResponse
from app.utils.gpu import cuda_available

router = APIRouter(tags=["health"])

_start_time = time.monotonic()


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="1.0.0",
        cuda_available=cuda_available(),
        device=settings.resolved_device,
        gemini_configured=settings.is_gemini_configured,
        uptime_seconds=time.monotonic() - _start_time,
    )
