from fastapi import APIRouter

from app.core.config import settings
from app.schemas.chat_schemas import HealthResponse
from app.vectorstore.faiss_store import vector_store

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def get_health():
    total_vectors = vector_store.count()
    unique_docs = len({c.get("documentTitle", "") for c in vector_store.metadata})
    is_test = vector_store.has_test_data()

    msg = "WARNING: Index contains sample test data (isTestData: true). Not verified law." if is_test else "Index loaded with verified statutory documents."

    return HealthResponse(
        status="healthy",
        service="traffic-assistant-ai",
        version="1.0.0",
        indexLoaded=total_vectors > 0,
        totalDocuments=unique_docs,
        totalVectors=total_vectors,
        groqModel=settings.GROQ_MODEL,
        isTestData=is_test,
        message=msg
    )
