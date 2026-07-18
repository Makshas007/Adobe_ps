from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from PIL import Image
import torch
import torch.nn as nn

from app.utils.gpu import clear_gpu_aggressive, gpu_memory_usage
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ESRGANService:
    def __init__(self, device: Any) -> None:
        self.device = device
        self.model: Optional[Any] = None
        self.dtype: Optional[Any] = None

    def load_model(self, model_path: str = "") -> None:
        model_id = model_path or "weights/ESRGAN"
        logger.info("Loading ESRGAN model from: %s", model_id)
        logger.info("GPU memory before loading ESRGAN: %s", gpu_memory_usage())
        self.dtype = torch.float16 if getattr(self.device, "type", "") == "cuda" else torch.float32

        try:
            model_file = Path(model_id)
            if not model_file.exists():
                raise FileNotFoundError(f"ESRGAN weights not found at {model_file}")

            self.model = ESRGAN()
            self.model.load_state_dict(torch.load(model_file, map_location="cpu"))
            self.model = self.model.to(self.device, dtype=self.dtype)
            self.model.eval()
            logger.info("ESRGAN model loaded on %s", self.device)
        except Exception as exc:
            logger.warning("Could not load ESRGAN model: %s. Using fallback upscale.", exc)
            self.model = None

    @torch.inference_mode()
    def upscale(self, image: Image.Image) -> Image.Image:
        if self.model is None:
            logger.info("No ESRGAN model available, using PIL bicubic upscale (4x)")
            w, h = image.size
            return image.resize((w * 4, h * 4), Image.Resampling.BICUBIC)

        import torchvision.transforms.functional as TF

        input_tensor = TF.to_tensor(image).unsqueeze(0).to(self.device, dtype=self.dtype)
        logger.info("Upscaling image: %s", image.size)

        output_tensor = self.model(input_tensor)
        output_tensor = output_tensor.clamp(0, 1)

        result = TF.to_pil_image(output_tensor.squeeze(0).cpu())
        logger.info("Upscaled to: %s", result.size)
        return result

    def save_output(self, image: Image.Image, output_path: Path) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)
        logger.info("ESRGAN output saved: %s", output_path)
        return output_path

    def unload(self) -> None:
        if self.model is not None:
            logger.info("Unloading ESRGAN model")
            del self.model
            self.model = None
            clear_gpu_aggressive()

class RRDB(nn.Module):
    def __init__(self, channels: int = 64) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.conv3 = nn.Conv2d(channels, channels, 3, padding=1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.lrelu(self.conv1(x))
        out = self.lrelu(self.conv2(out))
        out = self.conv3(out)
        return x + out * 0.2

class ESRGAN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.conv_first = nn.Conv2d(3, 64, 3, padding=1)
        self.rrdbs = nn.Sequential(*[RRDB(64) for _ in range(6)])
        self.conv_body = nn.Conv2d(64, 64, 3, padding=1)
        self.upsample = nn.Sequential(
            nn.Conv2d(64, 256, 3, padding=1),
            nn.PixelShuffle(2),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 256, 3, padding=1),
            nn.PixelShuffle(2),
            nn.LeakyReLU(0.2, inplace=True),
        )
        self.conv_last = nn.Conv2d(64, 3, 3, padding=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.conv_first(x)
        body = self.rrdbs(feat)
        body = self.conv_body(body)
        feat = feat + body
        out = self.upsample(feat)
        out = self.conv_last(out)
        return out
