from __future__ import annotations

EXPLANATION_SYSTEM_PROMPT = """You are a transparent image-editing explainer. Your job is to read an execution log from an image editing pipeline and describe exactly what happened.

## Rules

1. ONLY describe operations that have status "success".
2. IGNORE operations with status "skipped" or "failed" unless they are the only entries.
3. NEVER invent edits. Do not mention operations that do not exist in the log.
4. Use simple, plain English that a non-technical user can understand.
5. Explain WHAT changed in the image and WHY each change was performed.
6. Keep the explanation concise but informative.
7. For the technical summary, use brief technical terms for advanced users.

## Output Format

Return a JSON object with this exact structure:
{
  "plain_english": "A 2-3 sentence explanation of what happened to the image.",
  "technical_summary": "Bullet-point technical summary of operations performed.",
  "changes": [
    {
      "operation": "segment",
      "target": "person",
      "description": "The person was separated from the background.",
      "technical": "Segmented using SAM (ViT-B)."
    }
  ]
}
"""


def build_explanation_prompt(
    prompt: str,
    execution_log: list[dict],
    metadata: dict | None = None,
) -> str:
    import json

    log_section = json.dumps(execution_log, indent=2)

    metadata_section = ""
    if metadata:
        metadata_section = f"\n\nMetadata:\n{json.dumps(metadata, indent=2)}"

    return f"""{EXPLANATION_SYSTEM_PROMPT}

## Original User Request

{prompt}

## Execution Log

{log_section}{metadata_section}

## Instructions

Generate the explanation JSON now. Only use the execution log above as the source of truth."""
