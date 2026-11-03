import re
from pathlib import Path
from typing import Any

from app.core.logging import logger

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


class PdfLoader:
    """
    Extracts text from PDF documents using PyMuPDF (fitz) with pypdf fallback.
    Preserves page numbers (1-indexed), cleans headers/footers, and un-hyphenates linebreaks.
    """

    @staticmethod
    def _clean_text(raw_text: str) -> str:
        if not raw_text:
            return ""

        # 1. Un-hyphenate words broken across linebreaks (e.g., "regula-\ntion" -> "regulation")
        text = re.sub(r'(\b\w+)-\s*\n\s*(\w+\b)', r'\1\2', raw_text)

        # 2. Remove common header/footer page counter patterns
        text = re.sub(r'(?i)^\s*(?:page\s+\d+(?:\s+of\s+\d+)?|-+\s*page\s+\d+\s*-+)\s*$', '', text, flags=re.MULTILINE)

        # 3. Normalize multiple carriage returns and excessive whitespace
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text.strip()

    @classmethod
    def load(cls, file_path: Path) -> dict[str, Any]:
        pages_data: list[dict[str, Any]] = []
        full_text_parts: list[str] = []

        if HAS_PYMUPDF:
            try:
                doc = fitz.open(str(file_path))
                for idx, page in enumerate(doc):
                    raw_page_text = page.get_text() or ""
                    cleaned = cls._clean_text(raw_page_text)
                    pages_data.append({"page_number": idx + 1, "text": cleaned})
                    if cleaned:
                        full_text_parts.append(cleaned)
                doc.close()
                logger.info(f"Loaded {len(pages_data)} pages from {file_path.name} via PyMuPDF")
            except Exception as e:
                logger.warning(f"PyMuPDF load failed for {file_path.name}: {e}. Trying fallback.")
                return cls._load_with_pypdf(file_path)
        elif HAS_PYPDF:
            return cls._load_with_pypdf(file_path)
        else:
            raise RuntimeError("Neither PyMuPDF nor pypdf is installed for PDF extraction.")

        full_text = "\n\n".join(full_text_parts).strip()
        if not full_text:
            raise ValueError("OCR is not supported in V1. Uploaded document contains no extractable text.")

        return {
            "source": str(file_path),
            "filename": file_path.name,
            "text": full_text,
            "pages": pages_data
        }

    @classmethod
    def _load_with_pypdf(cls, file_path: Path) -> dict[str, Any]:
        if not HAS_PYPDF:
            raise RuntimeError("pypdf is not installed.")

        pages_data: list[dict[str, Any]] = []
        full_text_parts: list[str] = []

        reader = pypdf.PdfReader(str(file_path))
        for idx, page in enumerate(reader.pages):
            raw_text = page.extract_text() or ""
            cleaned = cls._clean_text(raw_text)
            pages_data.append({"page_number": idx + 1, "text": cleaned})
            if cleaned:
                full_text_parts.append(cleaned)

        full_text = "\n\n".join(full_text_parts).strip()
        if not full_text:
            raise ValueError("OCR is not supported in V1. Uploaded document contains no extractable text.")

        logger.info(f"Loaded {len(pages_data)} pages from {file_path.name} via pypdf fallback")
        return {
            "source": str(file_path),
            "filename": file_path.name,
            "text": full_text,
            "pages": pages_data
        }
