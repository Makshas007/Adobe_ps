from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from app.services.explanation.interfaces import (
    ChangeDescription,
    ExplanationProvider,
    ExplanationResult,
)
from app.services.explanation.prompts import build_explanation_prompt
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ExplanationService:
    def __init__(self, provider: ExplanationProvider) -> None:
        self._provider = provider

    async def generate(
        self,
        prompt: str,
        execution_log: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ExplanationResult:
        start = time.monotonic()
        try:
            result = await self._provider.generate_explanation(
                prompt=prompt,
                execution_log=execution_log,
                metadata=metadata,
            )
            elapsed = (time.monotonic() - start) * 1000
            logger.info("Explanation generated in %.0f ms", elapsed)
            return result
        except Exception as exc:
            logger.error("Explanation generation failed: %s", exc)
            elapsed = (time.monotonic() - start) * 1000
            return self._fallback(prompt, execution_log, elapsed)

    def _fallback(
        self,
        prompt: str,
        execution_log: List[Dict[str, Any]],
        duration: float,
    ) -> ExplanationResult:
        from app.services.explanation.local_provider import LocalExplanationProvider
        import asyncio

        fallback = LocalExplanationProvider()
        try:
            result = asyncio.run(fallback.generate_explanation(
                prompt=prompt,
                execution_log=execution_log,
            ))
            return result
        except Exception:
            successful = [e for e in execution_log if e.get("status") == "success"]
            ops = ", ".join(e.get("operation", "") for e in successful)
            return ExplanationResult(
                plain_english=f"Applied the following edits: {ops}." if ops else "No edits were applied.",
                technical_summary=ops or "No operations executed.",
                changes=[
                    ChangeDescription(
                        operation=e.get("operation", ""),
                        target=e.get("target", ""),
                        description=f"{e.get('operation', '')} completed.",
                        technical=f"{e.get('operation', '')} performed.",
                    )
                    for e in successful
                ],
            )
