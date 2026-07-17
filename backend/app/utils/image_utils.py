from __future__ import annotations

import base64
import io
import uuid
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from app.utils.logger import get_logger

logger = get_logger(__name__)

SUPPORTED_FORMATS = frozenset({".png", ".jpg", ".jpeg", ".webp", ".bmp"})


def load_image(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    image = Image.open(path).convert("RGB")
    logger.info("Loaded image: %s (%s)", path, image.size)
    return image


def save_image(
    image: Image.Image,
    directory: Path,
    prefix: str = "",
    fmt: str = "PNG",
) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}{uuid.uuid4().hex[:12]}.{fmt.lower()}"
    filepath = directory / filename
    image.save(filepath, format=fmt)
    logger.info("Saved image: %s", filepath)
    return filepath


def image_to_base64(image: Image.Image, fmt: str = "PNG") -> str:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def base64_to_image(data: str) -> Image.Image:
    buffer = io.BytesIO(base64.b64decode(data))
    return Image.open(buffer).convert("RGB")


def data_url_to_image(data_url: str) -> Image.Image:
    header, encoded = data_url.split(",", 1)
    return base64_to_image(encoded)


def pil_to_cv2(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def cv2_to_pil(image: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))


def validate_image(file_bytes: bytes) -> Tuple[bool, Optional[str]]:
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()
        if image.format is None:
            return False, "Unable to determine image format"
        return True, None
    except Exception as exc:
        return False, str(exc)


def resize_image(
    image: Image.Image,
    max_size: Tuple[int, int] = (1024, 1024),
) -> Image.Image:
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    return image


def ensure_rgb(image: Image.Image) -> Image.Image:
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def overlay_mask(image: Image.Image, mask: Image.Image, color: Tuple[int, int, int] = (255, 0, 0), alpha: float = 0.5) -> Image.Image:
    overlay = image.copy()
    mask_rgb = mask.convert("RGB") if mask.mode != "RGB" else mask
    color_overlay = Image.new("RGB", image.size, color)
    blended = Image.blend(overlay, color_overlay, alpha)
    mask_binary = mask.point(lambda p: 1 if p > 128 else 0)
    result = Image.composite(blended, overlay, mask_binary.convert("L"))
    return result
