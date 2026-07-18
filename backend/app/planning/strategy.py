from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PlanStep:
    operation: str
    tool: str
    params: Dict[str, Any] = field(default_factory=dict)
    reasoning: str = ""
    priority: int = 0
    depends_on: List[str] = field(default_factory=list)
    requires_mask: bool = False
    mask_source: Optional[str] = None
    expected_cost: str = "low"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "tool": self.tool,
            "params": self.params,
            "reasoning": self.reasoning,
            "priority": self.priority,
            "depends_on": self.depends_on,
            "requires_mask": self.requires_mask,
            "mask_source": self.mask_source,
            "expected_cost": self.expected_cost,
        }


@dataclass
class ExecutionPlan:
    steps: List[PlanStep] = field(default_factory=list)
    reasoning: str = ""
    estimated_cost: str = "low"
    estimated_total_latency: str = "fast"
    alternative_approaches: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "steps": [s.to_dict() for s in self.steps],
            "reasoning": self.reasoning,
            "estimated_cost": self.estimated_cost,
            "estimated_total_latency": self.estimated_total_latency,
        }

    def add_step(self, step: PlanStep) -> None:
        self.steps.append(step)
