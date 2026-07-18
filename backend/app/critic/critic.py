from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from PIL import Image

from app.planning.strategy import ExecutionPlan, PlanStep
from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class QualityIssue:
    type: str
    severity: float
    description: str
    location: Optional[Dict[str, Any]] = None
    suggestion: str = ""


@dataclass
class CritiqueResult:
    passed: bool
    score: float
    issues: List[QualityIssue] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    corrective_plan: Optional[ExecutionPlan] = None
    processing_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "score": round(self.score, 2),
            "issues": [{"type": i.type, "severity": i.severity, "description": i.description, "suggestion": i.suggestion} for i in self.issues],
            "suggestions": self.suggestions,
            "corrective_plan": self.corrective_plan.to_dict() if self.corrective_plan else None,
            "processing_time_ms": round(self.processing_time_ms, 2),
        }


class Critic:
    def __init__(self) -> None:
        pass

    async def evaluate(
        self,
        original: Image.Image,
        edited: Image.Image,
        metadata: Dict[str, Any],
        execution_log: Any = None,
    ) -> CritiqueResult:
        start = time.monotonic()
        issues: List[QualityIssue] = []
        suggestions: List[str] = []

        orig_cv = cv2.cvtColor(np.array(original.convert("RGB")), cv2.COLOR_RGB2BGR)
        edit_cv = cv2.cvtColor(np.array(edited.convert("RGB")), cv2.COLOR_RGB2BGR)
        orig_gray = cv2.cvtColor(orig_cv, cv2.COLOR_BGR2GRAY)
        edit_gray = cv2.cvtColor(edit_cv, cv2.COLOR_BGR2GRAY)

        noise_issue = self._check_noise(orig_gray, edit_gray)
        if noise_issue:
            issues.append(noise_issue)

        sharpness_issue = self._check_sharpness(orig_gray, edit_gray)
        if sharpness_issue:
            issues.append(sharpness_issue)

        clipping_issue = self._check_clipping(edit_cv)
        if clipping_issue:
            issues.append(clipping_issue)

        artifact_issue = self._check_artifacts(edit_gray)
        if artifact_issue:
            issues.append(artifact_issue)

        halo_issue = self._check_halos(orig_gray, edit_gray)
        if halo_issue:
            issues.append(halo_issue)

        color_shift = self._check_color_shift(orig_cv, edit_cv)
        if color_shift:
            issues.append(color_shift)

        brightness_shift = self._check_brightness_shift(orig_gray, edit_gray)
        if brightness_shift:
            issues.append(brightness_shift)

        for issue in issues:
            if issue.severity > 0.5 and issue.suggestion:
                suggestions.append(issue.suggestion)

        passed = len([i for i in issues if i.severity > 0.7]) == 0
        score = max(0.0, 1.0 - sum(i.severity for i in issues) * 0.2)

        processing_time = (time.monotonic() - start) * 1000

        corrective_plan = None
        if not passed:
            corrective_plan = self._build_corrective_plan(issues)

        logger.info(
            "Critic: %s (score=%.2f, %d issues) in %.0f ms",
            "PASSED" if passed else "ISSUES FOUND",
            score, len(issues), processing_time,
        )

        return CritiqueResult(
            passed=passed,
            score=score,
            issues=issues,
            suggestions=suggestions,
            corrective_plan=corrective_plan,
            processing_time_ms=processing_time,
        )

    def _check_noise(self, orig_gray: np.ndarray, edit_gray: np.ndarray) -> Optional[QualityIssue]:
        orig_noise = cv2.Laplacian(orig_gray, cv2.CV_64F).var()
        edit_noise = cv2.Laplacian(edit_gray, cv2.CV_64F).var()
        noise_ratio = edit_noise / max(orig_noise, 0.01)
        if noise_ratio > 2.0:
            return QualityIssue(
                type="noise_amplification",
                severity=min(1.0, (noise_ratio - 2.0) / 5.0),
                description=f"Noise amplified {noise_ratio:.1f}x compared to original",
                suggestion="Apply denoising to reduce amplified noise",
            )
        if noise_ratio < 0.1 and edit_noise < 20:
            return QualityIssue(
                type="over_smoothing",
                severity=min(1.0, (1.0 - noise_ratio) * 0.5),
                description="Image may be over-smoothed (too little detail)",
                suggestion="Reduce smoothing or add sharpening",
            )
        return None

    def _check_sharpness(self, orig_gray: np.ndarray, edit_gray: np.ndarray) -> Optional[QualityIssue]:
        orig_sharp = cv2.Laplacian(orig_gray, cv2.CV_64F).var()
        edit_sharp = cv2.Laplacian(edit_gray, cv2.CV_64F).var()
        sharp_ratio = edit_sharp / max(orig_sharp, 0.01)
        if sharp_ratio > 3.0:
            return QualityIssue(
                type="over_sharpening",
                severity=min(1.0, (sharp_ratio - 3.0) / 5.0),
                description=f"Sharpness increased {sharp_ratio:.1f}x — may have halos",
                suggestion="Reduce sharpening amount or radius",
            )
        return None

    def _check_clipping(self, cv_img: np.ndarray) -> Optional[QualityIssue]:
        h, w = cv_img.shape[:2]
        total_pixels = h * w
        black_clip = np.sum(cv_img < 5) // 3
        white_clip = np.sum(cv_img > 250) // 3
        clip_pct = (black_clip + white_clip) / total_pixels
        if clip_pct > 0.05:
            return QualityIssue(
                type="color_clipping",
                severity=min(1.0, clip_pct * 3),
                description=f"{clip_pct*100:.1f}% of pixels clipped ({black_clip} shadow, {white_clip} highlight)",
                suggestion="Use levels or curves to recover clipped regions",
            )
        return None

    def _check_artifacts(self, gray: np.ndarray) -> Optional[QualityIssue]:
        edges = cv2.Canny(gray, 50, 150)
        h, w = gray.shape
        artifact_score = np.sum(edges > 0) / (h * w)
        if artifact_score > 0.3:
            return QualityIssue(
                type="excessive_edges",
                severity=min(1.0, (artifact_score - 0.3) * 2),
                description=f"High edge density ({artifact_score*100:.1f}%) — possible artifacts",
                suggestion="Check for compression or generation artifacts",
            )
        return None

    def _check_halos(self, orig_gray: np.ndarray, edit_gray: np.ndarray) -> Optional[QualityIssue]:
        diff = cv2.absdiff(orig_gray, edit_gray)
        edges = cv2.Canny(orig_gray, 50, 150)
        edge_dilation = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=1)
        halo_region = cv2.bitwise_and(diff, diff, mask=edge_dilation)
        halo_intensity = np.mean(halo_region[halo_region > 0]) if np.any(halo_region > 0) else 0
        if halo_intensity > 30:
            return QualityIssue(
                type="halo_artifacts",
                severity=min(1.0, (halo_intensity - 30) / 50),
                description=f"Halo artifacts detected near edges (intensity: {halo_intensity:.1f})",
                suggestion="Check sharpening radius or feather masks more",
            )
        return None

    def _check_color_shift(self, orig: np.ndarray, edit: np.ndarray) -> Optional[QualityIssue]:
        orig_hsv = cv2.cvtColor(orig, cv2.COLOR_BGR2HSV)
        edit_hsv = cv2.cvtColor(edit, cv2.COLOR_BGR2HSV)
        h_diff = np.mean(np.abs(edit_hsv[:, :, 0].astype(float) - orig_hsv[:, :, 0].astype(float)))
        if h_diff > 30:
            return QualityIssue(
                type="color_cast",
                severity=min(1.0, h_diff / 90),
                description=f"Significant hue shift detected (ΔH={h_diff:.1f})",
                suggestion="Check white balance or use temperature/tint correction",
            )
        return None

    def _check_brightness_shift(self, orig_gray: np.ndarray, edit_gray: np.ndarray) -> Optional[QualityIssue]:
        orig_mean = np.mean(orig_gray)
        edit_mean = np.mean(edit_gray)
        diff = edit_mean - orig_mean
        if abs(diff) > 50:
            return QualityIssue(
                type="brightness_shift",
                severity=min(1.0, abs(diff) / 100),
                description=f"Brightness shifted by {diff:+.0f} units (orig: {orig_mean:.0f}, new: {edit_mean:.0f})",
                suggestion="Use exposure or brightness tool to adjust",
            )
        return None

    def _build_corrective_plan(self, issues: List[QualityIssue]) -> ExecutionPlan:
        plan = ExecutionPlan(reasoning="Automatic corrective edits from critic analysis")
        for issue in issues:
            if issue.type == "noise_amplification":
                plan.add_step(PlanStep(
                    operation="denoise to fix noise amplification",
                    tool="denoise",
                    params={"strength": 5},
                    reasoning=issue.description,
                    priority=1,
                ))
            elif issue.type == "over_sharpening":
                plan.add_step(PlanStep(
                    operation="blur to fix over-sharpening",
                    tool="gaussian_blur",
                    params={"radius": 0.5},
                    reasoning=issue.description,
                    priority=1,
                ))
            elif issue.type == "color_clipping":
                plan.add_step(PlanStep(
                    operation="recover clipped colors",
                    tool="levels",
                    params={"black": 5, "white": 250, "gamma": 1.0},
                    reasoning=issue.description,
                    priority=1,
                ))
            elif issue.type == "color_cast":
                plan.add_step(PlanStep(
                    operation="fix color cast",
                    tool="temperature",
                    params={"value": 0},
                    reasoning=issue.description,
                    priority=1,
                ))
            elif issue.type == "brightness_shift":
                plan.add_step(PlanStep(
                    operation="fix brightness",
                    tool="brightness",
                    params={"value": 0},
                    reasoning=issue.description,
                    priority=1,
                ))
            elif issue.type == "halo_artifacts":
                plan.add_step(PlanStep(
                    operation="reduce halos",
                    tool="denoise",
                    params={"strength": 3},
                    reasoning=issue.description,
                    priority=1,
                ))
        return plan
