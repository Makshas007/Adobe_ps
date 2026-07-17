from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class MaskType(Enum):
    SAM = "sam"
    USER = "user"
    BRUSH = "brush"
    SELECTION = "selection"
    ALPHA = "alpha"
    DEPTH = "depth"
    SALIENCY = "saliency"


@dataclass
class Mask:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str = "Mask"
    mask_type: MaskType = MaskType.SAM
    image_data: Optional[str] = None
    width: int = 0
    height: int = 0
    inverted: bool = False
    feathered: bool = False
    feather_radius: float = 0.0
    refined: bool = False
    source_tool: str = ""
    properties: Dict[str, Any] = field(default_factory=dict)
    linked_layer_id: Optional[str] = None
    parent_mask_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "mask_type": self.mask_type.value,
            "image_data": self.image_data,
            "width": self.width,
            "height": self.height,
            "inverted": self.inverted,
            "feathered": self.feathered,
            "feather_radius": self.feather_radius,
            "refined": self.refined,
            "source_tool": self.source_tool,
            "properties": self.properties,
            "linked_layer_id": self.linked_layer_id,
            "parent_mask_id": self.parent_mask_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Mask:
        return cls(
            id=data.get("id", uuid.uuid4().hex[:12]),
            name=data.get("name", "Mask"),
            mask_type=MaskType(data.get("mask_type", "sam")),
            image_data=data.get("image_data"),
            width=data.get("width", 0),
            height=data.get("height", 0),
            inverted=data.get("inverted", False),
            feathered=data.get("feathered", False),
            feather_radius=data.get("feather_radius", 0.0),
            refined=data.get("refined", False),
            source_tool=data.get("source_tool", ""),
            properties=data.get("properties", {}),
            linked_layer_id=data.get("linked_layer_id"),
            parent_mask_id=data.get("parent_mask_id"),
        )


class MaskCollection:
    def __init__(self) -> None:
        self._masks: Dict[str, Mask] = {}

    @property
    def masks(self) -> List[Mask]:
        return list(self._masks.values())

    def add(self, mask: Mask) -> Mask:
        self._masks[mask.id] = mask
        return mask

    def get(self, mask_id: str) -> Optional[Mask]:
        return self._masks.get(mask_id)

    def remove(self, mask_id: str) -> bool:
        if mask_id in self._masks:
            del self._masks[mask_id]
            return True
        return False

    def get_by_layer(self, layer_id: str) -> Optional[Mask]:
        for mask in self._masks.values():
            if mask.linked_layer_id == layer_id:
                return mask
        return None

    def to_dict(self) -> List[Dict[str, Any]]:
        return [m.to_dict() for m in self._masks.values()]

    @classmethod
    def from_dict(cls, data: List[Dict[str, Any]]) -> MaskCollection:
        collection = cls()
        for mask_data in data:
            mask = Mask.from_dict(mask_data)
            collection._masks[mask.id] = mask
        return collection
