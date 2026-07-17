from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class SceneMetadata:
    scene_type: str = "unknown"
    objects: List[Dict[str, Any]] = field(default_factory=list)
    faces: List[Dict[str, Any]] = field(default_factory=list)
    people_count: int = 0
    dominant_colors: List[Dict[str, Any]] = field(default_factory=list)
    color_palette: List[str] = field(default_factory=list)
    brightness: float = 0.0
    contrast: float = 0.0
    saturation: float = 0.0
    sharpness: float = 0.0
    noise_estimate: float = 0.0
    is_blurry: bool = False
    has_faces: bool = False
    has_text: bool = False
    has_sky: bool = False
    has_water: bool = False
    has_architecture: bool = False
    aspect_ratio: str = ""
    width: int = 0
    height: int = 0
    lighting: str = "unknown"
    weather: str = "unknown"
    aesthetic_score: float = 0.0
    depth_map: Optional[str] = None
    saliency_map: Optional[str] = None
    processing_time_ms: float = 0.0
    raw_analysis: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        import json
        raw = {
            "scene_type": self.scene_type,
            "objects": self.objects,
            "faces": self.faces,
            "people_count": int(self.people_count),
            "dominant_colors": self.dominant_colors,
            "color_palette": self.color_palette,
            "brightness": round(float(self.brightness), 2),
            "contrast": round(float(self.contrast), 2),
            "saturation": round(float(self.saturation), 2),
            "sharpness": round(float(self.sharpness), 2),
            "noise_estimate": round(float(self.noise_estimate), 2),
            "is_blurry": bool(self.is_blurry),
            "has_faces": bool(self.has_faces),
            "has_text": bool(self.has_text),
            "has_sky": bool(self.has_sky),
            "has_water": bool(self.has_water),
            "has_architecture": bool(self.has_architecture),
            "aspect_ratio": self.aspect_ratio,
            "width": int(self.width),
            "height": int(self.height),
            "lighting": self.lighting,
            "weather": self.weather,
            "aesthetic_score": round(float(self.aesthetic_score), 2),
            "processing_time_ms": round(float(self.processing_time_ms), 2),
        }
        return json.loads(json.dumps(raw, default=str))

    @classmethod
    def summary_text(cls, metadata: Dict[str, Any]) -> str:
        parts = []
        if metadata.get("scene_type") and metadata["scene_type"] != "unknown":
            parts.append(f"Scene: {metadata['scene_type']}")
        if metadata.get("has_faces"):
            parts.append(f"Faces: {metadata.get('people_count', 1)} person(s)")
        if metadata.get("objects"):
            obj_names = [o.get("label", o.get("name", "object")) for o in metadata["objects"][:5]]
            parts.append(f"Objects: {', '.join(obj_names)}")
        if metadata.get("dominant_colors"):
            colors = [c.get("name", c.get("hex", "")) for c in metadata["dominant_colors"][:3]]
            parts.append(f"Colors: {', '.join(colors)}")
        parts.append(f"Brightness: {metadata.get('brightness', 0):.0f}/255")
        parts.append(f"Contrast: {metadata.get('contrast', 0):.1f}")
        if metadata.get("lighting") != "unknown":
            parts.append(f"Lighting: {metadata['lighting']}")
        if metadata.get("is_blurry"):
            parts.append("⚠ Blurry")
        return " | ".join(parts)


class ImageUnderstandingEngine:
    def __init__(self) -> None:
        self._face_cascade = None

    def _get_face_cascade(self):
        if self._face_cascade is None:
            try:
                cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                self._face_cascade = cv2.CascadeClassifier(cascade_path)
            except Exception:
                self._face_cascade = None
        return self._face_cascade

    def analyze(self, image: Image.Image) -> SceneMetadata:
        start = time.monotonic()

        cv_img = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        h, w = cv_img.shape[:2]

        metadata = SceneMetadata(width=w, height=h)

        metadata.aspect_ratio = self._analyze_aspect_ratio(w, h)
        metadata.brightness = self._analyze_brightness(gray)
        metadata.contrast = self._analyze_contrast(gray)
        metadata.saturation = self._analyze_saturation(cv_img)
        metadata.sharpness, metadata.is_blurry = self._analyze_sharpness(gray)
        metadata.noise_estimate = self._analyze_noise(gray)
        metadata.dominant_colors = self._analyze_dominant_colors(cv_img)
        metadata.color_palette = [c["hex"] for c in metadata.dominant_colors[:6]]
        metadata.faces = self._analyze_faces(gray, w, h)
        metadata.has_faces = len(metadata.faces) > 0
        metadata.people_count = len(metadata.faces)
        metadata.lighting = self._analyze_lighting(cv_img, metadata.brightness)
        metadata.scene_type = self._analyze_scene_type(metadata)
        metadata.aesthetic_score = self._compute_aesthetic_score(metadata)

        metadata.processing_time_ms = (time.monotonic() - start) * 1000
        logger.info("Image analysis complete: %s (%d×%d) in %.0f ms",
                     metadata.scene_type, w, h, metadata.processing_time_ms)
        return metadata

    def _analyze_aspect_ratio(self, w: int, h: int) -> str:
        if w > h:
            if w / h > 1.8:
                return "panoramic"
            return "landscape"
        elif h > w:
            if h / w > 1.8:
                return "portrait_tall"
            return "portrait"
        return "square"

    def _analyze_brightness(self, gray: np.ndarray) -> float:
        return float(np.mean(gray))

    def _analyze_contrast(self, gray: np.ndarray) -> float:
        return float(np.std(gray))

    def _analyze_saturation(self, cv_img: np.ndarray) -> float:
        hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
        return float(np.std(hsv[:, :, 1]))

    def _analyze_sharpness(self, gray: np.ndarray) -> Tuple[float, bool]:
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        return float(laplacian_var), laplacian_var < 100

    def _analyze_noise(self, gray: np.ndarray) -> float:
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        noise = cv2.absdiff(gray, blurred)
        return float(np.mean(noise))

    def _analyze_dominant_colors(self, cv_img: np.ndarray, k: int = 5) -> List[Dict[str, Any]]:
        pixels = cv_img.reshape(-1, 3).astype(np.float32)
        _, labels, centers = cv2.kmeans(
            pixels, k, None,
            (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0),
            10, cv2.KMEANS_RANDOM_CENTERS
        )
        counts = np.bincount(labels.flatten())
        total = int(counts.sum())
        colors = []
        for i in range(k):
            bgr = [int(x) for x in centers[i]]
            rgb = (bgr[2], bgr[1], bgr[0])
            hex_color = f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
            colors.append({
                "hex": hex_color,
                "rgb": list(rgb),
                "percentage": round(float(counts[i]) / total, 4),
                "name": self._color_name(rgb),
            })
        colors.sort(key=lambda c: c["percentage"], reverse=True)
        return colors

    def _color_name(self, rgb: Tuple[int, int, int]) -> str:
        r, g, b = rgb
        if r > 200 and g > 200 and b > 200:
            return "white"
        if r < 50 and g < 50 and b < 50:
            return "black"
        if r > 200 and g < 100 and b < 100:
            return "red"
        if r > 200 and g > 150 and b < 100:
            return "orange"
        if r > 200 and g > 200 and b < 100:
            return "yellow"
        if r < 100 and g > 150 and b < 100:
            return "green"
        if r < 100 and g < 150 and b > 150:
            return "blue"
        if r > 150 and g < 100 and b > 150:
            return "purple"
        if r < 100 and g < 100 and b < 150:
            return "dark_blue"
        return "unknown"

    def _analyze_faces(self, gray: np.ndarray, w: int, h: int) -> List[Dict[str, Any]]:
        cascade = self._get_face_cascade()
        if cascade is None:
            return []
        max_dim = 640
        scale = 1.0
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            small_gray = cv2.resize(gray, None, fx=scale, fy=scale)
        else:
            small_gray = gray
        faces = cascade.detectMultiScale(small_gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
        results = []
        for (x, y, fw, fh) in faces:
            results.append({
                "x": int(int(x) / scale),
                "y": int(int(y) / scale),
                "width": int(int(fw) / scale),
                "height": int(int(fh) / scale),
                "confidence": 0.9,
            })
        return results

    def _analyze_lighting(self, cv_img: np.ndarray, brightness: float) -> str:
        hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
        v_mean = np.mean(hsv[:, :, 2])
        v_std = np.std(hsv[:, :, 2])
        if brightness > 200:
            return "very_bright"
        elif brightness > 150:
            return "bright"
        elif brightness > 80:
            return "normal"
        elif brightness > 40:
            return "dim"
        else:
            return "dark"

    def _analyze_scene_type(self, metadata: SceneMetadata) -> str:
        if metadata.people_count > 1:
            return "group_photo"
        if metadata.people_count == 1:
            return "portrait"
        if metadata.aspect_ratio == "panoramic" and metadata.brightness > 120:
            return "landscape"
        if metadata.contrast > 60:
            return "high_contrast"
        if metadata.is_blurry:
            return "bokeh"
        return "general"

    def _compute_aesthetic_score(self, metadata: SceneMetadata) -> float:
        score = 5.0
        if metadata.brightness < 30 or metadata.brightness > 225:
            score -= 1.0
        if metadata.contrast < 20:
            score -= 0.5
        elif metadata.contrast > 70:
            score += 0.5
        if metadata.sharpness > 500:
            score += 0.5
        elif metadata.sharpness < 50:
            score -= 1.0
        if metadata.noise_estimate > 10:
            score -= 0.5
        if metadata.has_faces:
            score += 0.5
        if metadata.saturation > 50:
            score += 0.3
        return max(1.0, min(10.0, score))
