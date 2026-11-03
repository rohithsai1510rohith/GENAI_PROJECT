import secrets
import sys
import time
import uuid
from pathlib import Path

# Add apps/ai-service to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import chat, health, ingest, suggest
from app.core.config import settings
from app.core.logging import logger

app = FastAPI(
    title="Traffic Rules & Fines Assistant AI Microservice",
    description="Grounded RAG microservice using PyMuPDF, sentence-transformers, FAISS and Groq LLM",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID & Structured Logging Middleware
@app.middleware("http")
async def add_request_id_and_log(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = req_id
    start_time = time.time()

    logger.info(f"[{req_id}] Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(f"[{req_id}] Completed {request.method} {request.url.path} with status {response.status_code} in {duration_ms}ms")

    response.headers["X-Request-ID"] = req_id
    return response

# Shared Secret Middleware for internal Node-to-AI-service security
@app.middleware("http")
async def verify_shared_secret(request: Request, call_next):
    # Allow public health check and docs without secret
    if request.url.path in ["/health", "/docs", "/openapi.json", "/"]:
        return await call_next(request)

    # Require shared secret for internal /rag endpoints (constant-time comparison)
    secret = request.headers.get("X-Internal-Secret")
    if not secret or not secrets.compare_digest(secret, settings.AI_SERVICE_SHARED_SECRET):
        logger.warning(f"Unauthorized internal access attempt to {request.url.path}")
        return JSONResponse(
            status_code=403,
            content={"detail": "Forbidden: Invalid or missing X-Internal-Secret header."}
        )

    return await call_next(request)

# Include API Routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(ingest.router)
app.include_router(suggest.router)

@app.on_event("startup")
async def on_startup():
    logger.info("=" * 60)
    logger.info("Traffic Rules & Fines RAG Microservice started successfully")
    logger.info(f"Groq Model: {settings.GROQ_MODEL}")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    logger.info(f"Index Directory: {settings.INDEX_PATH}")
    logger.info("=" * 60)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=8000, reload=False)
