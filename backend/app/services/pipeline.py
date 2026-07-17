from __future__ import annotations

import gc
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

from app.config import settings
from app.services.execution_log import ExecutionLog, ExecutionLogEntry, LogStatus
from app.services.model_manager import ModelManager
from app.utils.image_utils import ensure_rgb, image_to_base64, save_image
from app.utils.logger import get_logger

logger = get_logger(__name__)


class OperationHandler:
    def __init__(self, model_manager: ModelManager) -> None:
        self.model_manager = model_manager

    @staticmethod
    def _is_human_image(image: Image.Image) -> bool:
        """Detect whether the image contains a human face.

        Uses OpenCV Haar cascade when available (OpenCV <5).
        Falls back to non-human path on any failure.
        """
        try:
            import cv2
            if not hasattr(cv2, "CascadeClassifier"):
                return False
            gray = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
            max_dim = 640
            h, w = gray.shape[:2]
            if max(h, w) > max_dim:
                scale = max_dim / max(h, w)
                gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            face_cascade = cv2.CascadeClassifier(cascade_path)
            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30)
            )
            detected = len(faces) > 0
            logger.info("Human detection: %s (%d face(s) found)", detected, len(faces))
            return detected
        except Exception:
            return False

    def handle_segment(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: segment target='%s'", params.get("target", ""))
        service = self.model_manager.load_sam()
        result_image, mask = service.segment_object(image, params)

        if context is not None:
            context["mask"] = mask

        if params.get("save_mask", True):
            mask_path = save_image(
                mask, settings.temp_path, prefix="mask_"
            )
            details = {"mask": str(mask_path)}
        else:
            details = {}

        from app.utils.image_utils import image_to_base64
        mask_b64 = image_to_base64(mask.convert("L")) if mask else ""
        details["mask_image"] = mask_b64

        return result_image, details

    def handle_remove(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: remove")
        mask = context.get("mask") if context else None
        prompt = params.get("instruction", "remove the main subject, clean background")

        process_params: Dict[str, Any] = {
            "prompt": f"empty background, {prompt}",
            "negative_prompt": "object, subject, person, thing, detail",
            "guidance_scale": 7.5,
            "strength": 0.85,
            "steps": 30,
        }

        if mask is not None:
            logger.info("Using SAM mask for guided inpainting removal")
            process_params["mask"] = mask
            service = self.model_manager.load_diffusion(model_type="inpaint")
        else:
            service = self.model_manager.load_diffusion()

        result = service.process("remove", image, process_params)
        return result, {}

    def handle_replace_background(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: replace_background with '%s'", params.get("instruction", ""))
        mask = context.get("mask") if context else None

        process_params: Dict[str, Any] = {
            "instruction": params.get("instruction", "change background"),
            "guidance_scale": 7.5,
            "image_guidance_scale": 1.5,
            "strength": 0.8,
            "steps": 30,
        }

        if mask is not None:
            logger.info("Using SAM mask for guided background replacement")
            # Invert: inpaint background (unmasked area), keep foreground (masked area)
            inv_mask = Image.fromarray(
                255 - np.array(mask.convert("L")), mode="L"
            )
            process_params["mask"] = inv_mask
            process_params["prompt"] = process_params.pop("instruction")
            service = self.model_manager.load_diffusion(model_type="inpaint")
        else:
            service = self.model_manager.load_diffusion()

        result = service.process("replace_background", image, process_params)
        return result, {}

    def _fallback_remove_bg(self, image: Image.Image, context: Optional[Dict[str, Any]] = None) -> Image.Image:
        logger.warning("rembg failed. Falling back to SAM-based background removal.")
        if context is None or "mask" not in context:
            _, mask_details = self.handle_segment(image, {"target": "main subject", "save_mask": False}, context)
            if context is None:
                context = {}
            mask = mask_details.get("mask_image")
            if mask is None:
                return image
        else:
            mask = context.get("mask")
        if mask is None:
            return image
        from PIL import ImageFilter
        mask = mask.convert("L").resize(image.size)
        mask = mask.filter(ImageFilter.SMOOTH)
        mask = mask.point(lambda p: 255 if p > 60 else 0)
        image_rgba = image.convert("RGBA")
        image_rgba.putalpha(mask)
        return image_rgba

    def handle_remove_background(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
        is_human = self._is_human_image(image)
        if is_human:
            logger.info("Pipeline step: remove_background (human-optimized path)")
        else:
            logger.info("Pipeline step: remove_background (general-object path)")

        import gc
        gc.collect()
        try:
            import torch
            torch.cuda.empty_cache()
            from app.utils.gpu import clear_gpu
            clear_gpu()
        except Exception:
            pass

        try:
            import rembg
            import numpy as np
            from PIL import ImageFilter

            if is_human:
                session = rembg.new_session("u2net_human_seg")
                logger.info("Using rembg model: u2net_human_seg")
            else:
                session = rembg.new_session("isnet-general-use")
                logger.info("Using rembg model: isnet-general-use")

            try:
                result = rembg.remove(
                    image,
                    session=session,
                    post_process_mask=True,
                )
            except Exception as rembg_err:
                err_str = str(rembg_err)
                if "Half" in err_str or "float" in err_str.lower() or "dtype" in err_str.lower():
                    logger.warning("rembg dtype error, falling back to SAM: %s", err_str)
                    result_rgba = self._fallback_remove_bg(image, context)
                    return result_rgba, {}
                raise

            if result.size != image.size:
                result = result.resize(image.size, Image.Resampling.LANCZOS)

            logger.debug("rembg result size after resize: %s", result.size)
            logger.debug("image size: %s", image.size)

            ai_alpha = np.array(result.split()[3])

            # ── Post-process alpha mask ────────────────────────────────────
            # Trust the AI mask directly. The LAB color-distance mask is
            # omitted because it assumes a uniform background color across the
            # entire image, which breaks when the foreground touches the
            # corners or the background is complex, causing the mask to become
            # fully opaque.

            # Dilation (3px) to recover clipped edge pixels (e.g. thin text).
            dilation = 5 if is_human else 3
            alpha_img = Image.fromarray(ai_alpha, mode="L")
            alpha_img = alpha_img.filter(ImageFilter.MaxFilter(dilation))

            # Gaussian feathering for smooth, natural edges.
            alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.5))

            # Re-threshold: interior fully opaque, border feathered,
            # background fully transparent.
            alpha_np = np.array(alpha_img, dtype=np.float32)
            alpha_np = np.where(alpha_np > 240, 255.0, alpha_np)
            alpha_np = np.where(alpha_np < 15, 0.0, alpha_np)
            alpha_img = Image.fromarray(alpha_np.astype(np.uint8), mode="L")

            # ── Final assembly ────────────────────────────────────────────
            orig_rgba = image.convert("RGBA")
            r_orig, g_orig, b_orig, _ = orig_rgba.split()
            result = Image.merge("RGBA", (r_orig, g_orig, b_orig, alpha_img))

            return result, {}
        except ImportError:
            logger.warning("rembg is not installed. Falling back to SAM (which has aliased edges).")
            # Make sure we have a mask, otherwise just segment the whole image's main subject
            if context is None or "mask" not in context:
                img_temp, mask_details = self.handle_segment(image, {"target": "main subject"}, context)
                if context is None:
                    context = {}
                if "mask" in mask_details:
                    context["mask"] = Image.open(mask_details["mask"])

            mask = context.get("mask")
            if mask is None:
                return image, {}

            # Convert image to RGBA
            image_rgba = image.convert("RGBA")
            # Ensure mask is L mode and same size
            mask_l = mask.convert("L").resize(image_rgba.size)

            # Apply mask to alpha channel
            image_rgba.putalpha(mask_l)
            return image_rgba, {}
        
    def handle_style_transfer(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
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

    def handle_change_style(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: change_style with '%s'", params.get("instruction", ""))
        return self.handle_style_transfer(image, params, context)

    def handle_upscale(
        self,
        image: Image.Image,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Image.Image, Dict[str, Any]]:
        logger.info("Pipeline step: upscale")
        service = self.model_manager.load_esrgan()
        result = service.upscale(image)
        return result, {}


class PipelineExecutor:
    def __init__(self) -> None:
        import asyncio
        self.model_manager = ModelManager(
            device=settings.resolved_device,
            cache_timeout_minutes=settings.model_cache_timeout_minutes,
        )
        self.handler = OperationHandler(self.model_manager)
        self._lock = asyncio.Lock()
        self._operation_map = {
            "segment": self.handler.handle_segment,
            "remove": self.handler.handle_remove,
            "replace_background": self.handler.handle_replace_background,
            "remove_background": self.handler.handle_remove_background,
            "style_transfer": self.handler.handle_style_transfer,
            "change_style": self.handler.handle_change_style,
            "upscale": self.handler.handle_upscale,
        }

    async def execute(
        self,
        plan: List[Dict[str, Any]],
        input_image: Image.Image,
        job_id: str,
    ) -> Tuple[List[Dict[str, Any]], ExecutionLog]:
        import asyncio
        async with self._lock:
            return await asyncio.to_thread(self._execute_sync, plan, input_image, job_id)

    def _get_model_name(self, op_name: str, params: Dict[str, Any]) -> str:
        if op_name == "segment":
            return "sam-vit-base"
        elif op_name == "remove":
            if params.get("mask") is not None:
                return "sd-inpaint"
            return "instruct-pix2pix"
        elif op_name == "replace_background":
            if params.get("mask") is not None:
                return "sd-inpaint"
            return "instruct-pix2pix"
        elif op_name in ("style_transfer", "change_style"):
            return "instruct-pix2pix"
        elif op_name == "upscale":
            return "esrgan"
        elif op_name == "remove_background":
            return "rembg"
        return ""

    def _build_log_entry(
        self,
        op_name: str,
        params: Dict[str, Any],
        status: LogStatus,
        duration: float,
        reason: str = "",
        model: str = "",
    ) -> ExecutionLogEntry:
        target = ""
        if op_name == "segment":
            target = params.get("target", "")
        elif op_name in ("replace_background", "remove_background"):
            target = "background"

        return ExecutionLogEntry(
            operation=op_name,
            target=target,
            model=model or self._get_model_name(op_name, params),
            parameters=params,
            status=status,
            reason=reason,
            duration=duration,
        )

    def _compute_mask(self, before: Image.Image, after: Image.Image) -> Image.Image:
        if after.size != before.size:
            after = after.resize(before.size, Image.Resampling.LANCZOS)
        before_np = np.array(before.convert("RGB"), dtype=np.float32)
        after_np = np.array(after.convert("RGB"), dtype=np.float32)
        diff = np.abs(before_np - after_np)
        diff_gray = diff.mean(axis=2)
        threshold = 5.0
        mask_np = np.where(diff_gray > threshold, 255, 0).astype(np.uint8)
        return Image.fromarray(mask_np, mode="L")

    def _execute_sync(
        self,
        plan: List[Dict[str, Any]],
        input_image: Image.Image,
        job_id: str,
    ) -> Tuple[List[Dict[str, Any]], ExecutionLog]:
        logger.info("Pipeline executing plan with %d steps for job %s", len(plan), job_id)
        current_image = input_image
        if current_image.mode != "RGBA":
            current_image = ensure_rgb(input_image)
        steps: List[Dict[str, Any]] = []
        execution_log = ExecutionLog()
        context: Dict[str, Any] = {}

        for step_index, operation in enumerate(plan):
            op_name = operation["operation"]
            params = {k: v for k, v in operation.items() if k != "operation"}

            logger.info(
                "Executing step %d/%d: %s",
                step_index + 1, len(plan), op_name,
            )
            step_start = time.monotonic()

            try:
                before_image = current_image.copy()

                handler = self._operation_map.get(op_name)
                if handler is None:
                    raise ValueError(f"No handler registered for operation: {op_name}")

                current_image, details = handler(current_image, params, context)
                if current_image.mode != "RGBA":
                    current_image = ensure_rgb(current_image)

                mask = details.pop("mask_image", None) if details else None
                if mask is None:
                    mask = self._compute_mask(before_image, current_image)
                else:
                    if isinstance(mask, Image.Image):
                        mask = mask.convert("L")
                    else:
                        mask = self._compute_mask(before_image, current_image)
                mask_b64 = image_to_base64(mask)

                intermediate = save_image(
                    current_image,
                    settings.output_path / job_id,
                    prefix=f"step_{step_index:02d}_",
                )

                step_duration = (time.monotonic() - step_start) * 1000
                step_entry = {
                    "operation": op_name,
                    "image": image_to_base64(current_image),
                    "mask": mask_b64,
                    "duration_ms": round(step_duration, 2),
                    "details": details if details else None,
                }
                steps.append(step_entry)

                log_entry = self._build_log_entry(
                    op_name=op_name,
                    params=params,
                    status=LogStatus.SUCCESS,
                    duration=step_duration,
                )
                execution_log.append(log_entry)

                logger.info(
                    "Step %d/%d complete: %s (%.0f ms)",
                    step_index + 1, len(plan), op_name, step_duration,
                )

                if context.get("mask") is not None and op_name != "segment":
                    context.pop("mask", None)

                gc.collect()

            except Exception as exc:
                step_duration = (time.monotonic() - step_start) * 1000
                logger.error(
                    "Pipeline step %d (%s) failed: %s",
                    step_index + 1, op_name, exc,
                )
                error_step = {
                    "operation": op_name,
                    "image": image_to_base64(current_image),
                    "duration_ms": round(step_duration, 2),
                    "error": str(exc),
                }
                steps.append(error_step)

                log_entry = self._build_log_entry(
                    op_name=op_name,
                    params=params,
                    status=LogStatus.FAILED,
                    duration=step_duration,
                    reason=str(exc),
                )
                execution_log.append(log_entry)

                self.model_manager.unload_current()
                gc.collect()
                raise RuntimeError(
                    f"Pipeline failed at step {step_index + 1} ({op_name}): {exc}"
                ) from exc

        self.model_manager.unload_current()

        logger.info(
            "Pipeline complete for job %s: %d steps executed",
            job_id, len(steps),
        )
        return steps, execution_log
