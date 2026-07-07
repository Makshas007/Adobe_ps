from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

from app.config import settings
from app.services.diffusion_service import DiffusionService
from app.services.esrgan_service import ESRGANService
from app.services.model_manager import ModelManager, ModelType
from app.services.sam_service import SAMService
from app.utils.image_utils import ensure_rgb, image_to_base64, save_image
from app.utils.logger import get_logger

logger = get_logger(__name__)


class OperationHandler:
    def __init__(self, model_manager: ModelManager) -> None:
        self.model_manager = model_manager

    def handle_segment(self, image: Image.Image, params: Dict[str, Any]) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: segment target='%s'", params.get("target", ""))
        service = self.model_manager.load_sam()
        result_image, mask = service.segment_object(image, params)

        if params.get("save_mask", True):
            mask_path = save_image(
                mask, settings.temp_path, prefix="mask_"
            )
            details = {"mask": str(mask_path)}
        else:
            details = {}

        return result_image, details

    def handle_remove(self, image: Image.Image, params: Dict[str, Any]) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: remove")
        service = self.model_manager.load_diffusion()
        prompt = params.get("instruction", "remove the main subject, clean background")
        process_params = {
            "prompt": f"empty background, {prompt}",
            "negative_prompt": "object, subject, person, thing, detail",
            "guidance_scale": 7.5,
            "strength": 0.85,
            "steps": 30,
        }
        result = service.process("remove", image, process_params)
        return result, {}

    def handle_replace_background(self, image: Image.Image, params: Dict[str, Any]) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: replace_background with '%s'", params.get("instruction", ""))
        service = self.model_manager.load_diffusion()
        process_params = {
            "instruction": params.get("instruction", "change background"),
            "guidance_scale": 7.5,
            "image_guidance_scale": 1.5,
            "strength": 0.8,
            "steps": 30,
        }
        result = service.process("replace_background", image, process_params)
        return result, {}

    def handle_style_transfer(self, image: Image.Image, params: Dict[str, Any]) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: style_transfer with '%s'", params.get("instruction", ""))
        service = self.model_manager.load_diffusion()
        process_params = {
            "instruction": params.get("instruction", "apply artistic style"),
            "guidance_scale": 7.5,
            "image_guidance_scale": 1.5,
            "strength": 0.75,
            "steps": 30,
        }
        result = service.process("style_transfer", image, process_params)
        return result, {}

    def handle_change_style(self, image: Image.Image, params: Dict[str, Any]) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: change_style with '%s'", params.get("instruction", ""))
        return self.handle_style_transfer(image, params)

    def handle_upscale(self, image: Image.Image, params: Dict[str, Any]) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: upscale")
        service = self.model_manager.load_esrgan()
        result = service.upscale(image)
        return result, {}


class PipelineExecutor:
    def __init__(self) -> None:
        self.model_manager = ModelManager(
            device=settings.resolved_device,
            cache_timeout_minutes=settings.model_cache_timeout_minutes,
        )
        self.handler = OperationHandler(self.model_manager)
        self._operation_map = {
            "segment": self.handler.handle_segment,
            "remove": self.handler.handle_remove,
            "replace_background": self.handler.handle_replace_background,
            "style_transfer": self.handler.handle_style_transfer,
            "change_style": self.handler.handle_change_style,
            "upscale": self.handler.handle_upscale,
        }

    async def execute(
        self,
        plan: List[Dict[str, Any]],
        input_image: Image.Image,
        job_id: str,
    ) -> List[Dict[str, Any]]:
        logger.info("Pipeline executing plan with %d steps for job %s", len(plan), job_id)
        current_image = ensure_rgb(input_image)
        steps: List[Dict[str, Any]] = []

        for step_index, operation in enumerate(plan):
            op_name = operation["operation"]
            params = {k: v for k, v in operation.items() if k != "operation"}

            logger.info(
                "Executing step %d/%d: %s",
                step_index + 1, len(plan), op_name,
            )
            step_start = time.monotonic()

            try:
                handler = self._operation_map.get(op_name)
                if handler is None:
                    raise ValueError(f"No handler registered for operation: {op_name}")

                current_image, details = handler(current_image, params)
                current_image = ensure_rgb(current_image)

                intermediate = save_image(
                    current_image,
                    settings.output_path / job_id,
                    prefix=f"step_{step_index:02d}_",
                )

                step_duration = (time.monotonic() - step_start) * 1000
                step_entry = {
                    "operation": op_name,
                    "image": image_to_base64(current_image),
                    "duration_ms": round(step_duration, 2),
                    "details": details if details else None,
                }
                steps.append(step_entry)

                logger.info(
                    "Step %d/%d complete: %s (%.0f ms)",
                    step_index + 1, len(plan), op_name, step_duration,
                )

            except Exception as exc:
                logger.error(
                    "Pipeline step %d (%s) failed: %s",
                    step_index + 1, op_name, exc,
                )
                error_step = {
                    "operation": op_name,
                    "image": image_to_base64(current_image),
                    "duration_ms": round((time.monotonic() - step_start) * 1000, 2),
                    "error": str(exc),
                }
                steps.append(error_step)
                raise RuntimeError(
                    f"Pipeline failed at step {step_index + 1} ({op_name}): {exc}"
                ) from exc
            finally:
                self.model_manager.unload_current()

        logger.info(
            "Pipeline complete for job %s: %d steps executed",
            job_id, len(steps),
        )
        return steps
