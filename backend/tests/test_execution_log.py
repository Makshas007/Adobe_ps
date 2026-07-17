from __future__ import annotations

from app.services.execution_log import ExecutionLog, ExecutionLogEntry, LogStatus


def test_execution_log_append():
    log = ExecutionLog()
    entry = ExecutionLogEntry(
        operation="segment",
        target="person",
        model="sam-vit-base",
        status=LogStatus.SUCCESS,
        duration=100.0,
    )
    log.append(entry)
    assert len(log.entries) == 1
    assert log.entries[0].operation == "segment"


def test_execution_log_to_dict():
    log = ExecutionLog()
    log.append(ExecutionLogEntry(
        operation="upscale",
        model="esrgan",
        status=LogStatus.SKIPPED,
        reason="Image already high resolution",
        duration=0.0,
    ))
    result = log.to_dict()
    assert len(result) == 1
    assert result[0]["operation"] == "upscale"
    assert result[0]["status"] == "skipped"
    assert result[0]["reason"] == "Image already high resolution"


def test_successful_entries_filter():
    log = ExecutionLog()
    log.append(ExecutionLogEntry(operation="segment", status=LogStatus.SUCCESS, duration=50.0))
    log.append(ExecutionLogEntry(operation="remove", status=LogStatus.SUCCESS, duration=100.0))
    log.append(ExecutionLogEntry(operation="upscale", status=LogStatus.SKIPPED, duration=0.0))
    log.append(ExecutionLogEntry(operation="enhance", status=LogStatus.FAILED, duration=10.0))

    successful = log.successful_entries()
    assert len(successful) == 2
    assert all(e.status == LogStatus.SUCCESS for e in successful)


def test_skipped_entries_filter():
    log = ExecutionLog()
    log.append(ExecutionLogEntry(operation="segment", status=LogStatus.SUCCESS, duration=50.0))
    log.append(ExecutionLogEntry(operation="upscale", status=LogStatus.SKIPPED, duration=0.0))

    skipped = log.skipped_entries()
    assert len(skipped) == 1
    assert skipped[0].operation == "upscale"


def test_failed_entries_filter():
    log = ExecutionLog()
    log.append(ExecutionLogEntry(operation="segment", status=LogStatus.SUCCESS, duration=50.0))
    log.append(ExecutionLogEntry(operation="remove", status=LogStatus.FAILED, duration=10.0, reason="OOM"))

    failed = log.failed_entries()
    assert len(failed) == 1
    assert failed[0].reason == "OOM"


def test_empty_log():
    log = ExecutionLog()
    assert log.to_dict() == []
    assert log.successful_entries() == []
    assert log.skipped_entries() == []
    assert log.failed_entries() == []
