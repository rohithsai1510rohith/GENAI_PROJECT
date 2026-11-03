import json
import os
import threading
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.retrieval.bm25 import bm25_index

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False
import time


def _safe_replace(src: Path, dst: Path, max_retries: int = 8):
    for i in range(max_retries):
        try:
            os.replace(str(src), str(dst))
            return
        except PermissionError:
            if i == max_retries - 1:
                raise
            time.sleep(0.025)

def _safe_unlink(p: Path, max_retries: int = 8):
    if not p.exists():
        return
    for i in range(max_retries):
        try:
            p.unlink()
            return
        except PermissionError:
            if i == max_retries - 1:
                raise
            time.sleep(0.025)

class FAISSVectorStore:
    def __init__(self, dimension: int = 384, index_dir: Path = settings.INDEX_DIR):
        self.dimension = dimension
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.index_dir / "index.faiss"
        self.metadata_file = self.index_dir / "metadata.json"

        # Concurrency 1 single-writer reentrant lock
        self._write_lock = threading.RLock()

        self.metadata: list[dict[str, Any]] = []
        self.index = None
        self.vectors_np: np.ndarray = np.empty((0, self.dimension), dtype=np.float32)

        self._init_index()
        self.load()

    def _init_index(self):
        if HAS_FAISS:
            self.index = faiss.IndexFlatIP(self.dimension)
        else:
            self.vectors_np = np.empty((0, self.dimension), dtype=np.float32)

    def add_chunks(self, chunks: list[dict[str, Any]], embeddings: np.ndarray):
        """Single-writer addition with atomic persistence."""
        if len(chunks) == 0:
            return

        with self._write_lock:
            if HAS_FAISS:
                self.index.add(embeddings)
            else:
                if self.vectors_np.shape[0] == 0:
                    self.vectors_np = embeddings
                else:
                    self.vectors_np = np.vstack([self.vectors_np, embeddings])

            self.metadata.extend(chunks)
            self._atomic_save()
            bm25_index.index_chunks(self.metadata)
            logger.info(f"Added {len(chunks)} chunks to vector store. Total active/indexed: {len(self.metadata)}")

    def search(self, query_vector: np.ndarray, top_k: int = 5) -> list[tuple[dict[str, Any], float]]:
        """Safe thread-safe query reading (never blocked by partial index writes)."""
        if len(self.metadata) == 0:
            return []

        query_vec = np.ascontiguousarray([query_vector], dtype=np.float32)

        if HAS_FAISS:
            scores, indices = self.index.search(query_vec, min(top_k, len(self.metadata)))
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx != -1 and idx < len(self.metadata):
                    chunk = self.metadata[idx]
                    # Immediately skip inactive or deactivated documents
                    if chunk.get("status") == "inactive" or chunk.get("isActive") is False or chunk.get("deactivated", False):
                        continue
                    results.append((chunk, float(score)))
            return results
        else:
            sims = np.dot(self.vectors_np, query_vector)
            top_indices = np.argsort(sims)[::-1][:top_k]
            results = []
            for idx in top_indices:
                if idx < len(self.metadata):
                    chunk = self.metadata[idx]
                    if chunk.get("status") == "inactive" or chunk.get("isActive") is False or chunk.get("deactivated", False):
                        continue
                    results.append((chunk, float(sims[idx])))
            return results

    def _atomic_save(self):
        """Atomic index update: build to temp files, then atomically rename under lock."""
        self.index_dir.mkdir(parents=True, exist_ok=True)
        tmp_meta = self.index_dir / "metadata.json.tmp"
        tmp_faiss = self.index_dir / "index.faiss.tmp"
        tmp_npy = self.index_dir / "vectors.npy.tmp"

        # 1. Write metadata temp
        with open(tmp_meta, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=2, ensure_ascii=False)

        # 2. Write index temp
        if HAS_FAISS and self.index is not None:
            faiss.write_index(self.index, str(tmp_faiss))
            # Atomic swap
            _safe_replace(tmp_meta, self.metadata_file)
            _safe_replace(tmp_faiss, self.index_file)
        else:
            np.save(str(tmp_npy), self.vectors_np)
            _safe_replace(tmp_meta, self.metadata_file)
            _safe_replace(tmp_npy, self.index_dir / "vectors.npy")

    def save(self):
        with self._write_lock:
            self._atomic_save()

    def load(self):
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)

                if HAS_FAISS and self.index_file.exists():
                    self.index = faiss.read_index(str(self.index_file))
                    logger.info(f"Loaded FAISS index with {self.index.ntotal} vectors from {self.index_file}")
                elif (self.index_dir / "vectors.npy").exists():
                    self.vectors_np = np.load(str(self.index_dir / "vectors.npy"))
                    logger.info(f"Loaded NumPy vector index with {self.vectors_np.shape[0]} vectors")

                bm25_index.index_chunks(self.metadata)
                logger.info(f"Loaded BM25 keyword index with {len(self.metadata)} chunks")
            except Exception as e:
                logger.error(f"Error loading index: {e}. Reinitializing clean index.")
                self.metadata = []
                self._init_index()

    def deactivate_document(self, document_id: str) -> int:
        """Immediately marks all chunks of document as inactive and saves atomically."""
        with self._write_lock:
            count = 0
            stem_id = document_id.removeprefix("doc_")
            for c in self.metadata:
                if c.get("documentId") in (document_id, stem_id) or c.get("id") in (document_id, stem_id):
                    c["status"] = "inactive"
                    c["isActive"] = False
                    c["deactivated"] = True
                    count += 1
            if count > 0:
                self._atomic_save()
                bm25_index.index_chunks(self.metadata)
            logger.info(f"Deactivated document {document_id} ({count} chunks)")
            return count

    def reactivate_document(self, document_id: str) -> int:
        """Re-activates all chunks of document and saves atomically."""
        with self._write_lock:
            count = 0
            stem_id = document_id.removeprefix("doc_")
            for c in self.metadata:
                if c.get("documentId") in (document_id, stem_id) or c.get("id") in (document_id, stem_id):
                    c["status"] = "indexed"
                    c["isActive"] = True
                    c["deactivated"] = False
                    count += 1
            if count > 0:
                self._atomic_save()
                bm25_index.index_chunks(self.metadata)
            logger.info(f"Re-activated document {document_id} ({count} chunks)")
            return count

    def delete_document_chunks(self, document_id: str):
        """Removes chunks belonging to document and atomic swaps new index."""
        with self._write_lock:
            stem_id = document_id.removeprefix("doc_")
            initial_count = len(self.metadata)
            active_chunks = [
                c for c in self.metadata
                if c.get("documentId") not in (document_id, stem_id) and c.get("id") not in (document_id, stem_id)
            ]
            deleted_count = initial_count - len(active_chunks)
            self.metadata = active_chunks
            self._init_index()
            # If vectors can be reconstructed from embedder or remaining chunks
            from app.embeddings.embedder import embedder
            if active_chunks:
                texts = [c["text"] for c in active_chunks]
                embeddings = embedder.embed_texts(texts)
                if HAS_FAISS:
                    self.index.add(embeddings)
                else:
                    self.vectors_np = embeddings
            self._atomic_save()
            bm25_index.index_chunks(self.metadata)
            logger.info(f"Deleted chunks for document {document_id}. Remaining: {len(self.metadata)}")
            return deleted_count

    def atomic_swap_rebuild(self, chunks: list[dict[str, Any]], embeddings: np.ndarray):
        """Rebuilds into shadow index and swaps under lock."""
        with self._write_lock:
            self._init_index()
            self.metadata = chunks
            if chunks and embeddings is not None and len(chunks) > 0:
                if HAS_FAISS:
                    self.index.add(embeddings)
                else:
                    self.vectors_np = embeddings
            self._atomic_save()
            bm25_index.index_chunks(self.metadata)
            logger.info(f"Atomic swapped index with {len(self.metadata)} total active chunks")

    def clear(self):
        with self._write_lock:
            self.metadata = []
            self._init_index()
            bm25_index.index_chunks([])
            _safe_unlink(self.index_file)
            _safe_unlink(self.metadata_file)
            _safe_unlink(self.index_dir / "vectors.npy")

    def rebuild_from_scratch(self, chunks: list[dict[str, Any]], embeddings: np.ndarray):
        with self._write_lock:
            self.clear()
            if chunks and len(chunks) > 0 and embeddings is not None and embeddings.shape[0] > 0:
                if HAS_FAISS:
                    self.index.add(embeddings)
                else:
                    self.vectors_np = embeddings
                self.metadata = chunks
                self._atomic_save()
                bm25_index.index_chunks(self.metadata)
            else:
                self._atomic_save()

    def has_test_data(self) -> bool:
        """Returns True if any ACTIVE indexed chunk is tagged as test data."""
        return any(
            c.get("isTestData", False) for c in self.metadata
            if c.get("status") != "inactive" and c.get("isActive") is not False
        )

    def count(self) -> int:
        return len([
            c for c in self.metadata
            if c.get("status") != "inactive" and c.get("isActive") is not False
        ])

vector_store = FAISSVectorStore()
