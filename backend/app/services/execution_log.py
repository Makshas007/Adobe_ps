from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class LogStatus(str, Enum):
    SUCCESS = "success"
    SKIPPED = "skipped"
    FAILED = "failed"


@dataclass
class ExecutionLogEntry:
    operation: str
    target: str = ""
    model: str = ""
    input: str = ""
    output: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    status: LogStatus = LogStatus.SUCCESS
    reason: str = ""
    duration: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "target": self.target,
            "model": self.model,
            "input": self.input,
            "output": self.output,
            "parameters": self.parameters,
            "status": self.status.value,
            "reason": self.reason,
            "duration": round(self.duration, 2),
        }


@dataclass
class ExecutionLog:
    entries: List[ExecutionLogEntry] = field(default_factory=list)

    def append(self, entry: ExecutionLogEntry) -> None:
        self.entries.append(entry)

    def to_dict(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.entries]

    def successful_entries(self) -> List[ExecutionLogEntry]:
        return [e for e in self.entries if e.status == LogStatus.SUCCESS]

    def skipped_entries(self) -> List[ExecutionLogEntry]:
        return [e for e in self.entries if e.status == LogStatus.SKIPPED]

    def failed_entries(self) -> List[ExecutionLogEntry]:
        return [e for e in self.entries if e.status == LogStatus.FAILED]
