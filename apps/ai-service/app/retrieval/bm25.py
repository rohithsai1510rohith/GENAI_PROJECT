import math
import re
from typing import Any


class BM25Index:
    """
    Lightweight, self-contained BM25Okapi search engine
    optimized for legal document chunks.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size = 0
        self.avg_doc_len = 0.0
        self.doc_lengths: list[int] = []
        self.doc_freqs: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.doc_term_freqs: list[dict[str, int]] = []
        self.chunks: list[dict[str, Any]] = []

    @staticmethod
    def tokenize(text: str) -> list[str]:
        # Lowercase and extract alphanumeric words
        return re.findall(r'[a-zA-Z0-9]+', text.lower())

    def index_chunks(self, chunks: list[dict[str, Any]]):
        self.chunks = chunks
        self.corpus_size = len(chunks)
        if self.corpus_size == 0:
            return

        self.doc_term_freqs = []
        self.doc_lengths = []
        self.doc_freqs = {}
        total_len = 0

        for chunk in chunks:
            text = f"{chunk.get('documentTitle', '')} {chunk.get('section', '')} {chunk.get('text', '')}"
            tokens = self.tokenize(text)
            self.doc_lengths.append(len(tokens))
            total_len += len(tokens)

            tf: dict[str, int] = {}
            for token in tokens:
                tf[token] = tf.get(token, 0) + 1
            self.doc_term_freqs.append(tf)

            for token in tf:
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

        self.avg_doc_len = total_len / self.corpus_size if self.corpus_size > 0 else 0.0

        # Precompute IDF values
        self.idf = {}
        for token, df in self.doc_freqs.items():
            # Standard Lucene/BM25 IDF formula
            self.idf[token] = math.log(1.0 + (self.corpus_size - df + 0.5) / (df + 0.5))

    def search(self, query: str, top_k: int = 5) -> list[tuple[dict[str, Any], float]]:
        if self.corpus_size == 0:
            return []

        tokens = self.tokenize(query)
        if not tokens:
            return []

        scores: list[float] = [0.0] * self.corpus_size

        for token in tokens:
            if token not in self.idf:
                continue
            idf_val = self.idf[token]
            for idx, tf_dict in enumerate(self.doc_term_freqs):
                tf = tf_dict.get(token, 0)
                if tf > 0:
                    doc_len = self.doc_lengths[idx]
                    numerator = tf * (self.k1 + 1.0)
                    denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                    scores[idx] += idf_val * (numerator / denominator)

        # Normalize BM25 scores between 0.0 and 1.0
        max_score = max(scores) if scores else 0.0
        if max_score > 0:
            normalized_scores = [s / max_score for s in scores]
        else:
            normalized_scores = scores

        # Sort top-k
        scored_pairs = list(enumerate(normalized_scores))
        scored_pairs.sort(key=lambda x: x[1], reverse=True)

        results = []
        for idx, score in scored_pairs[:top_k]:
            if score > 0.001:
                results.append((self.chunks[idx], float(score)))

        return results

bm25_index = BM25Index()
