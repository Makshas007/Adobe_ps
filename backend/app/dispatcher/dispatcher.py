from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

from app.planning.strategy import ExecutionPlan, PlanStep
from app.services.execution_log import ExecutionLog, ExecutionLogEntry, LogStatus
from app.services.model_manager import ModelManager
from app.tools.registry import ToolRegistry
from app.utils.image_utils import ensure_rgb
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ToolDispatcher:
    def __init__(self, model_manager: Optional[ModelManager] = None):
        self.model_manager = model_manager

    async def execute_plan(
        self,
        plan: ExecutionPlan,
        input_image: Image.Image,
        job_id: str,
    ) -> Tuple[List[Dict[str, Any]], ExecutionLog]:
        current_image = ensure_rgb(input_image)
        steps: List[Dict[str, Any]] = []
        execution_log = ExecutionLog()
        context: Dict[str, Any] = {}
        completed_steps: Dict[str, Image.Image] = {}

        import asyncio
        import time

        for step_index, step in enumerate(plan.steps):
            logger.info(
                "Dispatcher executing step %d/%d: %s (tool: %s)",
                step_index + 1, len(plan.steps),
                step.operation, step.tool,
            )
            step_start = time.monotonic()

            try:
                before_image = current_image.copy()
                step_context = dict(context)

                if step.depends_on:
                    for dep in step.depends_on:
                        if dep in completed_steps:
                            pass

                if step.requires_mask and step.mask_source:
                    if step.mask_source in context:
                        step_context["mask"] = context[step.mask_source]
                    elif "mask" in context:
                        step_context["mask"] = context["mask"]

                result_image: Optional[Image.Image] = None
                details: Dict[str, Any] = {}

                tool = ToolRegistry.get_tool(step.tool)
                if tool is not None:
                    result_image, details = await tool.execute(
                        current_image, step.params, step_context
                    )
                else:
                    handler_fn = self._get_legacy_handler(step.tool)
                    if handler_fn:
                        result_image, details = handler_fn(current_image, step.params, step_context)
                    else:
                        raise ValueError(f"No tool or handler for: {step.tool}")

                if result_image is not None:
                    current_image = ensure_rgb(result_image)
                    completed_steps[step.operation] = current_image

                if "mask" in details:
                    context[step.operation] = details["mask"]
                    context["mask"] = details["mask"]

                step_duration = (time.monotonic() - step_start) * 1000
                from app.utils.image_utils import image_to_base64, save_image
                from app.config import settings
                import numpy as np
                import io, base64

                mask_pil = None
                mask_override = details.pop("mask_image", None) if details else None
                if mask_override:
                    if isinstance(mask_override, str):
                        mask_pil = Image.open(io.BytesIO(base64.b64decode(mask_override))).convert("L")
                    elif isinstance(mask_override, Image.Image):
                        mask_pil = mask_override.convert("L")
                else:
                    before_np = np.array(before_image.convert("RGB"), dtype=np.float32)
                    after_np = np.array(current_image.convert("RGB"), dtype=np.float32)
                    diff = np.abs(before_np - after_np).mean(axis=2)
                    mask_np = np.where(diff > 5.0, 255, 0).astype(np.uint8)
                    mask_pil = Image.fromarray(mask_np, mode="L")

                mask_b64 = image_to_base64(mask_pil)

                intermediate = save_image(
                    current_image,
                    settings.output_path / job_id,
                    prefix=f"step_{step_index:02d}_",
                )

                step_entry = {
                    "operation": step.operation,
                    "tool": step.tool,
                    "image": image_to_base64(current_image),
                    "mask": mask_b64,
                    "duration_ms": round(step_duration, 2),
                    "details": details if details else None,
                }
                steps.append(step_entry)

                log_entry = ExecutionLogEntry(
                    operation=step.tool,
                    target=step.operation,
                    model=tool.spec.name if tool else step.tool,
                    parameters=step.params,
                    status=LogStatus.SUCCESS,
                    duration=step_duration,
                )
                execution_log.append(log_entry)

                logger.info(
                    "Step %d/%d complete: %s (%.0f ms)",
                    step_index + 1, len(plan.steps), step.operation, step_duration,
                )

            except Exception as exc:
                step_duration = (time.monotonic() - step_start) * 1000
                logger.error("Dispatcher step %d failed: %s", step_index + 1, exc)
                error_step = {
                    "operation": step.operation,
                    "tool": step.tool,
                    "image": None,
                    "duration_ms": round(step_duration, 2),
                    "error": str(exc),
                }
                steps.append(error_step)
                log_entry = ExecutionLogEntry(
                    operation=step.tool,
                    target=step.operation,
                    model=step.tool,
                    parameters=step.params,
                    status=LogStatus.FAILED,
                    duration=step_duration,
                    reason=str(exc),
                )
                execution_log.append(log_entry)
                raise RuntimeError(f"Dispatcher failed at step {step_index + 1}: {exc}") from exc

        return steps, execution_log

    def _get_legacy_handler(self, tool_name: str):
        from app.services.pipeline import OperationHandler
        handler = OperationHandler(self.model_manager)
        legacy_map = {
            "segment": handler.handle_segment,
            "remove": handler.handle_remove,
            "replace_background": handler.handle_replace_background,
            "remove_background": handler.handle_remove_background,
            "style_transfer": handler.handle_style_transfer,
            "change_style": handler.handle_change_style,
            "upscale": handler.handle_upscale,
        }
        return legacy_map.get(tool_name)
