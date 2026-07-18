from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from PIL import Image


@dataclass
class ToolSpec:
    name: str
    purpose: str
    strengths: List[str]
    weaknesses: List[str]
    best_for: List[str]
    avoid_for: List[str]
    required_inputs: List[str]
    outputs: List[str]
    compatible_tools: List[str]
    parameters: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    gpu_cost: str = "none"
    latency: str = "fast"
    category: str = "adjustment"
    description: str = ""


class EditingTool:
    spec: ToolSpec

    async def execute(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> tuple[Image.Image, Dict[str, Any]]:
        raise NotImplementedError

    def estimate_cost(self, image: Image.Image) -> Dict[str, Any]:
        w, h = image.size
        return {
            "gpu_cost": self.spec.gpu_cost,
            "latency": self.spec.latency,
            "pixels": w * h,
        }
