from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.layers.layer import BlendMode, Layer, LayerType
from app.utils.logger import get_logger

logger = get_logger(__name__)


class LayerStack:
    def __init__(self) -> None:
        self._layers: List[Layer] = []
        self._next_order: int = 0

    @property
    def layers(self) -> List[Layer]:
        return sorted(self._layers, key=lambda l: l.order)

    @property
    def count(self) -> int:
        return len(self._layers)

    def add_layer(self, layer: Layer) -> Layer:
        layer.order = self._next_order
        self._next_order += 1
        self._layers.append(layer)
        logger.debug("Added layer: %s (%s)", layer.name, layer.layer_type.value)
        return layer

    def create_image_layer(self, name: str, image_data: str) -> Layer:
        return self.add_layer(Layer(
            name=name,
            layer_type=LayerType.IMAGE,
            image_data=image_data,
        ))

    def create_adjustment_layer(self, name: str, properties: Dict[str, Any]) -> Layer:
        return self.add_layer(Layer(
            name=name,
            layer_type=LayerType.ADJUSTMENT,
            properties=properties,
        ))

    def create_text_layer(self, name: str, text: str, properties: Optional[Dict[str, Any]] = None) -> Layer:
        props = {"text": text, **(properties or {})}
        return self.add_layer(Layer(
            name=name,
            layer_type=LayerType.TEXT,
            properties=props,
        ))

    def create_mask_layer(self, name: str, mask_data: str) -> Layer:
        return self.add_layer(Layer(
            name=name,
            layer_type=LayerType.MASK,
            image_data=mask_data,
        ))

    def get_layer(self, layer_id: str) -> Optional[Layer]:
        for layer in self._layers:
            if layer.id == layer_id:
                return layer
        return None

    def remove_layer(self, layer_id: str) -> bool:
        for i, layer in enumerate(self._layers):
            if layer.id == layer_id:
                self._layers.pop(i)
                logger.debug("Removed layer: %s", layer.name)
                return True
        return False

    def duplicate_layer(self, layer_id: str) -> Optional[Layer]:
        original = self.get_layer(layer_id)
        if original is None:
            return None
        import copy
        new_layer = copy.deepcopy(original)
        new_layer.id = __import__("uuid").uuid4().hex[:12]
        new_layer.name = f"{original.name} (copy)"
        return self.add_layer(new_layer)

    def reorder_layer(self, layer_id: str, new_order: int) -> bool:
        layer = self.get_layer(layer_id)
        if layer is None:
            return False
        layer.order = new_order
        self._next_order = max(self._next_order, new_order + 1)
        return True

    def set_layer_visibility(self, layer_id: str, visible: bool) -> bool:
        layer = self.get_layer(layer_id)
        if layer is None:
            return False
        layer.visible = visible
        return True

    def set_layer_opacity(self, layer_id: str, opacity: float) -> bool:
        layer = self.get_layer(layer_id)
        if layer is None:
            return False
        layer.opacity = max(0.0, min(1.0, opacity))
        return True

    def set_layer_blend_mode(self, layer_id: str, mode: BlendMode) -> bool:
        layer = self.get_layer(layer_id)
        if layer is None:
            return False
        layer.blend_mode = mode
        return True

    def get_visible_layers(self) -> List[Layer]:
        return [l for l in self.layers if l.visible]

    def to_dict(self) -> List[Dict[str, Any]]:
        return [l.to_dict() for l in self.layers]

    @classmethod
    def from_dict(cls, data: List[Dict[str, Any]]) -> LayerStack:
        stack = cls()
        for layer_data in data:
            stack._layers.append(Layer.from_dict(layer_data))
        if stack._layers:
            stack._next_order = max(l.order for l in stack._layers) + 1
        return stack

    def clear(self) -> None:
        self._layers.clear()
        self._next_order = 0
