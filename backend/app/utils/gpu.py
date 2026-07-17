from __future__ import annotations

from typing import Any

from app.utils.logger import get_logger

logger = get_logger(__name__)

_torch = None


def _get_torch():
    global _torch
    if _torch is None:
        try:
            import torch as t
            _torch = t
        except ImportError:
            _torch = False
    return _torch if _torch is not False else None


def cuda_available() -> bool:
    torch = _get_torch()
    return torch is not None and torch.cuda.is_available()


def mps_available() -> bool:
    torch = _get_torch()
    return torch is not None and hasattr(torch.backends, "mps") and torch.backends.mps.is_available()


def get_device(preferred: str = "") -> Any:
    torch = _get_torch()
    if torch is None:
        from types import SimpleNamespace
        return SimpleNamespace(type="cpu", __repr__=lambda self: "cpu")
    if preferred:
        return torch.device(preferred)
    if cuda_available():
        return torch.device("cuda")
    if mps_available():
        return torch.device("mps")
    return torch.device("cpu")


def clear_gpu() -> None:
    torch = _get_torch()
    if torch is not None and cuda_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
        logger.info("GPU cache cleared")


def gpu_memory_usage() -> str:
    torch = _get_torch()
    if not cuda_available():
        return "CUDA not available"
    allocated = torch.cuda.memory_allocated() / 1024**3
    reserved = torch.cuda.memory_reserved() / 1024**3
    total = torch.cuda.get_device_properties(0).total_memory / 1024**3
    return (
        f"Allocated: {allocated:.2f} GB, "
        f"Reserved: {reserved:.2f} GB, "
        f"Total: {total:.2f} GB"
    )


def gpu_memory_summary() -> str:
    torch = _get_torch()
    if not cuda_available():
        return "CUDA not available"
    stats = torch.cuda.memory_stats()
    active_bytes = stats.get("active_bytes.all.current", 0)
    inactive_bytes = stats.get("inactive_bytes.all.current", 0)
    allocated = torch.cuda.memory_allocated() / 1024**3
    reserved = torch.cuda.memory_reserved() / 1024**3
    total = torch.cuda.get_device_properties(0).total_memory / 1024**3
    active = active_bytes / 1024**3
    inactive = inactive_bytes / 1024**3
    return (
        f"Allocated: {allocated:.2f} GB, "
        f"Active: {active:.2f} GB, "
        f"Inactive: {inactive:.2f} GB, "
        f"Reserved: {reserved:.2f} GB, "
        f"Total: {total:.2f} GB"
    )


def move_to_device(
    model: Any,
    device: Any,
) -> Any:
    logger.info("Moving model to %s", device)
    return model.to(device)


def move_to_cpu(model: Any) -> Any:
    torch = _get_torch()
    if torch is None:
        return model
    return move_to_device(model, torch.device("cpu"))
