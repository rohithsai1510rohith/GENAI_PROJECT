import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.logging import logger
from app.generation.card_builder import build_quick_answer_card
from app.generation.groq_client import groq_client
from app.retrieval.retriever import retriever
from app.schemas.chat_schemas import QueryRequest, QueryResponse

router = APIRouter(prefix="/rag", tags=["RAG"])

@router.post("/query")
async def query_rag(req: QueryRequest):
    start_time = time.time()
    try:
        # Convert Pydantic history models to dicts for retriever query rewriting
        history_dicts = [{"role": h.role, "content": h.content} for h in (req.history or [])]

        ret_result = retriever.retrieve(
            query=req.question,
            filters=req.filters,
            history=history_dicts
        )

        if req.stream:
            return StreamingResponse(
                groq_client.stream_response(
                    question=req.question,
                    sources=ret_result.sources,
                    history=req.history,
                    confidence_tier=ret_result.confidence_tier,
                    is_grounded=ret_result.is_grounded,
                    is_non_traffic=ret_result.is_non_traffic,
                    is_gibberish=ret_result.is_gibberish,
                    did_you_mean=ret_result.did_you_mean,
                    related_questions=ret_result.related_questions,
                    closest_topics=ret_result.closest_topics,
                    subqueries=ret_result.subqueries
                ),
                media_type="text/event-stream"
            )

        answer = await groq_client.generate_response(
            question=req.question,
            sources=ret_result.sources,
            history=req.history,
            confidence_tier=ret_result.confidence_tier,
            is_grounded=ret_result.is_grounded,
            is_non_traffic=ret_result.is_non_traffic,
            is_gibberish=ret_result.is_gibberish,
            did_you_mean=ret_result.did_you_mean,
            subqueries=ret_result.subqueries
        )
        latency = int((time.time() - start_time) * 1000)
        card = build_quick_answer_card(ret_result.sources, req.question, ret_result.subqueries) if ret_result.is_grounded else None

        return QueryResponse(
            answer=answer,
            card=card,
            sources=ret_result.sources,
            grounded=ret_result.is_grounded,
            confidence=ret_result.top_score,
            confidenceTier=ret_result.confidence_tier,
            didYouMean=ret_result.did_you_mean,
            relatedQuestions=ret_result.related_questions,
            closestTopics=ret_result.closest_topics,
            isNonTraffic=ret_result.is_non_traffic,
            isGibberish=ret_result.is_gibberish,
            latencyMs=latency
        )
    except Exception as e:
        logger.error(f"Error in RAG query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



from pydantic import BaseModel, Field

from app.schemas.chat_schemas import Filters, SourceItem


class SearchRequest(BaseModel):
    question: str = Field(..., min_length=1)
    filters: Filters | None = Field(default_factory=Filters)
    top_k: int | None = 5

class SearchResponse(BaseModel):
    sources: list[SourceItem]
    confidenceTier: str
    topScore: float
    grounded: bool
    containsTestData: bool
    didYouMean: str | None = None
    relatedQuestions: list[str] = Field(default_factory=list)
    closestTopics: list[str] = Field(default_factory=list)

@router.post("/search", response_model=SearchResponse)
async def search_rag(req: SearchRequest):
    """
    Retrieval only, no LLM. Returns ranked sources with score, tier, and test data flag.
    """
    try:
        ret_result = retriever.retrieve(query=req.question, filters=req.filters)
        contains_test = any(getattr(s, "isTestData", False) for s in ret_result.sources)
        return SearchResponse(
            sources=ret_result.sources,
            confidenceTier=ret_result.confidence_tier,
            topScore=ret_result.top_score,
            grounded=ret_result.is_grounded,
            containsTestData=contains_test,
            didYouMean=ret_result.did_you_mean,
            relatedQuestions=ret_result.related_questions,
            closestTopics=ret_result.closest_topics
        )
    except Exception as e:
        logger.error(f"Error in RAG search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
