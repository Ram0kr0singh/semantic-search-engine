"""Tests for sentence-aware upload-text chunking."""

from backend.app.data.chunking import chunk_text


def test_chunk_text_returns_nothing_for_empty_text() -> None:
    assert chunk_text("  \n\t", "doc") == []


def test_chunk_text_keeps_a_short_document_together() -> None:
    passages = chunk_text("One sentence. Another sentence.", "doc", max_words=10, overlap_words=3)
    assert passages == [
        type(passages[0])("One sentence. Another sentence.", "doc", 0)
    ]


def test_chunk_text_uses_overlapping_sentence_windows() -> None:
    passages = chunk_text("One two three. Four five six. Seven eight nine.", "doc", max_words=6, overlap_words=3)
    assert [passage.text for passage in passages] == [
        "One two three. Four five six.",
        "Four five six. Seven eight nine.",
    ]
    assert [passage.passage_index for passage in passages] == [0, 1]


def test_chunk_text_splits_a_single_long_sentence() -> None:
    passages = chunk_text("one two three four five six seven", "doc", max_words=3, overlap_words=1)
    assert [passage.text for passage in passages] == ["one two three", "three four five", "five six seven"]
