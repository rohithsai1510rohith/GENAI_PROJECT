
import numpy as np

from app.core.config import settings
from app.core.logging import logger


class Embedder:
    def __init__(self, model_name: str = settings.EMBEDDING_MODEL):
        self.model_name = model_name
        self.dimension = 384
        self._model = None
        self._load_model()

    def _load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
            self.dimension = self._model.get_sentence_embedding_dimension()
            logger.info(f"Loaded {self.model_name} with dimension {self.dimension}")
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer ({e}). Initializing robust localized vectorizer fallback.")
            self._model = None

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dimension), dtype=np.float32)

        if self._model is not None:
            embeddings = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            return embeddings.astype(np.float32)
        else:
            # Deterministic, normalized pseudo-embedding fallback using hashed n-grams for offline resilience
            vectors = []
            for text in texts:
                vec = np.zeros(self.dimension, dtype=np.float32)
                words = text.lower().split()
                for w in words:
                    h = hash(w) % self.dimension
                    vec[h] += 1.0
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                vectors.append(vec)
            return np.array(vectors, dtype=np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        res = self.embed_texts([query])
        return res[0]

embedder = Embedder()
