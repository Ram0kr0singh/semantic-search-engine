"""Backward-compatible SciFact loader."""

from __future__ import annotations

from pathlib import Path

from .beir import BeirDataset, load_dataset


SciFactDataset = BeirDataset


def load_scifact(data_dir: str | Path = "data") -> SciFactDataset:
    """Load the BEIR SciFact test collection.

    Prefer :func:`backend.app.data.beir.load_dataset` in new code.
    """
    return load_dataset("scifact", data_dir)
