from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StepInfo(BaseModel):
    operation: str = Field(..., description="The operation performed")
    image: str = Field(..., description="Base64-encoded intermediate image")
    duration_ms: float = Field(0.0, description="Execution time in milliseconds")
    details: Optional[Dict[str, Any]] = None


class EditResponse(BaseModel):
    job_id: str
    status: str
    steps: List[StepInfo]
    final_image: str = Field(..., description="Base64-encoded final image")
    total_duration_ms: float = 0.0
    error: Optional[str] = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: str
    progress: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    cuda_available: bool
    device: str
    gemini_configured: bool
    uptime_seconds: float


class ErrorResponse(BaseModel):
    detail: str
    error_code: str
    suggestion: Optional[str] = None
