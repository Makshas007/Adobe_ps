from __future__ import annotations

import time
from enum import Enum
from typing import Any, Dict, Optional

from app.utils.gpu import (
    clear_gpu,
    get_device,
    gpu_memory_usage,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ModelType(Enum):
    SAM = "sam"
    DIFFUSION = "diffusion"
    ESRGAN = "esrgan"


class ModelManager:
    _instance: Optional[ModelManager] = None

    def __new__(cls, *args: Any, **kwargs: Any) -> ModelManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, device: str = "cpu", cache_timeout_minutes: int = 30) -> None:
        if self._initialized:
            return
        self._initialized = True
        self.device = get_device(device)
        self.cache_timeout = cache_timeout_minutes * 60.0
        self._loaded_type: Optional[ModelType] = None
        self._loaded_model: Optional[Any] = None
        self._loaded_time: float = 0.0
        self._model_paths: Dict[str, str] = {}

    @property
    def current_model_type(self) -> Optional[ModelType]:
        return self._loaded_type

    @property
    def has_loaded_model(self) -> bool:
        return self._loaded_model is not None

    def _unload_current(self) -> None:
        if self._loaded_model is not None:
            logger.info(
                "Unloading model: %s (was loaded for %.0f s)",
                self._loaded_type.value if self._loaded_type else "unknown",
                time.monotonic() - self._loaded_time,
            )
            del self._loaded_model
            self._loaded_model = None
            self._loaded_type = None
            self._loaded_time = 0.0
            if getattr(self.device, "type", "") == "cuda":
                clear_gpu()

    def _ensure_loaded(self, model_type: ModelType, load_fn: Any) -> Any:
        if self._loaded_type == model_type and self._loaded_model is not None:
            elapsed = time.monotonic() - self._loaded_time
            if elapsed < self.cache_timeout:
                logger.info("Using cached model: %s", model_type.value)
                return self._loaded_model
            logger.info("Model %s cache expired after %.0f s", model_type.value, elapsed)

        self._unload_current()
        logger.info("Loading model: %s", model_type.value)
        logger.info("GPU memory before loading: %s", gpu_memory_usage())
        model = load_fn()
        self._loaded_type = model_type
        self._loaded_model = model
        self._loaded_time = time.monotonic()
        logger.info("Model %s loaded successfully on %s", model_type.value, self.device)
        logger.info("GPU memory after loading: %s", gpu_memory_usage())
        return model

    def load_sam(self, model_path: str = "") -> Any:
        from app.services.sam_service import SAMService

        def _load() -> Any:
            service = SAMService(device=self.device)
            service.load_model(model_path or "")
            return service

        return self._ensure_loaded(ModelType.SAM, _load)

    def load_diffusion(self, model_path: str = "", model_type: str = "instruct_pix2pix") -> Any:
        from app.config import settings as app_settings
        from app.services.diffusion_service import DiffusionService

        if self._loaded_type == ModelType.DIFFUSION and self._loaded_model is not None:
            if getattr(self._loaded_model, 'model_type', None) != model_type:
                self._unload_current()

        def _load() -> Any:
            service = DiffusionService(device=self.device)
            service.load_model(model_path or "", model_type=model_type)
            lora_path = app_settings.diffusion_lora_weights
            if lora_path:
                adapter_name = app_settings.diffusion_lora_adapter_name or "default"
                service.load_lora(lora_path, adapter_name=adapter_name)
            return service

        return self._ensure_loaded(ModelType.DIFFUSION, _load)

    def load_esrgan(self, model_path: str = "") -> Any:
        from app.services.esrgan_service import ESRGANService

        def _load() -> Any:
            service = ESRGANService(device=self.device)
            service.load_model(model_path or "")
            return service

        return self._ensure_loaded(ModelType.ESRGAN, _load)

    def unload_current(self) -> None:
        self._unload_current()

    def execute(self, operation: str, image: Any, params: Optional[Dict[str, Any]] = None) -> Any:
        if self._loaded_model is None:
            raise RuntimeError("No model is currently loaded")

        if self._loaded_type == ModelType.SAM:
            return self._loaded_model.segment_object(image, params or {})
        elif self._loaded_type == ModelType.DIFFUSION:
            return self._loaded_model.process(operation, image, params or {})
        elif self._loaded_type == ModelType.ESRGAN:
            return self._loaded_model.upscale(image)
        else:
            raise RuntimeError(f"Unknown loaded model type: {self._loaded_type}")

    def update_model_paths(self, paths: Dict[str, str]) -> None:
        self._model_paths.update(paths)
