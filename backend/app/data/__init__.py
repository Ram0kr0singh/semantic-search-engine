"""Dataset loading utilities."""

from .beir import DATASET_REGISTRY, BeirDataset, dataset_names, load_dataset

__all__ = ["DATASET_REGISTRY", "BeirDataset", "dataset_names", "load_dataset"]
