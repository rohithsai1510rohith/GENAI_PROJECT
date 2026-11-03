import argparse
import asyncio
import sys
from pathlib import Path

# Ensure stdout handles UTF-8 on Windows cp1252 consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add apps/ai-service to sys.path
current_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(current_dir))

from app.api.ingest import process_file_and_index
from app.core.config import settings
from app.generation.groq_client import groq_client
from app.retrieval.retriever import retriever
from app.vectorstore.faiss_store import vector_store


def run_ingest_all():
    print("=" * 70)
    print("[TRAFFIC RULES & FINES ASSISTANT CLI: DOCUMENT INGESTION]")
    print("[NOTICE] Tagging all current documents in data/raw/ as [TEST DATA]")
    print("=" * 70)

    raw_dir = settings.RAW_DATA_DIR
    if not raw_dir.exists():
        print(f"Error: {raw_dir} does not exist.")
        return

    vector_store.clear()
    total_indexed = 0

    files = list(raw_dir.glob("*.txt")) + list(raw_dir.glob("*.pdf"))
    if not files:
        print(f"STOPPED: No documents found in {raw_dir}.")
        print("Per official policy, no legal texts are auto-generated.")
        print("Please place verified official documents (.pdf, .txt) in data/raw/.")
        return

    for file_path in files:
        stem_lower = file_path.stem.lower()
        # All current documents tagged as test data per user directive
        is_test = True
        title = file_path.stem.replace("_", " ").title()

        print(f"Document: {file_path.name}")
        print("  * Status: [TEST DATA - NOT VERIFIED LAW]")
        print(f"  * Format: {file_path.suffix.upper()}")

        meta = {
            "documentId": file_path.stem,
            "title": title,
            "type": "Act" if "act" in stem_lower else "Rules",
            "jurisdiction": "Central",
            "effectiveDate": "2019-09-01",
            "sourceUrl": "https://morth.nic.in",
            "isTestData": is_test
        }
        chunks = process_file_and_index(file_path, meta)
        print(f"  * Chunks Indexed: {chunks}")
        total_indexed += chunks

    print("=" * 70)
    print(f"[SUCCESS] Ingestion Complete. Total vectors indexed: {vector_store.count()}")
    print(f"[STORAGE] Persisted index to: {settings.INDEX_PATH}")
    print(f"[STATUS] Test Data Active in Index: {vector_store.has_test_data()} ([TEST DATA])")
    print("=" * 70)


def run_query(question: str):
    print("\n" + "-" * 70)
    print(f"[QUERY] Question: {question}")
    print("-" * 70)

    # 1. Retrieve
    res = retriever.retrieve(query=question)
    print(f"[RETRIEVAL] Confidence Tier: {res.confidence_tier} | Top Score: {res.top_score}")
    print(f"[GROUNDING] Grounded in Verified Documents: {res.is_grounded}")
    if res.did_you_mean:
        print(f"[SUGGESTION] Did You Mean: {res.did_you_mean}")

    print(f"[SOURCES] Retrieved Sources ({len(res.sources)}):")
    for idx, s in enumerate(res.sources, 1):
        test_badge = " [TEST DATA]" if getattr(s, "isTestData", False) else ""
        print(f"  Source [{idx}]{test_badge}: {s.documentTitle} | {s.section} (Page {s.page}) [Score: {s.score}]")
        print(f"    Excerpt: {s.excerpt[:130]}...")

    # 2. Generate response
    print("\n[ASSISTANT RESPONSE]")
    answer = asyncio.run(groq_client.generate_response(
        question=question,
        sources=res.sources,
        confidence_tier=res.confidence_tier,
        is_grounded=res.is_grounded,
        is_non_traffic=res.is_non_traffic,
        is_gibberish=res.is_gibberish,
        did_you_mean=res.did_you_mean
    ))
    print(answer)

    if res.related_questions:
        print("\n[RELATED QUESTIONS]")
        for rq in res.related_questions[:3]:
            print(f"  - {rq}")

    print("-" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Traffic Assistant RAG CLI")
    parser.add_argument("--ingest", action="store_true", help="Ingest all files in data/raw")
    parser.add_argument("--query", type=str, help="Query the RAG index")
    args = parser.parse_args()

    if args.ingest:
        run_ingest_all()
    elif args.query:
        run_query(args.query)
    else:
        # Default behavior: run ingestion then demo test queries
        run_ingest_all()
        print("\n>>> SAMPLE IN-SCOPE QUERY (Drunk Driving Penalty):")
        run_query("What is the penalty for drunk driving?")

        print("\n>>> SAMPLE OUT-OF-SCOPE QUERY (Non-Traffic Query):")
        run_query("How to bake a chocolate cake?")
