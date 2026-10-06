# app/workers/celery_app.py
from celery import Celery
from app.config import settings

celery = Celery(
    "rag_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,          # Retry on worker crash
    worker_prefetch_multiplier=1, # One task at a time per worker (heavy CPU tasks)
    task_routes={
        "app.workers.tasks.process_document": {"queue": "ingestion"},
    },
)
