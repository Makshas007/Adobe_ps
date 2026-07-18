from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional


class LayerType(Enum):
    IMAGE = "image"
    ADJUSTMENT = "adjustment"
    MASK = "mask"
    TEXT = "text"
    EFFECT = "effect"
    SMART = "smart"
    GROUP = "group"


class BlendMode(Enum):
    NORMAL = "normal"
    MULTIPLY = "multiply"
    SCREEN = "screen"
    OVERLAY = "overlay"
    DARKEN = "darken"
    LIGHTEN = "lighten"
    COLOR_DODGE = "color_dodge"
    COLOR_BURN = "color_burn"
    HARD_LIGHT = "hard_light"
    SOFT_LIGHT = "soft_light"
    DIFFERENCE = "difference"
    EXCLUSION = "exclusion"
    HUE = "hue"
    SATURATION = "saturation"
    COLOR = "color"
    LUMINOSITY = "luminosity"


@dataclass
class Layer:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str = "Layer"
    layer_type: LayerType = LayerType.IMAGE
    visible: bool = True
    opacity: float = 1.0
    blend_mode: BlendMode = BlendMode.NORMAL
    locked: bool = False
    parent_id: Optional[str] = None
    mask_id: Optional[str] = None
    image_data: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    order: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "layer_type": self.layer_type.value,
            "visible": self.visible,
            "opacity": self.opacity,
            "blend_mode": self.blend_mode.value,
            "locked": self.locked,
            "parent_id": self.parent_id,
            "mask_id": self.mask_id,
            "image_data": self.image_data,
            "properties": self.properties,
            "order": self.order,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Layer:
        return cls(
            id=data.get("id", uuid.uuid4().hex[:12]),
            name=data.get("name", "Layer"),
            layer_type=LayerType(data.get("layer_type", "image")),
            visible=data.get("visible", True),
            opacity=data.get("opacity", 1.0),
            blend_mode=BlendMode(data.get("blend_mode", "normal")),
            locked=data.get("locked", False),
            parent_id=data.get("parent_id"),
            mask_id=data.get("mask_id"),
            image_data=data.get("image_data"),
            properties=data.get("properties", {}),
            order=data.get("order", 0),
        )
