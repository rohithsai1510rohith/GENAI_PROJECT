from typing import Any

from app.core.config import settings
from app.embeddings.embedder import embedder
from app.retrieval.bm25 import bm25_index
from app.retrieval.nlp_utils import (
    correct_spelling_and_expand,
    generate_related_questions,
    get_closest_topics,
    is_adversarial_query,
    is_gibberish,
    is_non_traffic_query,
    rewrite_followup_question,
    split_multipart_question,
)
from app.schemas.chat_schemas import Filters, SourceItem
from app.vectorstore.faiss_store import vector_store


class RetrievalResult:
    def __init__(
        self,
        sources: list[SourceItem],
        top_score: float,
        confidence_tier: str,
        is_grounded: bool,
        is_non_traffic: bool = False,
        is_gibberish: bool = False,
        did_you_mean: str | None = None,
        related_questions: list[str] | None = None,
        closest_topics: list[str] | None = None,
        subqueries: list[str] | None = None
    ):
        self.sources = sources
        self.top_score = top_score
        self.confidence_tier = confidence_tier  # "HIGH" | "MEDIUM" | "LOW"
        self.is_grounded = is_grounded
        self.is_non_traffic = is_non_traffic
        self.is_gibberish = is_gibberish
        self.did_you_mean = did_you_mean
        self.related_questions = related_questions or []
        self.closest_topics = closest_topics or []
        self.subqueries = subqueries or []

def check_answerability_gate(query: str, top_chunk: dict[str, Any], dense_score: float, bm25_score: float) -> bool:
    """
    Answerability Gate: grounded is True only with real legal evidence.
    1. Direct statutory citation: explicit Section X / Rule Y in query matching chunk section or text (dense >= 0.38)
    2. Strong semantic vector alignment: dense >= 0.60
    3. Moderate alignment: dense >= 0.50 with specific substantive keyword overlap (>= 2 terms) AND BM25 support (bm25 > 0)
    Otherwise returns False.
    """
    import re

    from app.retrieval.nlp_utils import COMMON_STOPWORDS

    q_lower = query.lower()
    sec_match = re.search(r'(section|sec\.?|rule)\s+([0-9]+[a-z]*)', q_lower)
    if sec_match:
        ref = sec_match.group(0)
        chunk_sec = (top_chunk.get("section") or "").lower()
        chunk_text = (top_chunk.get("text") or "").lower()
        if (ref in chunk_sec or ref in chunk_text) and dense_score >= 0.38:
            return True

    if dense_score >= 0.60:
        return True

    words = re.findall(r'[a-zA-Z0-9]+', q_lower)
    generic = {"what", "fine", "penalty", "rule", "rules", "traffic", "under", "court", "state", "india", "vehicle", "motor"}
    q_tokens = {w for w in words if w not in COMMON_STOPWORDS and w not in generic and len(w) > 2}
    chunk_tokens = set(re.findall(r'[a-zA-Z0-9]+', (top_chunk.get("text") or "").lower()))
    overlap = q_tokens.intersection(chunk_tokens)

    return bool(dense_score >= 0.50 and len(overlap) >= 2 and bm25_score > 0.0)

class LegalRetriever:
    def __init__(
        self,
        top_k: int = settings.TOP_K,
        high_threshold: float = 0.52,
        medium_threshold: float | None = None
    ):
        self.top_k = top_k
        self.high_threshold = high_threshold
        self.medium_threshold = medium_threshold if medium_threshold is not None else settings.SIM_THRESHOLD

    def retrieve(
        self,
        query: str,
        filters: Filters | None = None,
        history: list[dict[str, str]] | None = None
    ) -> RetrievalResult:
        """
        Executes hybrid BM25 + FAISS search with synonym expansion,
        typo correction, multi-turn follow-up rewriting, and confidence tiering.
        """
        cleaned_query = query.strip()

        # 0. Check for adversarial / prompt injection queries
        if is_adversarial_query(cleaned_query):
            return RetrievalResult(
                sources=[],
                top_score=0.0,
                confidence_tier="LOW",
                is_grounded=False,
                closest_topics=["Traffic Violations & Penalties"],
                related_questions=[
                    "What is the fine for riding without a helmet?",
                    "What are the penalties for speeding?",
                    "What are the valid documents under Rule 139?"
                ]
            )

        # 1. Check for gibberish
        if is_gibberish(cleaned_query):
            return RetrievalResult(
                sources=[],
                top_score=0.0,
                confidence_tier="LOW",
                is_grounded=False,
                is_gibberish=True,
                closest_topics=get_closest_topics(""),
                related_questions=generate_related_questions([], cleaned_query)
            )

        # 2. Check for non-traffic questions
        if is_non_traffic_query(cleaned_query):
            return RetrievalResult(
                sources=[],
                top_score=0.0,
                confidence_tier="LOW",
                is_grounded=False,
                is_non_traffic=True,
                closest_topics=[
                    "Traffic Violations & Penalties",
                    "Driving Licences & Renewal",
                    "E-Challan Verification & Payment",
                    "Mandatory Vehicle Documents"
                ],
                related_questions=[
                    "What is the fine for riding without a helmet?",
                    "What documents are mandatory to carry under Rule 139?",
                    "How to check and pay an e-challan online?"
                ]
            )

        # 3. Handle multi-turn follow-up rewriting
        resolved_query = rewrite_followup_question(cleaned_query, history or [])

        # 4. Handle multi-part query splitting
        subqueries = split_multipart_question(resolved_query)

        # 5. Expand spelling & synonyms
        expanded_query, synonyms, did_you_mean = correct_spelling_and_expand(resolved_query)

        if vector_store.count() == 0:
            return RetrievalResult(
                sources=[],
                top_score=0.0,
                confidence_tier="LOW",
                is_grounded=False,
                did_you_mean=did_you_mean,
                closest_topics=get_closest_topics(cleaned_query),
                related_questions=generate_related_questions([], cleaned_query)
            )

        # 6. Dense Vector Search (FAISS)
        dense_vec = embedder.embed_query(expanded_query)
        dense_results = vector_store.search(dense_vec, top_k=self.top_k * 3)

        # 7. Sparse Keyword Search (BM25)
        # Search using both original and expanded tokens
        bm25_results = bm25_index.search(f"{resolved_query} {' '.join(synonyms)}", top_k=self.top_k * 3)

        # 8. Merge and Rank Candidates (Hybrid fusion)
        chunk_scores: dict[str, dict[str, Any]] = {}

        for chunk, dense_score in dense_results:
            cid = chunk.get("id")
            chunk_scores[cid] = {
                "chunk": chunk,
                "dense": float(dense_score),
                "bm25": 0.0
            }

        for chunk, bm25_score in bm25_results:
            cid = chunk.get("id")
            if cid in chunk_scores:
                chunk_scores[cid]["bm25"] = float(bm25_score)
            else:
                chunk_scores[cid] = {
                    "chunk": chunk,
                    "dense": 0.0,
                    "bm25": float(bm25_score)
                }

        # Calculate combined hybrid score
        hybrid_candidates: list[tuple[dict[str, Any], float]] = []
        for cid, data in chunk_scores.items():
            d = data["dense"]
            b = data["bm25"]
            # Hybrid weighting: dense vector + BM25 keyword
            # For short keyword searches, BM25 provides strong exact match boost
            combined = (0.60 * d) + (0.40 * b)
            hybrid_candidates.append((data["chunk"], combined))

        hybrid_candidates.sort(key=lambda x: x[1], reverse=True)

        if not hybrid_candidates:
            return RetrievalResult(
                sources=[],
                top_score=0.0,
                confidence_tier="LOW",
                is_grounded=False,
                did_you_mean=did_you_mean,
                closest_topics=get_closest_topics(cleaned_query),
                related_questions=generate_related_questions([], cleaned_query)
            )

        # Normalize filters
        filter_jur = None
        filter_topic = None
        if filters:
            if isinstance(filters, dict):
                filter_jur = filters.get("jurisdiction")
                filter_topic = filters.get("topic")
            else:
                filter_jur = getattr(filters, "jurisdiction", None)
                filter_topic = getattr(filters, "topic", None)

        sources: list[SourceItem] = []
        top_score = hybrid_candidates[0][1]

        # Prioritize verified enactments: if verified chunks are available, exclude sample data
        has_verified_candidates = any(c.get("verified", False) and not c.get("isTestData", False) for c, _ in hybrid_candidates)

        for chunk, score in hybrid_candidates:
            # Exclude deactivated / inactive documents immediately
            if chunk.get("status") == "inactive" or chunk.get("isActive") is False or chunk.get("deactivated", False):
                continue

            # Exclude sample data if disallowed or when verified official text is present
            if (not settings.ALLOW_SAMPLE_DATA or has_verified_candidates) and chunk.get("isTestData", False):
                continue

            # Documents/chunks marked supersededBy are excluded from retrieval by default
            if chunk.get("supersededBy"):
                continue

            # Check jurisdiction filter
            if filter_jur and filter_jur.lower() != "all":
                chunk_jur = chunk.get("jurisdiction", "Central").lower()
                target_jur = filter_jur.lower()
                # If filtering for a specific state (e.g. Karnataka), Central/different states don't match
                if target_jur != "all" and chunk_jur != target_jur:
                    continue

            # Check topic filter (e.g. documents, fines, road-safety)
            if filter_topic and filter_topic.lower() != "all":
                target_topic = filter_topic.lower()
                chunk_topics = [t.lower() for t in chunk.get("topics", [])]
                if chunk_topics and target_topic not in chunk_topics:
                    continue

            # Merge adjacent continuation chunks of the same statutory section if available
            merged_text = chunk.get("text", "")
            chunk_id = chunk.get("id", "")
            doc_id = chunk.get("documentId")
            sec_name = chunk.get("section")

            import re
            c_match = re.search(r'-c(\d+)$', chunk_id)
            if c_match and sec_name and doc_id:
                curr_c_num = int(c_match.group(1))
                next_c_id = f"{chunk_id[:c_match.start()]}-c{curr_c_num + 1}"
                for other in vector_store.metadata:
                    if (other.get("id") == next_c_id
                            and other.get("section") == sec_name
                            and other.get("documentId") == doc_id):
                        cont_text = other.get("text", "")
                        if cont_text and cont_text[:40] not in merged_text:
                            merged_text = f"{merged_text}\n\n{cont_text}"
                        break

            chunk_full = merged_text.strip()
            # Excerpt must be an exact contiguous prefix substring of chunkText, with at most one trailing ellipsis
            max_excerpt_len = 800
            if len(chunk_full) > max_excerpt_len:
                text_excerpt = chunk_full[:max_excerpt_len].rstrip() + "..."
            else:
                text_excerpt = chunk_full

            source_item = SourceItem(
                id=chunk.get("id", "source-1"),
                documentTitle=chunk.get("documentTitle", "Official Document"),
                officialTitle=chunk.get("officialTitle") or chunk.get("documentTitle", "Official Document"),
                section=chunk.get("section", "General Rule"),
                page=chunk.get("page", 1),
                chunkText=chunk_full,
                excerpt=text_excerpt,
                score=round(float(score), 4),
                sourceUrl=chunk.get("sourceUrl"),
                jurisdiction=chunk.get("jurisdiction", "Central"),
                effectiveDate=chunk.get("effectiveDate", "2019-09-01"),
                documentType=chunk.get("documentType", "Act"),
                notificationNumber=chunk.get("notificationNumber"),
                sha256=chunk.get("sha256"),
                verified=bool(chunk.get("verified", False)),
                verifiedBy=chunk.get("verifiedBy"),
                verifiedAt=str(chunk.get("verifiedAt")) if chunk.get("verifiedAt") else None,
                lastReviewedAt=str(chunk.get("lastReviewedAt")) if chunk.get("lastReviewedAt") else None,
                supersededBy=chunk.get("supersededBy"),
                amends=chunk.get("amends"),
                isTestData=bool(chunk.get("isTestData", False))
            )
            sources.append(source_item)

            if len(sources) >= self.top_k:
                break

        # Preference for later amendments: if two active chunks state provisions for same section,
        # prefer the chunk with later effectiveDate and tag amendedBy
        seen_sections: dict[str, SourceItem] = {}
        deduped_sources: list[SourceItem] = []
        for s in sources:
            norm_sec = s.section.lower().strip()
            if norm_sec in seen_sections:
                prev = seen_sections[norm_sec]
                # Compare effective dates
                if (s.effectiveDate or "") > (prev.effectiveDate or ""):
                    # Replace prev with newer s, note amendedBy
                    s.amends = prev.id
                    seen_sections[norm_sec] = s
                    idx = deduped_sources.index(prev)
                    deduped_sources[idx] = s
                else:
                    prev.amends = s.id
            else:
                seen_sections[norm_sec] = s
                deduped_sources.append(s)
        sources = deduped_sources

        # 9. Classify Confidence Tier using Answerability Evidence Gate
        top_dense = dense_results[0][1] if dense_results else 0.0
        top_chunk = dense_results[0][0] if dense_results else {}
        top_bm25 = chunk_scores.get(top_chunk.get("id"), {}).get("bm25", 0.0)

        is_answerable = check_answerability_gate(cleaned_query, top_chunk, float(top_dense), float(top_bm25))

        if not is_answerable:
            confidence_tier = "LOW"
            is_grounded = False
        elif top_score >= self.high_threshold:
            confidence_tier = "HIGH"
            is_grounded = True
        elif top_score >= self.medium_threshold:
            confidence_tier = "MEDIUM"
            is_grounded = True
        else:
            confidence_tier = "LOW"
            is_grounded = False

        related_questions = generate_related_questions(sources, cleaned_query)
        closest_topics = get_closest_topics(cleaned_query)

        return RetrievalResult(
            sources=sources,
            top_score=round(top_score, 4),
            confidence_tier=confidence_tier,
            is_grounded=is_grounded,
            did_you_mean=did_you_mean,
            related_questions=related_questions,
            closest_topics=closest_topics,
            subqueries=subqueries if len(subqueries) > 1 else []
        )

retriever = LegalRetriever()
