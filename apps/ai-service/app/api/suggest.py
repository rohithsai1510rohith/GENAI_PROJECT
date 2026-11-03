import re

from fastapi import APIRouter, Query

from app.retrieval.nlp_utils import correct_spelling_and_expand
from app.vectorstore.faiss_store import vector_store

router = APIRouter(prefix="/rag", tags=["Suggestions"])

@router.get("/suggest")
async def get_suggestions(q: str = Query(..., min_length=2)):
    """
    Returns live matching topics, violations, and questions
    built dynamically from indexed document sections and headings.
    Never hard-codes fine amounts.
    """
    query_clean = q.strip().lower()
    expanded_query, _synonyms, _ = correct_spelling_and_expand(query_clean)
    all_tokens = set(re.findall(r'[a-zA-Z0-9]+', f"{query_clean} {expanded_query}"))

    # Extract distinct sections and document titles from indexed metadata
    seen_sections = set()
    suggestions = []

    for chunk in vector_store.metadata:
        section = chunk.get("section", "").strip()
        doc_title = chunk.get("documentTitle", "").strip()
        if not section or section in seen_sections:
            continue

        section_lower = section.lower()
        chunk_text_lower = chunk.get("text", "")[:200].lower()

        # Check if query matches section name or chunk text tokens
        match_score = 0
        for token in all_tokens:
            if len(token) >= 3:
                if token in section_lower:
                    match_score += 3
                elif token in chunk_text_lower:
                    match_score += 1

        if match_score > 0:
            seen_sections.add(section)

            # Formulate user-friendly query text derived from section heading
            clean_sec_title = re.sub(r'^(Section\s+\d+[A-Z]?[:\s]*|Rule\s+\d+[A-Z]?[:\s]*|PART\s+[I|V|X]+[:\s]*)', '', section, flags=re.IGNORECASE).strip()
            if not clean_sec_title:
                clean_sec_title = section

            suggestions.append({
                "text": f"{clean_sec_title} ({section.split(':')[0].strip()})",
                "category": doc_title,
                "section": section,
                "score": match_score
            })

    # Sort by relevance score
    suggestions.sort(key=lambda x: x["score"], reverse=True)

    # If few or no matches, provide dynamic fallback suggestions from top indexed sections
    if len(suggestions) < 3 and vector_store.count() > 0:
        for chunk in vector_store.metadata[:6]:
            sec = chunk.get("section", "")
            if sec and sec not in seen_sections:
                seen_sections.add(sec)
                clean_sec_title = re.sub(r'^(Section\s+\d+[A-Z]?[:\s]*|Rule\s+\d+[A-Z]?[:\s]*)', '', sec, flags=re.IGNORECASE).strip()
                suggestions.append({
                    "text": clean_sec_title or sec,
                    "category": chunk.get("documentTitle", "Traffic Act"),
                    "section": sec,
                    "score": 0
                })
            if len(suggestions) >= 4:
                break

    return {
        "query": q,
        "suggestions": suggestions[:6]
    }
