from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


import re

class EditRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Natural language editing prompt")
    image: str = Field(..., description="Filename of the uploaded image")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional parameters")

    @field_validator("image")
    @classmethod
    def validate_image_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", v) or ".." in v:
            raise ValueError("Invalid image filename")
        return v



