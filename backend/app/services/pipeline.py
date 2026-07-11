from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

from app.config import settings
from app.services.model_manager import ModelManager
from app.utils.image_utils import ensure_rgb, image_to_base64, save_image
from app.utils.logger import get_logger

logger = get_logger(__name__)


class OperationHandler:
    def __init__(self, model_manager: ModelManager) -> None:
        self.model_manager = model_manager

    @staticmethod
    def _is_human_image(image: Image.Image) -> bool:
        """Detect whether the image contains a human face using OpenCV's cascade classifier.

        This is a lightweight check (~5ms) used to choose the right background
        removal model and edge-processing strategy.
        """
        try:
            import cv2
            gray = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
            # Resize for speed if the image is large
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
        except Exception as exc:
            logger.warning("Human detection failed, defaulting to non-human path: %s", exc)
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

        try:
            import rembg
            import numpy as np
            from PIL import ImageFilter

            # ── Choose rembg model based on content type ──────────────────
            if is_human:
                # u2net_human_seg is specifically trained for human matting
                # and produces dramatically better masks around hair, fingers,
                # and clothing edges compared to isnet-general-use.
                session = rembg.new_session("u2net_human_seg")
                logger.info("Using rembg model: u2net_human_seg")
            else:
                session = rembg.new_session("isnet-general-use")
                logger.info("Using rembg model: isnet-general-use")

            # Step 1: Get the AI mask from rembg
            result = rembg.remove(
                image,
                session=session,
                post_process_mask=True,
            )
            ai_alpha = np.array(result.split()[3])

            img_np = np.array(image.convert("RGB")).astype(np.float32)
            h, w = img_np.shape[:2]

            if is_human:
                # ── Human-specific path ───────────────────────────────────
                # For humans we trust the AI mask entirely and skip the LAB
                # color-distance mask. The color-distance approach assumes the
                # foreground is chromatically distant from the background,
                # which breaks on skin tones close to common bg colors (beige,
                # light gray, white) and causes body parts to be erased.
                combined_alpha = ai_alpha

                # Larger dilation (5px) to recover fine hair strands and
                # clothing fringes that the AI mask clips.
                alpha_img = Image.fromarray(combined_alpha, mode="L")
                alpha_img = alpha_img.filter(ImageFilter.MaxFilter(5))

                # Gaussian-feathered edges for a smooth, natural transition
                # instead of the harsh jagged boundary from binary masking.
                alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.5))

                # Re-threshold to keep the interior fully opaque while only
                # feathering the border pixels.
                alpha_np = np.array(alpha_img, dtype=np.float32)
                alpha_np = np.where(alpha_np > 240, 255.0, alpha_np)
                alpha_np = np.where(alpha_np < 15, 0.0, alpha_np)
                alpha_img = Image.fromarray(alpha_np.astype(np.uint8), mode="L")
            else:
                # ── General-object path (logos, products) ─────────────────
                # Unchanged from the original implementation.

                # Step 2: Detect the background color by sampling corners
                sample_size = max(10, min(h, w) // 20)
                corners = np.concatenate([
                    img_np[:sample_size, :sample_size].reshape(-1, 3),
                    img_np[:sample_size, -sample_size:].reshape(-1, 3),
                    img_np[-sample_size:, :sample_size].reshape(-1, 3),
                    img_np[-sample_size:, -sample_size:].reshape(-1, 3),
                ])
                bg_color = np.median(corners, axis=0)

                # Step 3: Perceptual color distance in LAB space
                def rgb_to_lab(rgb_array):
                    """Convert RGB (0-255 float) to LAB for perceptual distance."""
                    rgb = rgb_array / 255.0
                    mask = rgb > 0.04045
                    rgb = np.where(mask, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
                    x = rgb[..., 0] * 0.4124564 + rgb[..., 1] * 0.3575761 + rgb[..., 2] * 0.1804375
                    y = rgb[..., 0] * 0.2126729 + rgb[..., 1] * 0.7151522 + rgb[..., 2] * 0.0721750
                    z = rgb[..., 0] * 0.0193339 + rgb[..., 1] * 0.1191920 + rgb[..., 2] * 0.9503041
                    x, y, z = x / 0.95047, y / 1.0, z / 1.08883

                    def f(t):
                        delta = 6.0 / 29.0
                        return np.where(t > delta**3, t**(1.0/3.0), t / (3 * delta**2) + 4.0/29.0)
                    fx, fy, fz = f(x), f(y), f(z)
                    L = 116.0 * fy - 16.0
                    a = 500.0 * (fx - fy)
                    b = 200.0 * (fy - fz)
                    return np.stack([L, a, b], axis=-1)

                img_lab = rgb_to_lab(img_np)
                bg_lab = rgb_to_lab(bg_color.reshape(1, 1, 3)).reshape(3)
                diff = np.sqrt(np.sum((img_lab - bg_lab) ** 2, axis=2))
                color_alpha = np.clip((diff - 5.0) / 10.0, 0.0, 1.0) * 255.0
                color_alpha = color_alpha.astype(np.uint8)

                # Step 4: Combine AI mask with color-distance mask
                combined_alpha = np.maximum(ai_alpha, color_alpha)

                # Step 5: Dilate by 2px to recover clipped text edges
                alpha_img = Image.fromarray(combined_alpha, mode="L")
                alpha_img = alpha_img.filter(ImageFilter.MaxFilter(3))

            # ── Common final assembly ─────────────────────────────────────
            # Step 6: Assemble final RGBA using original image colors
            orig_rgba = image.convert("RGBA")
            r_orig, g_orig, b_orig, _ = orig_rgba.split()
            result = Image.merge("RGBA", (r_orig, g_orig, b_orig, alpha_img))

            # Step 7: Auto-crop transparent borders for a tight result
            bbox = result.getbbox()
            if bbox:
                pad_x = max(10, int(w * 0.02))
                pad_y = max(10, int(h * 0.02))
                crop_box = (
                    max(0, bbox[0] - pad_x),
                    max(0, bbox[1] - pad_y),
                    min(w, bbox[2] + pad_x),
                    min(h, bbox[3] + pad_y),
                )
                result = result.crop(crop_box)

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
    ) -> List[Dict[str, Any]]:
        import asyncio
        async with self._lock:
            return await asyncio.to_thread(self._execute_sync, plan, input_image, job_id)

    def _execute_sync(
        self,
        plan: List[Dict[str, Any]],
        input_image: Image.Image,
        job_id: str,
    ) -> List[Dict[str, Any]]:
        logger.info("Pipeline executing plan with %d steps for job %s", len(plan), job_id)
        current_image = input_image
        if current_image.mode != "RGBA":
            current_image = ensure_rgb(input_image)
        steps: List[Dict[str, Any]] = []
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
                handler = self._operation_map.get(op_name)
                if handler is None:
                    raise ValueError(f"No handler registered for operation: {op_name}")

                current_image, details = handler(current_image, params, context)
                if current_image.mode != "RGBA":
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
                self.model_manager.unload_current()
                raise RuntimeError(
                    f"Pipeline failed at step {step_index + 1} ({op_name}): {exc}"
                ) from exc

        self.model_manager.unload_current()

        logger.info(
            "Pipeline complete for job %s: %d steps executed",
            job_id, len(steps),
        )
        return steps
