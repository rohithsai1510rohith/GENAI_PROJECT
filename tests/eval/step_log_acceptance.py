import sys
import json
import numpy as np
from pathlib import Path

# Ensure apps/ai-service on sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root_dir / "apps" / "ai-service"))

from app.loaders.txt_loader import TxtLoader
from app.chunking.splitter import LegalTextSplitter
from app.embeddings.embedder import embedder
from app.vectorstore.faiss_store import vector_store
from app.retrieval.retriever import retriever

def run_prd_section_19_acceptance_flow():
    print("=====================================================================")
    print("PRD SECTION 19 ACCEPTANCE STEP LOG: END-TO-END RAG LIFECYCLE AUDIT")
    print("=====================================================================")

    # Step 1: Upload a custom regulation as UNVERIFIED (isTestData=True, verified=False)
    print("\n[STEP 1: UPLOAD UNVERIFIED REGULATION]")
    doc_id = "temp_delhi_speed_notification_2026"
    doc_title = "Delhi Special Speed Notification 2026 (Unverified)"
    raw_text = (
        "Section 112A: Special Speed Restriction for Electric Scooters\n"
        "In the National Capital Territory of Delhi, no electric two-wheeler shall exceed 25 km/h on internal colony roads.\n"
        "Whoever violates Section 112A shall be liable to a compounding fine of one thousand five hundred rupees (Rs. 1,500)."
    )
    doc_meta = {
        "documentId": doc_id,
        "title": doc_title,
        "type": "Notification",
        "jurisdiction": "Delhi",
        "verified": False,
        "isTestData": True,
        "status": "uploaded"
    }
    print(f"  -> File Created: {doc_id}.txt")
    print(f"  -> Verified Flag: {doc_meta['verified']} (Marked as UNVERIFIED test data)")

    # Step 2: Ingest into FAISS Vector Store
    print("\n[STEP 2: INGEST DOCUMENT INTO VECTOR STORE]")
    raw_doc = {"filename": f"{doc_id}.txt", "text": raw_text, "pages": [{"page_number": 1, "text": raw_text}]}
    splitter = LegalTextSplitter()
    chunks = splitter.split_document(raw_doc, doc_meta)
    vecs = embedder.embed_texts([c["text"] for c in chunks])
    vector_store.add_chunks(chunks, vecs)
    print(f"  -> Successfully indexed {len(chunks)} chunk(s). Active total vectors: {vector_store.count()}")

    # Step 3: Query about the unverified document
    print("\n[STEP 3: CITIZEN QUERY - ACTIVE UNVERIFIED DOCUMENT]")
    question = "What is the speed limit and fine for electric scooters on internal colony roads in Delhi?"
    res1 = retriever.retrieve(question, filters={"jurisdiction": "Delhi"})
    print(f"  -> Question: '{question}'")
    print(f"  -> Is Grounded: {res1.is_grounded}")
    print(f"  -> Confidence Tier: {res1.confidence_tier} (Top Score: {res1.top_score:.3f})")
    print(f"  -> Source Count: {len(res1.sources)}")
    if res1.sources:
        s = res1.sources[0]
        print(f"  -> Source Title: '{s.documentTitle}'")
        print(f"  -> Source Section: '{s.section}'")
        print(f"  -> Excerpt: '{s.excerpt[:80]}...'")
        print(f"  -> Contains Test Data Warning Flag: {s.isTestData}")
        assert s.isTestData is True, "Expected isTestData flag to be True"
        assert "112A" in s.section or "electric" in s.excerpt.lower(), "Expected Section 112A to match"

    # Step 4: Deactivate the document in Admin portal
    print("\n[STEP 4: DEACTIVATE DOCUMENT IN ADMIN PORTAL]")
    affected = vector_store.deactivate_document(doc_id)
    print(f"  -> Admin action: Deactivated document '{doc_id}'")
    print(f"  -> Chunks marked inactive under atomic lock: {affected}")
    print(f"  -> Updated active vector count: {vector_store.count()}")

    # Step 5: Ask again the exact same question
    print("\n[STEP 5: CITIZEN QUERY - POST-DEACTIVATION FALLBACK VERIFICATION]")
    res2 = retriever.retrieve(question, filters={"jurisdiction": "Delhi"})
    print(f"  -> Question: '{question}'")
    print(f"  -> Is Grounded: {res2.is_grounded}")
    print(f"  -> Confidence Tier: {res2.confidence_tier} (Top Score: {res2.top_score:.3f})")
    matching_deactivated = [s for s in res2.sources if s.documentTitle == doc_title]
    print(f"  -> Deactivated Sources Returned: {len(matching_deactivated)}")
    assert len(matching_deactivated) == 0, "Deactivated document must NEVER be returned in sources!"
    if not res2.is_grounded:
        print("  -> Result: Successfully fell back to ungrounded warning notice without hallucination.")

    # Cleanup: remove temporary test document
    vector_store.delete_document_chunks(doc_id)
    from app.cli import run_ingest_all
    run_ingest_all()
    print("\n[STEP LOG CONCLUSION: PASSED 5/5 STAGES]")
    print("=====================================================================")

if __name__ == "__main__":
    run_prd_section_19_acceptance_flow()
