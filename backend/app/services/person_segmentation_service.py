from __future__ import annotations

from typing import Any, Optional

import numpy as np
from PIL import Image, ImageFilter

from app.utils.logger import get_logger

logger = get_logger(__name__)


class PersonSegmentationService:
    """Specialized person segmentation using u2net_human_seg.

    Uses rembg's dedicated human segmentation model (u2net_human_seg) which
    is trained specifically on people and produces significantly more accurate
    person masks than generic SAM-based segmentation. This is the same model
    used by the background removal pipeline for human subjects.
    """

    def __init__(self, device: Any = None) -> None:
        self.device = device
        self.session: Optional[Any] = None

    def load_model(self, model_path: str = "") -> None:
        """Load the u2net_human_seg model via rembg."""
        import rembg

        self.session = rembg.new_session(
            "u2net_human_seg", providers=["CPUExecutionProvider"]
        )
        logger.info("Person segmentation model (u2net_human_seg) loaded on CPU")

    def segment_person(self, image: Image.Image) -> Image.Image:
        """Generate a binary mask of all persons in the image.

        Returns a single-channel (L mode) mask where white (255) = person
        and black (0) = background, suitable for direct use with LaMa inpainting.
        """
        if self.session is None:
            raise RuntimeError(
                "Person segmentation model not loaded. Call load_model() first."
            )

        import rembg

        result = rembg.remove(
            image,
            session=self.session,
            post_process_mask=True,
        )

        alpha = result.split()[3]
        mask = alpha.convert("L")

        mask = mask.filter(ImageFilter.MaxFilter(3))
        mask = mask.filter(ImageFilter.GaussianBlur(radius=1.0))

        mask_np = np.array(mask, dtype=np.float32)
        mask_np = np.where(mask_np > 240, 255.0, mask_np)
        mask_np = np.where(mask_np < 15, 0.0, mask_np)
        mask = Image.fromarray(mask_np.astype(np.uint8), mode="L")

        return mask

    def segment_person_with_refinement(
        self, image: Image.Image, face_refine: bool = True
    ) -> Image.Image:
        """Generate person mask with optional face-aware refinement.

        Args:
            image: Input PIL image
            face_refine: Whether to refine mask around face regions

        Returns:
            Binary person mask (L mode)
        """
        mask = self.segment_person(image)

        if face_refine:
            mask = self._refine_face_region(image, mask)

        return mask

    def _refine_face_region(
        self, image: Image.Image, mask: Image.Image
    ) -> Image.Image:
        """Apply additional refinement around face regions for better edge quality."""
        try:
            import cv2

            img_np = np.array(image.convert("RGB"))
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )

            if len(faces) == 0:
                return mask

            mask_np = np.array(mask, dtype=np.float32)
            h, w = mask_np.shape[:2]

            for x, y, fw, fh in faces:
                margin_x = int(fw * 0.3)
                margin_y = int(fh * 0.3)
                x1 = max(0, x - margin_x)
                y1 = max(0, y - margin_y)
                x2 = min(w, x + fw + margin_x)
                y2 = min(h, y + fh + margin_y)

                face_region = mask_np[y1:y2, x1:x2]
                kernel = np.ones((5, 5), np.uint8)
                face_region = cv2.morphologyEx(
                    face_region, cv2.MORPH_CLOSE, kernel
                )
                mask_np[y1:y2, x1:x2] = face_region

            mask = Image.fromarray(mask_np.astype(np.uint8), mode="L")
            return mask

        except Exception:
            return mask

    def unload(self) -> None:
        if self.session is not None:
            logger.info("Unloading person segmentation model")
            del self.session
            self.session = None
