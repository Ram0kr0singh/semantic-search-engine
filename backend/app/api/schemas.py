"""Pydantic models used by the HTTP API."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class SearchRequest(BaseModel):
    query: str
    method: str | None = None
    k: int = Field(default=10, ge=1, le=50)

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be empty")
        if len(value) > 500:
            raise ValueError("query must be at most 500 characters")
        return value


class SearchItem(BaseModel):
    rank: int
    score: float
    id: str
    title: str
    snippet: str
    categories: list[str]
    year: int | None


class SearchResponse(BaseModel):
    query: str
    method: str
    k: int
    took_ms: float
    results: list[SearchItem]


class EvaluationRun(BaseModel):
    method: str
    dataset: str
    model: str | None = None
    generated_at: str
    query_count: int = Field(ge=0)
    recall_at_1: float = Field(ge=0, le=1)
    recall_at_5: float = Field(ge=0, le=1)
    recall_at_10: float = Field(ge=0, le=1)
    recall_at_100: float = Field(ge=0, le=1)
    mrr_at_10: float = Field(ge=0, le=1)
    ndcg_at_10: float = Field(ge=0, le=1)
    index_build_seconds: float = Field(ge=0)
    average_query_latency_ms: float = Field(ge=0)


class EvaluationResponse(BaseModel):
    runs: list[EvaluationRun]
    hardware_note: str
    generated_at: str
