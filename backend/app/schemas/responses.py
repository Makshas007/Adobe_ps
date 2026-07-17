from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StepInfo(BaseModel):
    operation: str = Field(..., description="The operation performed")
    image: str = Field(..., description="Base64-encoded intermediate image")
    mask: Optional[str] = Field(None, description="Base64-encoded mask of changed region")
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


class SceneMetadataResponse(BaseModel):
    scene_type: str = "unknown"
    objects: List[Dict[str, Any]] = Field(default_factory=list)
    faces: List[Dict[str, Any]] = Field(default_factory=list)
    people_count: int = 0
    dominant_colors: List[Dict[str, Any]] = Field(default_factory=list)
    color_palette: List[str] = Field(default_factory=list)
    brightness: float = 0.0
    contrast: float = 0.0
    saturation: float = 0.0
    sharpness: float = 0.0
    noise_estimate: float = 0.0
    is_blurry: bool = False
    has_faces: bool = False
    has_text: bool = False
    has_sky: bool = False
    has_water: bool = False
    lighting: str = "unknown"
    aesthetic_score: float = 0.0
    aspect_ratio: str = ""
    width: int = 0
    height: int = 0


class PlanStepResponse(BaseModel):
    operation: str
    tool: str
    params: Dict[str, Any] = Field(default_factory=dict)
    reasoning: str = ""
    priority: int = 0
    depends_on: List[str] = Field(default_factory=list)
    requires_mask: bool = False
    expected_cost: str = "low"


class ExecutionPlanResponse(BaseModel):
    steps: List[PlanStepResponse] = Field(default_factory=list)
    reasoning: str = ""
    estimated_cost: str = "low"


class CritiqueResponse(BaseModel):
    passed: bool = True
    score: float = 1.0
    issues: List[Dict[str, Any]] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class EditResponse(BaseModel):
    job_id: str
    status: str
    steps: List[StepInfo]
    final_image: str = Field(..., description="Base64-encoded final image")
    total_duration_ms: float = 0.0
    error: Optional[str] = None
    execution_log: List[ExecutionLogEntryResponse] = Field(default_factory=list)
    explanation: Optional[ExplanationResponse] = None
    metadata: Optional[SceneMetadataResponse] = None
    plan: Optional[ExecutionPlanResponse] = None
    critique: Optional[CritiqueResponse] = None


class AnalyzeResponse(BaseModel):
    metadata: SceneMetadataResponse
    suggestions: List[str] = Field(default_factory=list)
    processing_time_ms: float = 0.0


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
