import re
from pathlib import Path
from typing import Any


def clean_display_title(stem_or_filename: str) -> str:
    """
    Strips numeric upload prefixes and '_TEST' suffixes from display titles.
    E.g. '1791444730505_sample_traffic_regulations_TEST.pdf' -> 'Sample Traffic Regulations (Test)'
    """
    s = Path(stem_or_filename).stem
    # Strip numeric upload prefix like '1791444730505_' or '123-'
    s = re.sub(r'^\d+[_\-]', '', s)
    # Check if ends with _TEST or -TEST
    is_test = bool(re.search(r'[_\-]TEST$', s, flags=re.IGNORECASE))
    s = re.sub(r'[_\-]TEST$', '', s, flags=re.IGNORECASE)
    # Replace underscores with spaces and format
    s = s.replace("_", " ").strip()
    s = re.sub(r'\s+', ' ', s).title()
    if is_test:
        s = f"{s} (Test)"
    return s


class LegalTextSplitter:
    """
    Recursive legal document text splitter with boundary preference for
    Sections, Rules, Parts, and Clauses.
    Target chunk size: 500 to 800 characters (default 800), overlap 100 to 150 (default 120).
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 120):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_document(self, doc_data: dict[str, Any], metadata: dict[str, Any]) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        pages = doc_data.get("pages", [{"page_number": 1, "text": doc_data.get("text", "")}])

        raw_filename = metadata.get("rawFilename", doc_data.get("filename", "unknown.txt"))
        provided_title = metadata.get("title")
        if provided_title and not provided_title.startswith("179") and "_TEST" not in provided_title:
            doc_title = clean_display_title(provided_title)
        else:
            doc_title = clean_display_title(raw_filename)

        doc_id = metadata.get("documentId", metadata.get("id", Path(raw_filename).stem))
        jurisdiction = metadata.get("jurisdiction", "Central")
        effective_date = metadata.get("effectiveDate", "2019-09-01")
        source_url = metadata.get("sourceUrl", "https://morth.nic.in")
        is_test_data = bool(metadata.get("isTestData", False))
        official_title = metadata.get("officialTitle") or doc_title
        document_type = metadata.get("documentType", metadata.get("type", "Act"))
        notification_number = metadata.get("notificationNumber")
        sha256 = metadata.get("sha256")
        verified = bool(metadata.get("verified", False))
        verified_by = metadata.get("verifiedBy")
        verified_at = metadata.get("verifiedAt")
        last_reviewed_at = metadata.get("lastReviewedAt")
        superseded_by = metadata.get("supersededBy")
        amends = metadata.get("amends")

        current_section = "General Statutory Provision"

        for page in pages:
            page_num = int(page.get("page_number", 1))
            raw_text = page.get("text", "").strip()
            if not raw_text:
                continue

            # Split by double newlines into natural paragraphs
            paragraphs = re.split(r'\n\s*\n', raw_text)

            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue

                # Detect legal heading patterns:
                # "Section 185: Driving by a drunken person..."
                # "Rule 139: Production of licence..."
                # "PART I: MANDATORY DOCUMENTS..."
                sec_match = re.search(
                    r'^(Section\s+\d+[A-Z]?[:\.\s][^\n\.\;]+|Rule\s+\d+[A-Z]?[:\.\s][^\n\.\;]+|PART\s+[I|V|X]+[:\.\s][^\n\.\;]+)',
                    para,
                    re.IGNORECASE
                )
                if sec_match:
                    current_section = sec_match.group(1).strip()

                # If paragraph fits within the target chunk size (allow up to 880 chars for self-contained section paragraphs)
                max_allowed_single_chunk = max(self.chunk_size, 1050) if sec_match else self.chunk_size
                if len(para) <= max_allowed_single_chunk:
                    if len(para) > 20:
                        chunk_id = f"{doc_id}-p{page_num}-c{len(chunks) + 1}"
                        chunks.append({
                            "id": chunk_id,
                            "documentId": doc_id,
                            "documentTitle": doc_title,
                            "officialTitle": official_title,
                            "rawFilename": raw_filename,
                            "section": current_section,
                            "page": page_num,
                            "jurisdiction": jurisdiction,
                            "effectiveDate": effective_date,
                            "documentType": document_type,
                            "notificationNumber": notification_number,
                            "sha256": sha256,
                            "verified": verified,
                            "verifiedBy": verified_by,
                            "verifiedAt": verified_at,
                            "lastReviewedAt": last_reviewed_at,
                            "supersededBy": superseded_by,
                            "amends": amends,
                            "sourceUrl": source_url,
                            "isTestData": is_test_data,
                            "text": para
                        })
                else:
                    # Recursive sliding window split respecting sentence or clause boundaries
                    start = 0
                    while start < len(para):
                        end = min(start + self.chunk_size, len(para))
                        if end < len(para):
                            # Try to break at sentence or clause boundaries
                            for delim in ['. ', '; ', ':\n', '\n']:
                                boundary = para.rfind(delim, start + self.chunk_size // 2, end)
                                if boundary != -1:
                                    end = boundary + len(delim)
                                    break

                        sub_text = para[start:end].strip()
                        if len(sub_text) > 30:
                            chunk_id = f"{doc_id}-p{page_num}-c{len(chunks) + 1}"
                            chunks.append({
                                "id": chunk_id,
                                "documentId": doc_id,
                                "documentTitle": doc_title,
                                "officialTitle": official_title,
                                "rawFilename": raw_filename,
                                "section": current_section,
                                "page": page_num,
                                "jurisdiction": jurisdiction,
                                "effectiveDate": effective_date,
                                "documentType": document_type,
                                "notificationNumber": notification_number,
                                "sha256": sha256,
                                "verified": verified,
                                "verifiedBy": verified_by,
                                "verifiedAt": verified_at,
                                "lastReviewedAt": last_reviewed_at,
                                "supersededBy": superseded_by,
                                "amends": amends,
                                "sourceUrl": source_url,
                                "isTestData": is_test_data,
                                "text": sub_text
                            })

                        if end >= len(para):
                            break
                        start = end - self.chunk_overlap

        return chunks
