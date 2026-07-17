from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_settings
from app.schemas.responses import AnalyzeResponse, SceneMetadataResponse
from app.utils.image_utils import data_url_to_image, ensure_rgb, load_image
from app.utils.logger import get_logger
from app.config import Settings
from app.vision.engine import ImageUnderstandingEngine

logger = get_logger(__name__)

router = APIRouter(tags=["analyze"])

_engine: ImageUnderstandingEngine | None = None


def get_engine() -> ImageUnderstandingEngine:
    global _engine
    if _engine is None:
        _engine = ImageUnderstandingEngine()
    return _engine


@router.post("/analyze", response_model=AnalyzeResponse)
@router.post("/analyze/", response_model=AnalyzeResponse)
async def analyze_image(
    request: dict,
    settings: Settings = Depends(get_settings),
) -> AnalyzeResponse:
    image_data = request.get("image", "")
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_IMAGE", "detail": "No image provided"},
        )

    if image_data.startswith("data:image"):
        try:
            input_image = data_url_to_image(image_data)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_IMAGE_DATA", "detail": f"Failed to decode: {exc}"},
            ) from exc
    else:
        try:
            path = (settings.upload_path / image_data).resolve()
            input_image = load_image(path)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "IMAGE_NOT_FOUND", "detail": str(exc)},
            ) from exc

    input_image = ensure_rgb(input_image)
    engine = get_engine()
    metadata = engine.analyze(input_image)

    suggestions = _generate_suggestions(metadata)

    return AnalyzeResponse(
        metadata=SceneMetadataResponse(**metadata.to_dict()),
        suggestions=suggestions,
        processing_time_ms=metadata.processing_time_ms,
    )


def _generate_suggestions(metadata) -> list[str]:
    suggestions = []
    if metadata.is_blurry:
        suggestions.append("Image appears blurry. Try sharpening.")
    if metadata.brightness < 50:
        suggestions.append("Image is very dark. Consider increasing exposure.")
    if metadata.brightness > 200:
        suggestions.append("Image is very bright. Consider reducing exposure.")
    if metadata.contrast < 30:
        suggestions.append("Low contrast. Try a contrast or levels adjustment.")
    if metadata.noise_estimate > 10:
        suggestions.append("Visible noise detected. Try denoising.")
    if metadata.has_faces:
        suggestions.append("Faces detected. Try portrait enhancement or skin smoothing.")
    if metadata.aesthetic_score < 4.0:
        suggestions.append("Low aesthetic score. Consider color grading or composition improvements.")
    return suggestions
