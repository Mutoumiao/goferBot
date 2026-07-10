"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from knowledge_ai import __version__
from knowledge_ai.api.routes import router
from knowledge_ai.auth.service_token import ServiceTokenMiddleware
from knowledge_ai.config import get_settings
from knowledge_ai.indexing.indexer import Indexer
from knowledge_ai.infrastructure.elasticsearch_store import ElasticsearchStore
from knowledge_ai.infrastructure.pg import PgChunkStore
from knowledge_ai.retrieval.hybrid import HybridRetriever

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("knowledge_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    pg = PgChunkStore(settings)
    es = ElasticsearchStore(settings)

    # Connect best-effort so /health can report degraded; core ops need both.
    try:
        await pg.connect()
        logger.info("PostgreSQL connected")
    except Exception:
        logger.exception("PostgreSQL connect failed at startup")
    try:
        await es.connect()
        logger.info("Elasticsearch connected")
    except Exception:
        logger.exception("Elasticsearch connect failed at startup")

    app.state.settings = settings
    app.state.pg = pg
    app.state.es = es
    app.state.indexer = Indexer(pg, es, settings)
    app.state.retriever = HybridRetriever(pg, es, settings)

    yield

    await pg.close()
    await es.close()


def create_app() -> FastAPI:
    settings = get_settings()
    # Production: no public OpenAPI UI (info disclosure). Dev keeps /docs.
    docs_url = "/docs" if settings.docs_enabled else None
    redoc_url = "/redoc" if settings.docs_enabled else None
    openapi_url = "/openapi.json" if settings.docs_enabled else None
    app = FastAPI(
        title="Knowledge AI Service",
        version=__version__,
        description="GoferBot Knowledge Domain: index / hybrid retrieve / knowledge Q&A",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )
    app.add_middleware(ServiceTokenMiddleware, settings=settings)
    app.include_router(router)
    return app


app = create_app()


def run() -> None:
    settings = get_settings()
    uvicorn.run(
        "knowledge_ai.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    run()
