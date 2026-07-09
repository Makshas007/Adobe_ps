from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings
from app.dependencies import get_planner, get_pipeline_executor, get_settings
from app.schemas.requests import EditRequest
from app.schemas.responses import EditResponse, JobStatusResponse, StepInfo
from app.services.gemini_service import GeminiError
from app.services.planner import Planner
from app.services.pipeline import PipelineExecutor
from app.utils.image_utils import ensure_rgb, image_to_base64, load_image
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["edit"])

JobStore = Dict[str, Dict[str, Any]]
_jobs: JobStore = {}


def _get_upload_path(filename: str, settings: Settings) -> Path:
    base_path = settings.upload_path.resolve()
    path = (settings.upload_path / filename).resolve()
    
    if not str(path).startswith(str(base_path)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")

    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "IMAGE_NOT_FOUND",
                "detail": f"Uploaded image '{filename}' not found",
                "suggestion": "Upload the image first via POST /upload",
            },
        )
    return path


@router.post("/edit", response_model=EditResponse, status_code=status.HTTP_200_OK)
async def edit_image(
    request: EditRequest,
    planner: Planner = Depends(get_planner),
    pipeline: PipelineExecutor = Depends(get_pipeline_executor),
    settings: Settings = Depends(get_settings),
) -> EditResponse:
    job_id = uuid.uuid4().hex[:12]

    image_path = _get_upload_path(request.image, settings)
    try:
        input_image = load_image(image_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "IMAGE_NOT_FOUND",
                "detail": f"Uploaded image '{request.image}' not found on disk",
                "suggestion": "Re-upload the image via POST /upload",
            },
        ) from exc
    input_image = ensure_rgb(input_image)

    logger.info("Job %s: Starting edit with prompt: %.80s", job_id, request.prompt)

    try:
        plan = await planner.create_plan(request.prompt)
    except GeminiError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "error_code": exc.code,
                "detail": exc.message,
                "suggestion": "Check your Gemini API key and billing status",
            },
        ) from exc
    logger.info("Job %s: Plan generated with %d steps", job_id, len(plan))

    _jobs[job_id] = {
        "job_id": job_id,
        "status": "processing",
        "prompt": request.prompt,
        "input_image": request.image,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "steps": [],
        "final_image": "",
        "error": None,
    }

    # Prune jobs older than 1 hour (keep memory usage down)
    now = time.time()
    try:
        to_delete = []
        for jid, jdata in _jobs.items():
            if jid == job_id:
                continue
            created_dt = datetime.fromisoformat(jdata["created_at"])
            if (datetime.now(timezone.utc) - created_dt).total_seconds() > 3600:
                to_delete.append(jid)
        for jid in to_delete:
            del _jobs[jid]
    except Exception as e:
        logger.warning(f"Failed to prune old jobs: {e}")

    try:
        total_start = time.monotonic()
        steps_data = await pipeline.execute(plan, input_image, job_id)
        total_duration = (time.monotonic() - total_start) * 1000

        steps = [
            StepInfo(
                operation=s["operation"],
                image=s["image"],
                duration_ms=s["duration_ms"],
                details=s.get("details"),
            )
            for s in steps_data
        ]

        final_base64 = steps[-1].image if steps else ""

        response = EditResponse(
            job_id=job_id,
            status="completed",
            steps=steps,
            final_image=final_base64,
            total_duration_ms=round(total_duration, 2),
        )

        _jobs[job_id].update({
            "status": "completed",
            "steps": [s.model_dump() for s in steps],
            "final_image": final_base64,
            "total_duration_ms": round(total_duration, 2),
        })

        logger.info(
            "Job %s: Completed in %.0f ms with %d steps",
            job_id, total_duration, len(steps),
        )

        return response

    except Exception as exc:
        error_msg = str(exc)
        logger.error("Job %s failed: %s", job_id, error_msg)

        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = error_msg

        partial_steps = _jobs[job_id].get("steps", [])
        last_image = partial_steps[-1]["image"] if partial_steps else image_to_base64(input_image)

        steps_list = [
            StepInfo(**s) for s in partial_steps
        ] if partial_steps else []

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "EDIT_FAILED",
                "detail": f"Edit pipeline failed: {error_msg}",
                "job_id": job_id,
                "partial_steps": [s.model_dump() for s in steps_list],
            },
        )


@router.get("/result/{job_id}", response_model=EditResponse)
async def get_result(job_id: str) -> EditResponse:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "JOB_NOT_FOUND",
                "detail": f"No job found with id: {job_id}",
                "suggestion": "Check the job_id or create a new edit",
            },
        )

    steps = [StepInfo(**s) for s in job.get("steps", [])]
    return EditResponse(
        job_id=job["job_id"],
        status=job["status"],
        steps=steps,
        final_image=job.get("final_image", ""),
        total_duration_ms=job.get("total_duration_ms", 0.0),
        error=job.get("error"),
    )


@router.get("/history/{job_id}", response_model=JobStatusResponse)
async def get_history(job_id: str) -> JobStatusResponse:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "JOB_NOT_FOUND",
                "detail": f"No job found with id: {job_id}",
                "suggestion": "Check the job_id or create a new edit",
            },
        )

    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        created_at=job.get("created_at", ""),
        progress={
            "prompt": job.get("prompt", ""),
            "input_image": job.get("input_image", ""),
            "steps_count": len(job.get("steps", [])),
            "error": job.get("error"),
        },
    )
