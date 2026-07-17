from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import torch
from PIL import Image

from app.utils.gpu import clear_gpu
from app.utils.logger import get_logger

logger = get_logger(__name__)

SAM_MODEL_ID = "facebook/sam-vit-base"


class SAMService:
    def __init__(self, device: Any) -> None:
        self.device = torch.device("cpu")
        self.model: Optional[Any] = None
        self.processor: Optional[Any] = None

    def load_model(self, model_path: str = "") -> None:
        from transformers import SamModel, SamProcessor

        clear_gpu()
        model_id = model_path or SAM_MODEL_ID
        logger.info("Loading SAM model: %s (on CPU)", model_id)

        self.processor = SamProcessor.from_pretrained(model_id)
        self.model = SamModel.from_pretrained(model_id, torch_dtype=torch.float32)
        self.model = self.model.to(self.device)
        self.model.eval()

        logger.info("SAM model loaded on CPU")

    @torch.no_grad()
    def segment_object(
        self,
        image: Image.Image,
        params: Dict[str, Any],
    ) -> Tuple[Image.Image, Image.Image]:
        if self.model is None or self.processor is None:
            raise RuntimeError("SAM model not loaded. Call load_model() first.")

        target = params.get("target", "object")
        input_boxes = params.get("input_boxes")

        if input_boxes is None:
            h, w = image.size[1], image.size[0]
            center_box = [w * 0.25, h * 0.25, w * 0.75, h * 0.75]
            input_boxes = [[center_box]]

        inputs = self.processor(
            image,
            input_boxes=input_boxes,
            return_tensors="pt",
        ).to(self.device)

        outputs = self.model(**inputs)
        masks = self.processor.image_processor.post_process_masks(
            outputs.pred_masks.cpu(),
            inputs["original_sizes"].cpu(),
            inputs["reshaped_input_sizes"].cpu(),
        )

        if len(masks) > 0 and len(masks[0]) > 0:
            multi_mask = masks[0][0].cpu().numpy()
            if multi_mask.ndim == 3:
                best_mask = multi_mask[0]
            else:
                best_mask = multi_mask
            best_mask = np.squeeze(best_mask)
        else:
            logger.warning("No mask generated for target: %s", target)
            best_mask = np.zeros((image.size[1], image.size[0]), dtype=np.bool_)

        mask_image = Image.fromarray(best_mask.astype(np.uint8) * 255, mode="L")
        mask_image = mask_image.resize(image.size, Image.Resampling.NEAREST)

        return image, mask_image

    def generate_mask(
        self,
        image: Image.Image,
        target: str = "object",
    ) -> Image.Image:
        _, mask = self.segment_object(image, {"target": target})
        return mask

    def apply_mask(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        mask_binary = mask.point(lambda p: 255 if p > 128 else 0, mode="L")
        result = Image.composite(
            Image.new("RGB", image.size, (0, 0, 0)),
            image,
            mask_binary,
        )
        return result

    def save_mask(
        self,
        mask: Image.Image,
        output_path: Path,
    ) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(output_path)
        logger.info("Mask saved: %s", output_path)
        return output_path

    def unload(self) -> None:
        if self.model is not None:
            logger.info("Unloading SAM model")
            del self.model
            self.model = None
        if self.processor is not None:
            del self.processor
            self.processor = None
        clear_gpu()
