"""
app/workers/tasks.py
Optional Celery task for document ingestion.

The worker uses the same Supabase REST pipeline as the FastAPI background
task. That keeps ingestion independent of direct Postgres connectivity.
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

try:
    from app.workers.celery_app import celery
except Exception as celery_err:
    logger.warning("Celery not available: %s", celery_err)

    class _StubCelery:
        def task(self, *args, **kwargs):
            def decorator(fn):
                def unavailable(*_args, **_kwargs):
                    raise RuntimeError("Celery is not available in this environment")

                fn.delay = unavailable
                fn.apply_async = unavailable
                return fn

            return decorator

    celery = _StubCelery()  # type: ignore


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="app.workers.tasks.process_document",
)
def process_document(
    self,
    doc_id: str,
    storage_path: str,
    doc_type: str,
    user_id: str,
    doc_name: str,
):
    """Run the document ingestion pipeline through Supabase REST."""
    try:
        from app.config import settings

        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

        from supabase import create_client
        from app.services.pipeline.sync_pipeline import run_ingestion_pipeline

        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        _run(run_ingestion_pipeline(doc_id, storage_path, doc_type, user_id, doc_name, sb))
        logger.info("[%s] Celery REST ingestion finished", doc_id)
    except Exception as exc:
        logger.error("[%s] Celery REST ingestion failed: %s", doc_id, exc, exc_info=True)
        raise self.retry(exc=exc)
