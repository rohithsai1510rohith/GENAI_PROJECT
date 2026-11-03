import sys, json, re
from pathlib import Path
sys.path.insert(0, "apps/ai-service")
from app.retrieval.nlp_utils import correct_spelling_and_expand, COMMON_STOPWORDS
from app.retrieval.bm25 import bm25_index
from app.vectorstore.faiss_store import vector_store
from app.embeddings.embedder import embedder

def get_substantive_tokens(text):
    words = re.findall(r'[a-zA-Z0-9]+', text.lower())
    return [w for w in words if w not in COMMON_STOPWORDS and len(w) > 2]

with open("tests/eval/calibration.jsonl", "r", encoding="utf-8") as f:
    cases = [json.loads(line) for line in f if line.strip()]

out_scope = [c for c in cases if c["category"] == "out_of_scope"]
scores = []
for c in out_scope:
    q = c["question"]
    exp, syns, _ = correct_spelling_and_expand(q)
    dvec = embedder.embed_query(exp)
    dres = vector_store.search(dvec, top_k=5)
    syn_str = " ".join(syns)
    bres = bm25_index.search(f"{q} {syn_str}", top_k=5)
    bdict = {chunk["id"]: score for chunk, score in bres}
    top_chunk, top_d = dres[0]
    top_b = bdict.get(top_chunk["id"], 0.0)
    q_tokens = set(get_substantive_tokens(q))
    c_tokens = set(get_substantive_tokens(top_chunk.get("text", "")))
    overlap = q_tokens.intersection(c_tokens)
    scores.append(top_d)
    print(f"ID: {c['id']} | Dense: {top_d:.3f} | BM25: {top_b:.3f} | Overlap: {len(overlap)} {list(overlap)[:3]}")

print("\nOut-of-scope stats:")
print(f"Min: {min(scores):.3f}, Max: {max(scores):.3f}, Median: {sorted(scores)[len(scores)//2]:.3f}")
print(f"Scores >= 0.52: {sum(1 for s in scores if s >= 0.52)} / {len(scores)}")
print(f"Scores >= 0.60: {sum(1 for s in scores if s >= 0.60)} / {len(scores)}")
