import re
from pathlib import Path
from typing import Any


class TxtLoader:
    """
    Loads plain text and Markdown legal documents.
    Normalizes whitespace and un-hyphenates linebreaks while preserving paragraph structure.
    """

    @staticmethod
    def _clean_text(raw_text: str) -> str:
        if not raw_text:
            return ""
        # Un-hyphenate words broken across linebreaks
        text = re.sub(r'(\b\w+)-\s*\n\s*(\w+\b)', r'\1\2', raw_text)
        # Normalize line endings
        text = re.sub(r'\r\n', '\n', text)
        return text.strip()

    @classmethod
    def load(cls, file_path: Path) -> dict[str, Any]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text = f.read()

        cleaned_text = cls._clean_text(raw_text)
        return {
            "source": str(file_path),
            "filename": file_path.name,
            "text": cleaned_text,
            "pages": [{"page_number": 1, "text": cleaned_text}]
        }
