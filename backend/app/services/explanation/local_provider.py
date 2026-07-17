from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.services.explanation.interfaces import (
    ChangeDescription,
    ExplanationProvider,
    ExplanationResult,
)

OPERATION_PLAIN = {
    "segment": "was identified and separated",
    "remove": "was removed from the image",
    "replace_background": "had its background replaced with",
    "remove_background": "had its background removed, leaving transparency",
    "change_style": "had its style changed to",
    "style_transfer": "had an artistic style applied:",
    "upscale": "was increased in resolution",
}

OPERATION_TECHNICAL = {
    "segment": "Segmented using SAM.",
    "remove": "Object removed via inpainting.",
    "replace_background": "Background replaced via inpainting.",
    "remove_background": "Background removed (rembg).",
    "change_style": "Style transferred via InstructPix2Pix.",
    "style_transfer": "Style transferred via InstructPix2Pix.",
    "upscale": "Upscaled using ESRGAN.",
}

MODEL_NAMES = {
    "sam": "SAM (ViT-B)",
    "inpaint": "SD Inpainting",
    "diffusion": "InstructPix2Pix",
    "esrgan": "ESRGAN",
}


class LocalExplanationProvider(ExplanationProvider):
    async def generate_explanation(
        self,
        prompt: str,
        execution_log: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ExplanationResult:
        successful = [e for e in execution_log if e.get("status") == "success"]
        skipped = [e for e in execution_log if e.get("status") == "skipped"]
        failed = [e for e in execution_log if e.get("status") == "failed"]

        changes = []
        sentences = []
        tech_lines = []

        for entry in successful:
            op = entry.get("operation", "")
            target = entry.get("target", "")
            params = entry.get("parameters", {})
            model = entry.get("model", "")

            plain_base = OPERATION_PLAIN.get(op, f"was processed ({op})")
            tech_base = OPERATION_TECHNICAL.get(op, f"{op} performed.")

            target_part = f" {target}" if target else ""
            param_part = ""
            tech_detail = tech_base

            if op == "replace_background":
                instruction = params.get("instruction", params.get("new_background", ""))
                if instruction:
                    param_part = f" {instruction}"
            elif op in ("change_style", "style_transfer"):
                instruction = params.get("instruction", "")
                if instruction:
                    param_part = f" {instruction}"
            elif op == "upscale":
                factor = params.get("scale", 4)
                tech_detail = f"Upscaled {factor}x using ESRGAN."

            sentence = f"{target_part}{plain_base}{param_part}.".strip()
            if sentence[0].islower():
                sentence = sentence[0].upper() + sentence[1:]
            sentences.append(sentence)

            changes.append(ChangeDescription(
                operation=op,
                target=target,
                description=sentence,
                technical=tech_detail,
            ))
            tech_lines.append(f"- {target_part.strip()} {tech_base}".strip())

        if skipped:
            skip_ops = ", ".join(e.get("operation", "") for e in skipped)
            tech_lines.append(f"- {skip_ops} skipped.")

        if failed:
            fail_ops = ", ".join(e.get("operation", "") for e in failed)
            fail_reasons = "; ".join(e.get("reason", "") or "unknown error" for e in failed)
            sentences.append(f"However, {fail_ops} could not be completed.")
            tech_lines.append(f"- {fail_ops} failed: {fail_reasons}")

        if not successful and not skipped and not failed:
            sentences = ["No edits were performed."]
            tech_lines = ["No operations executed."]
        elif not successful:
            if skipped:
                sentences = [f"No edits were applied. The requested operations were skipped."]
            elif failed:
                sentences = [f"The edits could not be completed."]

        plain_english = " ".join(sentences)
        technical_summary = "\n".join(tech_lines)

        return ExplanationResult(
            plain_english=plain_english,
            technical_summary=technical_summary,
            changes=changes,
        )
