"""Parent-child text chunking."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChunkPiece:
    content: str
    is_parent: bool
    parent_index: int | None  # index into parents list for children
    parent_content: str | None


def _split_windows(text: str, size: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if size <= 0:
        return [text]
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def chunk_parent_child(
    text: str,
    *,
    parent_size: int = 1200,
    child_size: int = 400,
    overlap: int = 50,
) -> list[ChunkPiece]:
    """
    Split text into parent windows, then children within each parent.
    Returns parents first (is_parent=True), then children referencing parent_index.
    """
    parents = _split_windows(text, parent_size, overlap)
    if not parents:
        return []

    pieces: list[ChunkPiece] = []
    for i, parent in enumerate(parents):
        pieces.append(
            ChunkPiece(
                content=parent,
                is_parent=True,
                parent_index=None,
                parent_content=None,
            )
        )
        children = _split_windows(parent, child_size, overlap)
        if not children:
            children = [parent]
        for child in children:
            pieces.append(
                ChunkPiece(
                    content=child,
                    is_parent=False,
                    parent_index=i,
                    parent_content=parent,
                )
            )
    return pieces
