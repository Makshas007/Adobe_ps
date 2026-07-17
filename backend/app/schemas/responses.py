from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StepInfo(BaseModel):
    operation: str = Field(..., description="The operation performed")
    image: str = Field(..., description="Base64-encoded intermediate image")
    duration_ms: float = Field(0.0, description="Execution time in milliseconds")
    details: Optional[Dict[str, Any]] = None


class ExecutionLogEntryResponse(BaseModel):
    operation: str
    target: str = ""
    model: str = ""
    input: str = ""
    output: str = ""
    parameters: Dict[str, Any] = Field(default_factory=dict)
    status: str = "success"
    reason: str = ""
    duration: float = 0.0


class ChangeDescriptionResponse(BaseModel):
    operation: str = ""
    target: str = ""
    description: str = ""
    technical: str = ""


class ExplanationResponse(BaseModel):
    plain_english: str = ""
    technical_summary: str = ""
    changes: List[ChangeDescriptionResponse] = Field(default_factory=list)


class EditResponse(BaseModel):
    job_id: str
    status: str
    steps: List[StepInfo]
    final_image: str = Field(..., description="Base64-encoded final image")
    total_duration_ms: float = 0.0
    error: Optional[str] = None
    execution_log: List[ExecutionLogEntryResponse] = Field(default_factory=list)
    explanation: Optional[ExplanationResponse] = None


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

class UploadResponse(BaseModel):
    filename: str
    original_name: str
    size_bytes: int
    width: int
    height: int
    content_type: str
