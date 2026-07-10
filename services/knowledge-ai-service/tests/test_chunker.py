from knowledge_ai.indexing.chunker import chunk_parent_child


def test_chunk_parent_child_basic():
    text = "A" * 1000 + "B" * 1000
    pieces = chunk_parent_child(text, parent_size=800, child_size=300, overlap=20)
    parents = [p for p in pieces if p.is_parent]
    children = [p for p in pieces if not p.is_parent]
    assert len(parents) >= 2
    assert len(children) >= len(parents)
    assert all(c.parent_content for c in children)


def test_chunk_empty():
    assert chunk_parent_child("   ") == []
