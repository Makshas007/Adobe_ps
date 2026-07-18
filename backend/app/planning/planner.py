from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from app.planning.strategy import ExecutionPlan, PlanStep
from app.tools.registry import ToolRegistry
from app.utils.logger import get_logger

logger = get_logger(__name__)

PLANNER_SYSTEM_PROMPT = """You are an expert image editing planning agent.

Your task is to analyze the user's editing request together with the image metadata and available editing tools, then produce a structured execution plan.

IMAGE METADATA provides:
- Scene type (portrait, landscape, group_photo, etc.)
- Dominant colors and color palette
- Brightness, contrast, saturation levels
- Sharpness and blur detection
- Faces detected (count and positions)
- Lighting conditions
- Aspect ratio

AVAILABLE TOOLS are listed with:
- Name and purpose
- Best use cases and what to avoid
- Parameters and their ranges
- GPU cost and latency

You MUST reason step-by-step about:
1. What the image currently looks like (from metadata)
2. What the user wants to achieve
3. Which tools to use and in what order
4. What parameters for each tool
5. Whether prior steps need masks or intermediate results

Output ONLY valid JSON with this structure:
{
  "reasoning": "Step-by-step reasoning about the editing strategy...",
  "steps": [
    {
      "operation": "descriptive name of the step",
      "tool": "exact tool name from the registry",
      "params": { "param1": "value1", ... },
      "reasoning": "Why this step is needed",
      "priority": 1,
      "depends_on": [],
      "requires_mask": false,
      "expected_cost": "low"
    }
  ]
}

Rules:
- Output ONLY the JSON, no markdown, no explanation
- Maximum 12 steps
- Use the EXACT tool names from the provided tool list
- Set params values within the valid ranges
- Use depends_on to reference prior step operations when needed
- Set requires_mask=true if the tool needs a mask from a prior segmentation step
- Order steps by logical dependency (segment first, then edit, then enhance)
- Choose the cheapest tools that will work for each step
"""


class PlanningAgent:
    def __init__(self, gemini_service: Optional[Any] = None) -> None:
        self.gemini_service = gemini_service

    async def create_plan(
        self,
        prompt: str,
        image_metadata: Dict[str, Any],
    ) -> ExecutionPlan:
        if not self.gemini_service:
            return self._fallback_plan(prompt, image_metadata)

        tool_descriptions = ToolRegistry.get_tool_descriptions_for_prompt()
        metadata_text = self._metadata_to_text(image_metadata)

        full_prompt = f"""{PLANNER_SYSTEM_PROMPT}

IMAGE METADATA:
{metadata_text}

AVAILABLE TOOLS:
{tool_descriptions}

USER PROMPT:
{prompt}

Output the JSON plan:"""

        try:
            response = await self.gemini_service.generate_plan(full_prompt)
            plan_data = self._parse_response(response)
            return self._build_plan(plan_data, prompt, image_metadata)
        except Exception as exc:
            logger.warning("Gemini planning failed, falling back: %s", exc)
            return self._fallback_plan(prompt, image_metadata)

    def _metadata_to_text(self, metadata: Dict[str, Any]) -> str:
        lines = []
        for key, value in metadata.items():
            if isinstance(value, list):
                if value and isinstance(value[0], dict):
                    lines.append(f"- {key}:")
                    for item in value[:5]:
                        lines.append(f"  - {item}")
                else:
                    lines.append(f"- {key}: {value}")
            elif isinstance(value, float):
                lines.append(f"- {key}: {value:.2f}")
            else:
                lines.append(f"- {key}: {value}")
        return "\n".join(lines)

    def _parse_response(self, response: Any) -> Dict[str, Any]:
        text = response
        if hasattr(response, "text"):
            text = response.text

        text = str(text).strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
            return {}
        except json.JSONDecodeError:
            logger.error("Failed to parse planner JSON response")
            return {}

    def _build_plan(
        self,
        data: Dict[str, Any],
        prompt: str,
        metadata: Dict[str, Any],
    ) -> ExecutionPlan:
        plan = ExecutionPlan(
            reasoning=data.get("reasoning", ""),
        )
        steps_data = data.get("steps", [])
        for step_data in steps_data:
            step = PlanStep(
                operation=step_data.get("operation", "edit"),
                tool=step_data.get("tool", ""),
                params=step_data.get("params", {}),
                reasoning=step_data.get("reasoning", ""),
                priority=step_data.get("priority", 0),
                depends_on=step_data.get("depends_on", []),
                requires_mask=step_data.get("requires_mask", False),
                mask_source=step_data.get("mask_source"),
                expected_cost=step_data.get("expected_cost", "low"),
            )
            plan.add_step(step)
        return plan

    def _fallback_plan(self, prompt: str, metadata: Dict[str, Any]) -> ExecutionPlan:
        p = prompt.lower()
        plan = ExecutionPlan(reasoning="Fallback heuristic plan (no LLM available)")

        if "remove background" in p or "transparent" in p:
            plan.add_step(PlanStep(
                operation="segment main subject",
                tool="segment",
                params={"target": "main subject"},
                reasoning="Segment the main subject to create a mask",
                priority=1,
                requires_mask=False,
            ))
            plan.add_step(PlanStep(
                operation="remove background",
                tool="background_removal",
                params={},
                reasoning="Remove the background using the mask",
                priority=2,
                requires_mask=True,
                mask_source="segment main subject",
            ))
        elif "upscale" in p or "enhance resolution" in p:
            plan.add_step(PlanStep(
                operation="upscale image",
                tool="upscale",
                params={"scale": 4},
                reasoning="Increase image resolution",
                priority=1,
            ))
        elif "bright" in p or "exposure" in p:
            plan.add_step(PlanStep(
                operation="adjust brightness",
                tool="brightness",
                params={"value": 20},
                reasoning="Increase brightness",
                priority=1,
            ))
        elif "sharpen" in p:
            plan.add_step(PlanStep(
                operation="sharpen image",
                tool="sharpen",
                params={"amount": 1.5},
                reasoning="Sharpen the image",
                priority=1,
            ))
        elif "denoise" in p or "noise" in p:
            plan.add_step(PlanStep(
                operation="denoise image",
                tool="denoise",
                params={"strength": 10},
                reasoning="Reduce image noise",
                priority=1,
            ))
        else:
            plan.add_step(PlanStep(
                operation="analyze and edit",
                tool="style_transfer",
                params={"instruction": prompt},
                reasoning="Apply general edit based on user prompt",
                priority=1,
            ))

        return plan
