from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EditRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Natural language editing prompt")
    image: str = Field(..., description="Filename of the uploaded image")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional parameters")


class UploadResponse(BaseModel):
    filename: str
    original_name: str
    size_bytes: int
    width: int
    height: int
    content_type: str
