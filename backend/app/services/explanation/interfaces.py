from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ChangeDescription:
    operation: str = ""
    target: str = ""
    description: str = ""
    technical: str = ""


@dataclass
class ExplanationResult:
    plain_english: str = ""
    technical_summary: str = ""
    changes: List[ChangeDescription] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plain_english": self.plain_english,
            "technical_summary": self.technical_summary,
            "changes": [
                {"operation": c.operation, "target": c.target, "description": c.description, "technical": c.technical}
                for c in self.changes
            ],
        }


class ExplanationProvider(ABC):
    @abstractmethod
    async def generate_explanation(
        self,
        prompt: str,
        execution_log: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ExplanationResult:
        pass
