from __future__ import annotations

import pytest

from app.services.explanation.local_provider import LocalExplanationProvider


@pytest.fixture
def provider():
    return LocalExplanationProvider()


@pytest.mark.asyncio
async def test_successful_operations_described(provider):
    log = [
        {"operation": "segment", "target": "person", "status": "success", "duration": 50.0, "parameters": {}, "model": "sam-vit-base"},
        {"operation": "replace_background", "target": "background", "status": "success", "duration": 100.0, "parameters": {"instruction": "beach"}, "model": "sd-inpaint"},
    ]
    result = await provider.generate_explanation(prompt="put the person on a beach", execution_log=log)
    assert "person" in result.plain_english.lower() or "was" in result.plain_english.lower()
    assert len(result.changes) == 2
    assert all(c.operation for c in result.changes)


@pytest.mark.asyncio
async def test_skipped_operations_not_falsely_described_as_successful(provider):
    log = [
        {"operation": "segment", "target": "person", "status": "success", "duration": 50.0, "parameters": {}, "model": "sam-vit-base"},
        {"operation": "upscale", "target": "", "status": "skipped", "duration": 0.0, "parameters": {}, "model": "esrgan", "reason": "Image already high resolution"},
    ]
    result = await provider.generate_explanation(prompt="upscale the image", execution_log=log)
    # The successful change should be mentioned
    assert len([c for c in result.changes if c.operation == "segment"]) == 1
    # Skipped operation should NOT appear in changes as a successful description
    skipped_in_changes = [c for c in result.changes if c.operation == "upscale" and "success" in c.description.lower()]
    assert len(skipped_in_changes) == 0
    # The technical summary should mention it was skipped
    assert "skip" in result.technical_summary.lower()


@pytest.mark.asyncio
async def test_failed_operations_not_falsely_described_as_successful(provider):
    log = [
        {"operation": "segment", "target": "person", "status": "success", "duration": 50.0, "parameters": {}, "model": "sam-vit-base"},
        {"operation": "remove", "target": "", "status": "failed", "duration": 100.0, "parameters": {}, "model": "sd-inpaint", "reason": "Out of memory"},
    ]
    result = await provider.generate_explanation(prompt="remove the person", execution_log=log)
    # The successful segment should be mentioned
    assert len([c for c in result.changes if c.operation == "segment"]) == 1
    # The failed operation should NOT be in changes as successful
    failed_in_changes = [c for c in result.changes if c.operation == "remove"]
    assert len(failed_in_changes) == 0


@pytest.mark.asyncio
async def test_all_skipped_no_success(provider):
    log = [
        {"operation": "upscale", "target": "", "status": "skipped", "duration": 0.0, "parameters": {}, "model": "esrgan", "reason": "Not needed"},
    ]
    result = await provider.generate_explanation(prompt="upscale", execution_log=log)
    assert len(result.changes) == 0
    assert "skip" in result.technical_summary.lower()


@pytest.mark.asyncio
async def test_all_failed_no_success(provider):
    log = [
        {"operation": "segment", "target": "person", "status": "failed", "duration": 10.0, "parameters": {}, "model": "sam-vit-base", "reason": "Model not loaded"},
    ]
    result = await provider.generate_explanation(prompt="segment the person", execution_log=log)
    assert len(result.changes) == 0


@pytest.mark.asyncio
async def test_empty_log(provider):
    result = await provider.generate_explanation(prompt="do nothing", execution_log=[])
    assert result.plain_english
    assert result.technical_summary


@pytest.mark.asyncio
async def test_changes_match_log_operations(provider):
    log = [
        {"operation": "segment", "target": "car", "status": "success", "duration": 50.0, "parameters": {}, "model": "sam-vit-base"},
        {"operation": "change_style", "target": "", "status": "success", "duration": 200.0, "parameters": {"instruction": "cyberpunk"}, "model": "instruct-pix2pix"},
    ]
    result = await provider.generate_explanation(prompt="make the car cyberpunk", execution_log=log)
    ops_in_changes = [c.operation for c in result.changes]
    assert "segment" in ops_in_changes
    assert "change_style" in ops_in_changes
    assert len(result.changes) == 2
