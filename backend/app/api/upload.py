from __future__ import annotations

import io
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from PIL import Image

from app.config import Settings
from app.dependencies import get_settings
from app.schemas.requests import UploadResponse
from app.utils.image_utils import save_image, validate_image
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_CONTENT_TYPES = frozenset({
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
})


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile,
    settings: Settings = Depends(get_settings),
) -> UploadResponse:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_IMAGE_TYPE",
                "detail": f"Unsupported content type: {file.content_type}",
                "suggestion": "Upload JPEG, PNG, WebP, or BMP images",
            },
        )

    contents = await file.read()

    if len(contents) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error_code": "FILE_TOO_LARGE",
                "detail": f"File exceeds {settings.max_upload_size_mb} MB limit",
                "suggestion": f"Compress image or increase MAX_UPLOAD_SIZE_MB in .env",
            },
        )

    is_valid, error = validate_image(contents)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_IMAGE",
                "detail": f"Invalid image: {error}",
                "suggestion": "Upload a valid image file",
            },
        )

    image = Image.open(io.BytesIO(contents))
    image.load()

    ext = Path(file.filename or "image.png").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        ext = ".png"

    fmt = ext.lstrip(".").replace("jpg", "jpeg")

    saved_path = save_image(
        image,
        settings.upload_path,
        prefix="upload_",
        fmt=fmt,
    )

    logger.info(
        "Uploaded: %s -> %s (%d bytes, %dx%d)",
        file.filename, saved_path, len(contents), image.width, image.height,
    )

    return UploadResponse(
        filename=saved_path.name,
        original_name=file.filename or "unknown",
        size_bytes=len(contents),
        width=image.width,
        height=image.height,
        content_type=file.content_type or "image/png",
    )
