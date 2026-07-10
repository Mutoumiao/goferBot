"""Context builder + citation markers."""

from __future__ import annotations

from knowledge_ai.schemas import SourceItem


def build_context(sources: list[SourceItem], *, max_chars: int = 8000) -> str:
    parts: list[str] = []
    total = 0
    for i, s in enumerate(sources, start=1):
        block = f"[{i}] (kb={s.kb_id}, doc={s.document_id})\n{s.content or ''}\n"
        if total + len(block) > max_chars:
            break
        parts.append(block)
        total += len(block)
    return "\n".join(parts)
