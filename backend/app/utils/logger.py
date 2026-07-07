from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        return (
            f"[{timestamp}] {record.levelname:8s} | {record.name:<20s} | "
            f"{record.getMessage()}"
        )


def setup_logger(
    name: str = "app",
    level: str = "INFO",
    log_file: Optional[Path] = None,
) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if logger.handlers:
        return logger

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(StructuredFormatter())
    logger.addHandler(console_handler)

    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(StructuredFormatter())
        logger.addHandler(file_handler)

    return logger


app_logger = setup_logger()


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
