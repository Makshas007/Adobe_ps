from __future__ import annotations

import re
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class EditRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="Natural language editing prompt")
    image: str = Field(..., description="Filename of uploaded image or a data:image URL")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional parameters")

    @field_validator("image")
    @classmethod
    def validate_image(cls, v: str) -> str:
        if v.startswith("data:image"):
            return v
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", v) or ".." in v:
            raise ValueError("Invalid image filename")
        return v
