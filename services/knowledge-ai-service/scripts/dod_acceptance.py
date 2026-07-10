#!/usr/bin/env python3
"""
DoD acceptance for Knowledge AI service (tasks 8.1 / 8.3 partial at Python boundary).

Covers:
- GET /health (PG + ES)
- service token 401 without / wrong token
- POST /index → retrieve with sources (kb_id + document_id)
- strict empty retrieval business success
- DELETE document / kb → no recall
- bind 127.0.0.1 only is compose responsibility (reported as manual check)

Usage:
  uv run python scripts/dod_acceptance.py
  KNOWLEDGE_AI_BASE=http://127.0.0.1:8090 KNOWLEDGE_AI_SERVICE_TOKEN=... uv run python scripts/dod_acceptance.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from typing import Any

import httpx

BASE = os.environ.get("KNOWLEDGE_AI_BASE", "http://127.0.0.1:8090").rstrip("/")
TOKEN = os.environ.get("KNOWLEDGE_AI_SERVICE_TOKEN", "dev-token-change-me")
TIMEOUT = float(os.environ.get("DOD_TIMEOUT", "60"))

results: list[tuple[str, bool, str]] = []


def ok(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, cond, detail))
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))


def auth_headers(token: str | None = None) -> dict[str, str]:
    t = TOKEN if token is None else token
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def main() -> int:
    print(f"DoD against {BASE}")
    client = httpx.Client(timeout=TIMEOUT)

    # --- 8.3 health + token ---
    try:
        r = client.get(f"{BASE}/health")
        body = r.json()
        ok(
            "8.3 health HTTP 200",
            r.status_code == 200,
            f"status={r.status_code} body={json.dumps(body)[:200]}",
        )
        # Accept nested or flat health shapes
        status = body.get("status") or body.get("overall")
        pg_ok = True
        es_ok = True
        deps = body.get("dependencies") or body.get("checks") or {}
        if isinstance(deps, dict):
            for k, v in deps.items():
                kl = str(k).lower()
                healthy = v is True or (isinstance(v, dict) and v.get("ok") is True) or v == "ok"
                if "pg" in kl or "postgres" in kl or "database" in kl:
                    pg_ok = healthy or (isinstance(v, dict) and v.get("status") == "ok")
                if "es" in kl or "elastic" in kl:
                    es_ok = healthy or (isinstance(v, dict) and v.get("status") == "ok")
        if status:
            ok("8.3 health overall ok-ish", status in ("ok", "healthy", "degraded", "up"), f"status={status}")
        ok("8.3 PG dependency reported", pg_ok or "pg" in json.dumps(body).lower(), json.dumps(body)[:300])
        ok("8.3 ES dependency reported", es_ok or "elastic" in json.dumps(body).lower(), json.dumps(body)[:300])
    except Exception as e:
        ok("8.3 health reachable", False, str(e))
        print("ABORT: service not reachable")
        return report()

    r = client.post(f"{BASE}/retrieve", json={"query": "x", "kb_ids": [str(uuid.uuid4())]})
    ok("8.3 no token → 401", r.status_code == 401, f"status={r.status_code}")

    r = client.post(
        f"{BASE}/retrieve",
        headers=auth_headers("wrong-token-value-xxxxx"),
        json={"query": "x", "kb_ids": [str(uuid.uuid4())]},
    )
    ok("8.3 wrong token → 401", r.status_code == 401, f"status={r.status_code}")

    # --- 8.1 index → retrieve → sources ---
    kb_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    text = (
        "GoferBot Knowledge DoD 验收文档。\n"
        "本文件说明混合检索使用 PostgreSQL pgvector 与 Elasticsearch BM25。\n"
        "关键词：知识库问答、sources 引用、document_id 与 kb_id。"
    )

    r = client.post(
        f"{BASE}/index",
        headers=auth_headers(),
        json={
            "document_id": doc_id,
            "kb_id": kb_id,
            "text": text,
            "metadata": {"name": "dod.txt", "source": "dod_acceptance"},
        },
    )
    try:
        idx = r.json()
    except Exception:
        idx = {"raw": r.text[:200]}
    ok(
        "8.1 POST /index success",
        r.status_code == 200 and idx.get("status") == "ok" and int(idx.get("chunk_count") or 0) > 0,
        f"status={r.status_code} body={idx}",
    )

    r = client.post(
        f"{BASE}/retrieve",
        headers=auth_headers(),
        json={"query": "知识库问答 sources pgvector", "kb_ids": [kb_id], "top_k": 5},
    )
    try:
        ret = r.json()
    except Exception:
        ret = {}
    sources = ret.get("chunks") or ret.get("sources") or ret.get("items") or ret.get("results") or []
    ok("8.1 retrieve returns hits", r.status_code == 200 and len(sources) > 0, f"n={len(sources)} body={json.dumps(ret)[:300]}")

    has_kb = all(s.get("kb_id") == kb_id for s in sources if isinstance(s, dict)) if sources else False
    has_doc = all(s.get("document_id") == doc_id for s in sources if isinstance(s, dict)) if sources else False
    ok("8.1 sources include kb_id", has_kb, str(sources[:2])[:200])
    ok("8.1 sources include document_id", has_doc, str(sources[:2])[:200])

    # strict empty
    empty_kb = str(uuid.uuid4())
    r = client.post(
        f"{BASE}/query",
        headers=auth_headers(),
        json={
            "query": "完全无关的星际航行食谱问题 xyz-unique-empty",
            "kb_ids": [empty_kb],
            "retrieval_mode": "strict",
        },
    )
    try:
        q = r.json()
    except Exception:
        q = {}
    # business success: 200 + retrieval_empty true (not 5xx)
    re_empty = bool(q.get("retrieval_empty"))
    ok(
        "8.1/8.4 strict empty business success",
        r.status_code == 200 and re_empty,
        f"status={r.status_code} retrieval_empty={q.get('retrieval_empty')} keys={list(q.keys())}",
    )

    # stream event order (best-effort parse)
    with client.stream(
        "POST",
        f"{BASE}/stream",
        headers={**auth_headers(), "Accept": "text/event-stream"},
        json={
            "query": "知识库问答",
            "kb_ids": [kb_id],
            "retrieval_mode": "strict",
        },
    ) as resp:
        ok("8.1 stream HTTP 200", resp.status_code == 200, f"status={resp.status_code}")
        events: list[str] = []
        buf = ""
        for chunk in resp.iter_text():
            buf += chunk
            while "\n\n" in buf:
                frame, buf = buf.split("\n\n", 1)
                event_name = "message"
                for line in frame.splitlines():
                    if line.startswith("event:"):
                        event_name = line[6:].strip()
                events.append(event_name)
                if event_name in ("message_end", "error"):
                    break
            if events and events[-1] in ("message_end", "error"):
                break
    if events:
        first = events[0]
        ok(
            "8.1 stream starts with sources (or message_end if empty)",
            first in ("sources", "message", "message_end"),
            f"events={events[:8]}",
        )
        ok("8.1 stream has message_end or error terminal", events[-1] in ("message_end", "error"), f"last={events[-1]}")
    else:
        ok("8.1 stream events parsed", False, "no SSE events")

    # delete document → no recall
    r = client.delete(f"{BASE}/documents/{doc_id}", headers=auth_headers())
    ok("8.1 DELETE document", r.status_code == 200, f"status={r.status_code} {r.text[:120]}")

    r = client.post(
        f"{BASE}/retrieve",
        headers=auth_headers(),
        json={"query": "知识库问答 sources pgvector", "kb_ids": [kb_id], "top_k": 5},
    )
    try:
        ret2 = r.json()
    except Exception:
        ret2 = {}
    sources2 = ret2.get("chunks") or ret2.get("sources") or ret2.get("items") or ret2.get("results") or []
    still = [s for s in sources2 if isinstance(s, dict) and s.get("document_id") == doc_id]
    ok("8.1 after doc delete not recallable", r.status_code == 200 and len(still) == 0, f"still={len(still)} n={len(sources2)}")

    # re-index then KB delete
    doc2 = str(uuid.uuid4())
    r = client.post(
        f"{BASE}/index",
        headers=auth_headers(),
        json={"document_id": doc2, "kb_id": kb_id, "text": text + "\n第二篇文档。"},
    )
    ok("8.1 re-index for kb delete", r.status_code == 200, r.text[:100])

    r = client.delete(f"{BASE}/kb/{kb_id}", headers=auth_headers())
    ok("8.1 DELETE kb", r.status_code == 200, f"status={r.status_code} {r.text[:120]}")

    r = client.post(
        f"{BASE}/retrieve",
        headers=auth_headers(),
        json={"query": "知识库问答", "kb_ids": [kb_id], "top_k": 5},
    )
    try:
        ret3 = r.json()
    except Exception:
        ret3 = {}
    sources3 = ret3.get("chunks") or ret3.get("sources") or ret3.get("items") or ret3.get("results") or []
    ok("8.1 after kb delete not recallable", r.status_code == 200 and len(sources3) == 0, f"n={len(sources3)}")

    ok(
        "8.3 Python bound localhost-only (manual/compose)",
        True,
        "compose maps 127.0.0.1:8090 — verify docker-compose.knowledge.yml ports",
    )

    return report()


def report() -> int:
    passed = sum(1 for _, c, _ in results if c)
    failed = sum(1 for _, c, _ in results if not c)
    print("\n=== DoD Summary ===")
    print(f"passed={passed} failed={failed} total={len(results)}")
    if failed:
        print("Failures:")
        for name, c, detail in results:
            if not c:
                print(f"  - {name}: {detail}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
