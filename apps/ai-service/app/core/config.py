import os
from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve base workspace directory safely
# In repo: apps/ai-service/app/core/config.py -> 5 levels up to workspace root
_file_path = Path(__file__).resolve()
candidates = [
    _file_path.parents[4] if len(_file_path.parents) >= 5 else None,
    _file_path.parents[3] if len(_file_path.parents) >= 4 else None,
    _file_path.parents[2] if len(_file_path.parents) >= 3 else None,
    _file_path.parent,
    Path.cwd(),
]
BASE_DIR = Path.cwd()
for cand in candidates:
    if cand and (cand / "data").exists():
        BASE_DIR = cand
        break


def _resolve_path(env_val: str, default_rel: str) -> Path:
    if not env_val or env_val.strip() == "":
        return (BASE_DIR / default_rel).resolve()
    p = Path(env_val)
    if p.is_absolute():
        return p
    # Strip any leading '../' or './' so it safely resolves relative to workspace root
    cleaned_parts = [part for part in p.parts if part not in ("..", ".")]
    return (BASE_DIR / Path(*cleaned_parts)).resolve()


class Settings(BaseSettings):
    # Service Port & Security
    PORT: int = int(os.getenv("AI_PORT", "8000"))
    HOST: str = os.getenv("AI_HOST", "0.0.0.0")
    AI_SERVICE_SHARED_SECRET: str = os.getenv("AI_SERVICE_SHARED_SECRET", "super_secret_internal_token_2026")

    # Groq Configuration
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_TEMPERATURE: float = float(os.getenv("GROQ_TEMPERATURE", "0.15"))
    GROQ_MAX_TOKENS: int = int(os.getenv("GROQ_MAX_TOKENS", "1024"))

    # Embeddings & Vector Search
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    TOP_K: int = int(os.getenv("TOP_K", "5"))
    SIM_THRESHOLD: float = float(os.getenv("SIM_THRESHOLD", "0.35"))
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "650"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "120"))
    ALLOW_SAMPLE_DATA: bool = os.getenv("ALLOW_SAMPLE_DATA", "false").lower() in ("true", "1")
    REVIEW_DUE_DAYS: int = int(os.getenv("REVIEW_DUE_DAYS", "180"))

    # Directories (safely normalized to workspace root)
    INDEX_PATH: Path = _resolve_path(os.getenv("INDEX_PATH", os.getenv("INDEX_DIR", "data/index")), "data/index")
    INDEX_DIR: Path = INDEX_PATH
    RAW_DATA_DIR: Path = _resolve_path(os.getenv("RAW_DATA_DIR", "data/raw"), "data/raw")
    PROCESSED_DATA_DIR: Path = _resolve_path(os.getenv("PROCESSED_DATA_DIR", "data/processed"), "data/processed")

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
