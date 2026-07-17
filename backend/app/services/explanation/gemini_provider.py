from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, List, Optional

from google import genai

from app.services.explanation.interfaces import (
    ChangeDescription,
    ExplanationProvider,
    ExplanationResult,
)
from app.services.explanation.prompts import build_explanation_prompt
from app.utils.logger import get_logger

logger = get_logger(__name__)


class GeminiExplanationProvider(ExplanationProvider):
    def __init__(self, api_key: str, model: str = "gemini-3.1-flash-lite") -> None:
        self.api_key = api_key
        self.model = model
        self.client = genai.Client(api_key=api_key)

    async def generate_explanation(
        self,
        prompt: str,
        execution_log: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ExplanationResult:
        full_prompt = build_explanation_prompt(prompt, execution_log, metadata)

        logger.info("Sending explanation prompt to Gemini (%s)", self.model)

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model,
                contents=full_prompt,
                config={
                    "temperature": 0.1,
                    "top_p": 0.95,
                    "max_output_tokens": 2048,
                },
            )
        except Exception as exc:
            logger.error("Gemini explanation call failed: %s", exc)
            raise

        raw = response.text.strip()

        if raw.startswith("```json"):
            raw = raw[7:]
        elif raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gemini explanation JSON, using fallback")
            raise ValueError("Invalid JSON from Gemini")

        changes = []
        for c in data.get("changes", []):
            changes.append(ChangeDescription(
                operation=c.get("operation", ""),
                target=c.get("target", ""),
                description=c.get("description", ""),
                technical=c.get("technical", ""),
            ))

        return ExplanationResult(
            plain_english=data.get("plain_english", ""),
            technical_summary=data.get("technical_summary", ""),
            changes=changes,
        )
