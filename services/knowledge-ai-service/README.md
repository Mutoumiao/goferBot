# Knowledge AI Service

GoferBot **Knowledge Domain** 独立服务（Python / FastAPI）：文档索引、混合检索（pgvector + ES BM25）、API Rerank、知识问答 SSE。

> **不是** Companion AI Runtime。伴侣域仍在 NestJS。

## 前置

- Python 3.12+
- **[uv](https://github.com/astral-sh/uv)**（本仓库开发强制使用）
- 可选：本机或 Docker 中的 PostgreSQL(pgvector) + Elasticsearch

## 本地开发（uv 虚拟环境）

```bash
cd services/knowledge-ai-service

# 1) 创建项目虚拟环境
uv venv

# 2) 安装依赖（含 dev）
uv sync --all-extras

# 3) 配置环境变量
cp .env.example .env
# 编辑 KNOWLEDGE_AI_SERVICE_TOKEN / DATABASE_URL / ELASTICSEARCH_URL

# 4) 启动
uv run python -m knowledge_ai.main
# 或
uv run knowledge-ai

# 5) 测试
uv run pytest
```

Windows（PowerShell）激活 venv（可选，`uv run` 已足够）：

```powershell
.\.venv\Scripts\Activate.ps1
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `KNOWLEDGE_AI_SERVICE_TOKEN` | Nest→Python 服务令牌（必填）；**production 禁止弱默认且长度≥16** |
| `ENVIRONMENT` | `development` / `production`（默认 development） |
| `KNOWLEDGE_AI_ENABLE_DOCS` | 覆盖是否暴露 `/docs`；默认 production 关闭、development 开启 |
| `DATABASE_URL` | 与业务同实例 PG；使用 `knowledge` schema |
| `ELASTICSEARCH_URL` | ES 地址（全文 BM25 only）；容器内用服务名非 `127.0.0.1` |
| `ELASTICSEARCH_INDEX` | 默认 `knowledge_chunks` |
| `EMBEDDING_DIMENSION` | Phase 1 默认 1536 |
| `LANGFUSE_*` | 可选；未配置仍可运行 |

Nest 侧权威基址变量为 **`KNOWLEDGE_AI_BASE_URL`**（`KNOWLEDGE_AI_URL` 仅遗留别名）。

## API（均需 `Authorization: Bearer <token>`，`/health` 除外）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | PG + ES 依赖探测 |
| POST | `/index` | 索引 replace（PG+ES 双写） |
| DELETE | `/documents/{id}` | 删除文档索引 |
| DELETE | `/kb/{kb_id}` | 按知识库级联清理 |
| POST | `/retrieve` | 混合检索 |
| POST | `/query` | 检索 + 非流式生成 |
| POST | `/stream` | SSE：`sources` → `message`* → `message_end` |

Python **禁止**作为浏览器/公网用户入口；仅 Nest 内网调用。

## Docker Compose

先启动 infra（PG/Redis/MinIO）：

```bash
docker compose -f docker-compose.dev.yml up -d
```

再启动 ES + knowledge-ai（共享 `goferbot-infra` 网络）：

```bash
# 勿把宿主机的 ELASTICSEARCH_URL=http://127.0.0.1:9200 注入容器；
# 容器内默认使用 http://elasticsearch:9200（可用 KNOWLEDGE_AI_ELASTICSEARCH_URL 覆盖）
docker compose -f services/knowledge-ai-service/docker-compose.knowledge.yml up -d --build
```

服务仅绑定 `127.0.0.1:8090`；Elasticsearch 宿主机端口亦绑定 `127.0.0.1:9200`（security 关闭的本地栈）。

### DoD 快速验收（Python 边界）

```bash
# 要求：ES :9200 与 knowledge-ai :8090 已启动且 /health 为 ok
export KNOWLEDGE_AI_BASE=http://127.0.0.1:8090
export KNOWLEDGE_AI_SERVICE_TOKEN=dev-token-change-me   # 与容器/env 一致
cd services/knowledge-ai-service
uv run python scripts/dod_acceptance.py
```

## 管线顺序（Phase 1）

L1 Must-Merged → filter `kb_ids` → ES BM25 ∥ pgvector → RRF → **Parent** → **API Rerank**（失败 R1 降级）→ Context → Generation。

空检索默认 **strict**：业务成功 + `retrieval_empty`，不编造知识断言。

## 目录

```
src/knowledge_ai/
  api/            # routes
  auth/           # service token
  indexing/       # chunker / embed / replace indexer
  retrieval/      # hybrid / rrf / parent / api_rerank
  understanding/  # Must-Merged L1
  generation/     # context + LLM
  infrastructure/ # PG + ES
  observability/  # trace + langfuse optional
```
