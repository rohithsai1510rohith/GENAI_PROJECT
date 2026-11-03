import sys, json, re
from pathlib import Path

current_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(current_dir / "apps" / "ai-service"))

from app.retrieval.nlp_utils import correct_spelling_and_expand, COMMON_STOPWORDS
from app.retrieval.bm25 import bm25_index
from app.vectorstore.faiss_store import vector_store
from app.embeddings.embedder import embedder

def get_substantive_tokens(text):
    words = re.findall(r'[a-zA-Z0-9]+', text.lower())
    # Exclude generic words that appear everywhere
    generic = {"what", "fine", "penalty", "rule", "rules", "traffic", "under", "court", "state", "india", "vehicle", "motor"}
    return [w for w in words if w not in COMMON_STOPWORDS and w not in generic and len(w) > 2]

def legal_evidence_gate(query: str, chunk: dict, dense_score: float, bm25_score: float) -> bool:
    # Rule 1: Direct statutory section/rule reference match
    q_lower = query.lower()
    sec_match = re.search(r'(section|sec\.?|rule)\s+([0-9]+[a-z]*)', q_lower)
    if sec_match:
        ref = sec_match.group(0)
        chunk_sec = (chunk.get("section") or "").lower()
        chunk_text = (chunk.get("text") or "").lower()
        if ref in chunk_sec or ref in chunk_text:
            if dense_score >= 0.38:
                return True

    # Rule 1b: Strong semantic vector alignment (dense >= 0.60)
    if dense_score >= 0.60:
        return True

    # Rule 2: Substantive token overlap
    q_tokens = set(get_substantive_tokens(query))
    c_tokens = set(get_substantive_tokens(chunk.get("text", "")))
    overlap = q_tokens.intersection(c_tokens)

    # Moderate semantic alignment (0.50 - 0.59) requires specific legal token overlap AND BM25 support
    if dense_score >= 0.50 and len(overlap) >= 2 and bm25_score > 0.0:
        return True

    return False

def test():
    with open("tests/eval/calibration.jsonl", "r", encoding="utf-8") as f:
        cases = [json.loads(line) for line in f if line.strip()]

    in_scope = [c for c in cases if c["category"] == "in_scope"]
    out_scope = [c for c in cases if c["category"] == "out_of_scope"]

    tp = fp = tn = fn = 0
    fn_list = []
    fp_list = []

    for c in cases:
        q = c["question"]
        cat = c["category"]
        exp, syns, _ = correct_spelling_and_expand(q)
        dvec = embedder.embed_query(exp)
        dres = vector_store.search(dvec, top_k=5)
        syn_str = " ".join(syns)
        bres = bm25_index.search(f"{q} {syn_str}", top_k=5)
        bdict = {chunk["id"]: score for chunk, score in bres}
        
        top_chunk, top_d = dres[0]
        top_b = bdict.get(top_chunk["id"], 0.0)
        
        grounded = legal_evidence_gate(q, top_chunk, float(top_d), float(top_b))
        
        if cat == "in_scope":
            if grounded:
                tp += 1
            else:
                fn += 1
                fn_list.append((c["id"], q, top_d, top_b))
        else:
            if grounded:
                fp += 1
                fp_list.append((c["id"], q, top_d, top_b))
            else:
                tn += 1

    print("=" * 60)
    print("LEGAL EVIDENCE GATE PERFORMANCE ON CALIBRATION SET")
    print("=" * 60)
    print(f"Total: {len(cases)} (In-Scope: {len(in_scope)}, Out-of-Scope: {len(out_scope)})")
    print(f"TP: {tp}, FP: {fp}, TN: {tn}, FN: {fn}")
    print(f"In-Scope Recall: {tp/len(in_scope)*100:.1f}% ({tp}/{len(in_scope)})")
    print(f"Out-of-Scope Fallback Rate: {tn/len(out_scope)*100:.1f}% ({tn}/{len(out_scope)})")
    print(f"False Positive Rate (FPR): {fp/len(out_scope)*100:.1f}% ({fp}/{len(out_scope)})")
    print(f"False Negative Rate (FNR): {fn/len(in_scope)*100:.1f}% ({fn}/{len(in_scope)})")
    print(f"Overall Accuracy: {(tp+tn)/len(cases)*100:.1f}%")
    if fp_list:
        print(f"\nFalse Positives ({len(fp_list)}):")
        for fpid, fpq, fpd, fpb in fp_list:
            print(f"  [{fpid}] (d={fpd:.2f}, b={fpb:.2f}) {fpq}")
    if fn_list:
        print(f"\nFalse Negatives ({len(fn_list)}):")
        for fnid, fnq, fnd, fnb in fn_list:
            print(f"  [{fnid}] (d={fnd:.2f}, b={fnb:.2f}) {fnq}")

if __name__ == "__main__":
    test()
