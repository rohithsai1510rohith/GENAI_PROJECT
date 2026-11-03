import sys
import json
import re
from pathlib import Path

current_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(current_dir / "apps" / "ai-service"))

from app.retrieval.retriever import retriever
from app.vectorstore.faiss_store import vector_store
from app.embeddings.embedder import embedder
from app.retrieval.bm25 import bm25_index
from app.retrieval.nlp_utils import correct_spelling_and_expand, COMMON_STOPWORDS

def get_substantive_tokens(text: str):
    words = re.findall(r'[a-zA-Z0-9]+', text.lower())
    return [w for w in words if w not in COMMON_STOPWORDS and len(w) > 2]

def run_gate_comparison():
    cal_file = Path(__file__).parent / "calibration.jsonl"
    with open(cal_file, "r", encoding="utf-8") as f:
        cases = [json.loads(line) for line in f if line.strip()]

    in_scope = [c for c in cases if c["category"] == "in_scope"]
    out_scope = [c for c in cases if c["category"] == "out_of_scope"]

    print(f"Calibration Set: {len(cases)} total ({len(in_scope)} in-scope, {len(out_scope)} out-of-scope)")
    print(f"Total vector chunks in index: {vector_store.count()}\n")

    # Define candidate gating functions
    # Each gate returns True if answerable/grounded, False otherwise.

    # Candidate 1: Pure Dense Vector Score (cosine similarity)
    def gate_dense_035(query, chunk, dense_score, bm25_score, top_s):
        return dense_score >= 0.35

    def gate_dense_045(query, chunk, dense_score, bm25_score, top_s):
        return dense_score >= 0.45

    def gate_dense_052(query, chunk, dense_score, bm25_score, top_s):
        return dense_score >= 0.52

    # Candidate 2: Lexical BM25 Score Threshold
    def gate_bm25_positive(query, chunk, dense_score, bm25_score, top_s):
        return bm25_score > 0.0 and dense_score >= 0.35

    def gate_bm25_30(query, chunk, dense_score, bm25_score, top_s):
        return bm25_score >= 3.0 and dense_score >= 0.35

    # Candidate 3: Substantive Term Overlap
    def gate_term_overlap(query, chunk, dense_score, bm25_score, top_s):
        q_tokens = set(get_substantive_tokens(query))
        chunk_tokens = set(get_substantive_tokens(chunk.get("text", "")))
        overlap = q_tokens.intersection(chunk_tokens)
        return len(overlap) >= 2 and dense_score >= 0.35

    # Candidate 4: Key Legal Grounding Gate
    # Requires:
    # 1) Dense score >= 0.40
    # 2) EITHER exact statutory section mention in query matching chunk section
    #    OR (BM25 >= 3.0 AND substantive term overlap >= 2)
    def gate_legal_evidence(query, chunk, dense_score, bm25_score, top_s):
        if dense_score < 0.38:
            return False
        # Check explicit section / rule match
        q_lower = query.lower()
        chunk_sec = (chunk.get("section") or "").lower()
        sec_match = re.search(r'(section|sec\.?|rule)\s+([0-9]+[a-z]*)', q_lower)
        if sec_match:
            ref = sec_match.group(0)
            if ref in chunk_sec or ref in chunk.get("text", "").lower():
                return True
        
        # Substantive term overlap
        q_tokens = set(get_substantive_tokens(query))
        chunk_tokens = set(get_substantive_tokens(chunk.get("text", "")))
        overlap = q_tokens.intersection(chunk_tokens)
        
        # Grounding requires lexical overlap with BM25 support
        if len(overlap) >= 2 and bm25_score >= 2.0:
            return True
        if len(overlap) >= 3 and dense_score >= 0.45:
            return True
        return False

    candidates = {
        "1. Dense Vector (cosine >= 0.35)": gate_dense_035,
        "2. Dense Vector (cosine >= 0.45)": gate_dense_045,
        "3. Dense Vector (cosine >= 0.52)": gate_dense_052,
        "4. BM25 Lexical Score (BM25 > 0 & Dense >= 0.35)": gate_bm25_positive,
        "5. BM25 Lexical Score (BM25 >= 3.0 & Dense >= 0.35)": gate_bm25_30,
        "6. Substantive Term Overlap (>= 2 terms & Dense >= 0.35)": gate_term_overlap,
        "7. Grounded Legal Evidence Gate (Candidate 4)": gate_legal_evidence
    }

    results = {}

    for name, gate_fn in candidates.items():
        fp = 0  # Out-of-scope falsely marked answerable
        fn = 0  # In-scope falsely marked unanswerable
        tp = 0
        tn = 0

        for case in cases:
            q = case["question"]
            cat = case["category"]
            
            # Retrieve raw top candidates without regex pre-filters
            expanded_query, synonyms, _ = correct_spelling_and_expand(q)
            dense_vec = embedder.embed_query(expanded_query)
            dense_results = vector_store.search(dense_vec, top_k=5)
            bm25_results = bm25_index.search(f"{q} {' '.join(synonyms)}", top_k=5)

            bm25_dict = {c["id"]: score for c, score in bm25_results}
            
            if not dense_results:
                is_grounded = False
            else:
                top_chunk, top_dense = dense_results[0]
                top_bm25 = bm25_dict.get(top_chunk["id"], 0.0)
                is_grounded = gate_fn(q, top_chunk, float(top_dense), float(top_bm25), float(top_dense))

            if cat == "in_scope":
                if is_grounded:
                    tp += 1
                else:
                    fn += 1
            else:
                if is_grounded:
                    fp += 1
                else:
                    tn += 1

        fpr = (fp / len(out_scope)) * 100.0
        fnr = (fn / len(in_scope)) * 100.0
        acc = ((tp + tn) / len(cases)) * 100.0

        results[name] = {
            "TP": tp, "FP": fp, "TN": tn, "FN": fn,
            "FPR": fpr, "FNR": fnr, "Accuracy": acc
        }

    print(f"{'Gate Candidate':<50} | {'FPR (FP/Out)':<15} | {'FNR (FN/In)':<15} | {'Overall Acc':<12}")
    print("-" * 100)
    for name, m in results.items():
        print(f"{name:<50} | {m['FPR']:5.1f}% ({m['FP']}/{len(out_scope)})  | {m['FNR']:5.1f}% ({m['FN']}/{len(in_scope)})  | {m['Accuracy']:5.1f}%")

if __name__ == "__main__":
    run_gate_comparison()
