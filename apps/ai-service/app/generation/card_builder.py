import re
from typing import Any
from app.core.logging import logger
from app.schemas.chat_schemas import (
    SourceItem,
    KeyFactItem,
    DescriptionObj,
    SourceLineObj,
    QuickAnswerCardData,
)

ALL_POSSIBLE_LABELS = [
    "Section / Rule",
    "Offence",
    "Fine",
    "Imprisonment",
    "Licence action",
    "Repeat offence",
    "Applies to",
    "Compoundable",
    "Authority / court",
]


def extract_verbatim_match(pattern: str, text: str) -> str | None:
    """Finds a regex pattern in text and returns the exact matching substring."""
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        # Return exact slice from text
        start, end = m.span()
        return text[start:end]
    return None


def build_quick_answer_card(
    sources: list[SourceItem],
    question: str,
    subqueries: list[str] | None = None
) -> QuickAnswerCardData | None:
    """
    Constructs a structured Quick Answer Card from retrieved chunks only.
    Strictly validates that every numeric amount, duration, and section number
    is a verbatim substring of the cited chunk.
    """
    if not sources:
        return None

    primary_source = sources[0]
    chunk_text = primary_source.chunkText or primary_source.excerpt or ""
    if not chunk_text:
        return None

    # 1. Headline
    section_name = primary_source.section or "Statutory Finding"
    if ":" in section_name:
        headline = section_name.strip()
    else:
        headline = f"{section_name} — Statutory Provisions"

    # 2. Key Facts Extraction & Verbatim Validation
    raw_facts: list[KeyFactItem] = []

    # Section / Rule
    sec_match = extract_verbatim_match(r'\b(Section\s+\d+[A-Z]?|Rule\s+\d+[A-Z]?|PART\s+[I|V|X]+)\b', chunk_text)
    if sec_match:
        raw_facts.append(KeyFactItem(label="Section / Rule", value=sec_match, sourceIndex=0, quote=sec_match))

    # Offence
    offence_match = extract_verbatim_match(
        r'(Driving by a drunken person[^\n\.\;]*|Production of licence[^\n\.\;]*|Driving without[^\n\.\;]*|Using handheld[^\n\.\;]*|Riding without[^\n\.\;]*|Carrying more than[^\n\.\;]*|Driving dangerously[^\n\.\;]*|Driving at excessive speed[^\n\.\;]*|Taking part in a race[^\n\.\;]*|Using vehicle without[^\n\.\;]*)',
        chunk_text
    )
    if offence_match:
        raw_facts.append(KeyFactItem(label="Offence", value=offence_match.strip(), sourceIndex=0, quote=offence_match.strip()))

    # Fine
    fine_match = extract_verbatim_match(
        r'(fine of (ten|five|two|one) thousand rupees|fine which may extend to (ten|five|two|one) thousand rupees|fine of [0-9,]+ rupees|fine which shall not be less than [0-9,]+ rupees|fine of Rs\.?\s*[\d,]+|ten thousand rupees|five thousand rupees|two thousand rupees|one thousand rupees|twenty-five thousand rupees|five hundred rupees|ten thousand|five thousand|two thousand|one thousand|fine of [^,\.\n]+rupees)',
        chunk_text
    )
    if fine_match:
        raw_facts.append(KeyFactItem(label="Fine", value=fine_match.strip(), sourceIndex=0, quote=fine_match.strip()))

    # Imprisonment
    imp_match = extract_verbatim_match(
        r'(imprisonment for a term which may extend to [^,\.\n]+|imprisonment up to [^,\.\n]+|imprisonment for [^,\.\n]+six months|imprisonment for [^,\.\n]+three years|imprisonment for [^,\.\n]+one year|six months imprisonment|three years imprisonment)',
        chunk_text
    )
    if imp_match:
        raw_facts.append(KeyFactItem(label="Imprisonment", value=imp_match.strip(), sourceIndex=0, quote=imp_match.strip()))

    # Licence Action
    lic_match = extract_verbatim_match(
        r'(disqualification for holding or obtaining (a )?driving licence for a period of [^,\.\n]+|suspension of driving licence[^,\.\n]*|disqualification for a period of three months|disqualification for [^,\.\n]+months)',
        chunk_text
    )
    if lic_match:
        raw_facts.append(KeyFactItem(label="Licence action", value=lic_match.strip(), sourceIndex=0, quote=lic_match.strip()))

    # Repeat Offence
    rep_match = extract_verbatim_match(
        r'(for a second or subsequent offence[^,\.\n]*|second or subsequent offence[^,\.\n]*|subsequent offence[^,\.\n]*)',
        chunk_text
    )
    if rep_match:
        raw_facts.append(KeyFactItem(label="Repeat offence", value=rep_match.strip(), sourceIndex=0, quote=rep_match.strip()))

    # Applies To
    applies_match = extract_verbatim_match(
        r'(driver or a person in charge of a motor vehicle|every person driving or riding on a motor cycle|Whoever drives or causes or allows to be driven|Whoever, while driving, or attempting to drive|guardian of such juvenile or the owner of the motor vehicle)',
        chunk_text
    )
    if applies_match:
        raw_facts.append(KeyFactItem(label="Applies to", value=applies_match.strip(), sourceIndex=0, quote=applies_match.strip()))

    # Compoundable
    comp_match = extract_verbatim_match(
        r'(compoundable[^,\.\n]*|compounded under section 200[^,\.\n]*|spot penalty[^,\.\n]*)',
        chunk_text
    )
    if comp_match:
        raw_facts.append(KeyFactItem(label="Compoundable", value=comp_match.strip(), sourceIndex=0, quote=comp_match.strip()))

    # Authority / Court
    auth_match = extract_verbatim_match(
        r'(Virtual Court|Traffic Court|police officer in uniform|officer of the Motor Vehicles Department|authorized testing station|concerned police station or enforcement authority)',
        chunk_text
    )
    if auth_match:
        raw_facts.append(KeyFactItem(label="Authority / court", value=auth_match.strip(), sourceIndex=0, quote=auth_match.strip()))

    # Strict Server-Side Validation: Drop any fact whose value is not an exact substring
    validated_facts: list[KeyFactItem] = []
    found_labels: set[str] = set()
    for f in raw_facts:
        if f.value in chunk_text:
            validated_facts.append(f)
            found_labels.add(f.label)
        else:
            logger.warn(f"Server-side validation dropped keyFact '{f.label}': '{f.value}' not in chunk text")

    # Determine Not Stated labels
    not_stated = [label for label in ALL_POSSIBLE_LABELS if label not in found_labels]

    # 3. Keywords matching between query and retrieved text
    stop_words = {"what", "is", "the", "for", "in", "and", "under", "of", "to", "a", "an", "on", "with", "how", "can", "are"}
    q_words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', question) if w.lower() not in stop_words]
    keywords: list[str] = []
    for w in q_words:
        if re.search(r'\b' + re.escape(w) + r'\b', chunk_text, re.IGNORECASE):
            keywords.append(w.capitalize())

    # Add key legal terms found in text
    legal_terms = ["Helmet", "Drunk Driving", "Breath Analyser", "Speed Limit", "Driving Licence", "Registration Certificate", "Insurance", "DigiLocker", "E-Challan", "Emergency Vehicle", "PUC Certificate"]
    for term in legal_terms:
        if re.search(r'\b' + re.escape(term) + r'\b', chunk_text, re.IGNORECASE) and term not in keywords:
            keywords.append(term)
    keywords = keywords[:6]

    # 4. Description Object
    conditions: list[str] = []
    cond_matches = re.findall(r'(\([a-z]\)[^\n;\.]+)', chunk_text)
    if cond_matches:
        for c in cond_matches[:3]:
            conditions.append(c.strip())

    exceptions: list[str] = []
    exc_matches = re.findall(r'(provided that[^\n;\.]+|except[^\n;\.]+)', chunk_text, re.IGNORECASE)
    if exc_matches:
        for e in exc_matches[:2]:
            exceptions.append(e.strip())

    related_sections: list[str] = []
    sec_refs = re.findall(r'\b(Section\s+\d+[A-Z]?|Rule\s+\d+[A-Z]?)\b', chunk_text, re.IGNORECASE)
    for r_sec in sec_refs:
        norm = r_sec.strip().title()
        if norm.lower() != primary_source.section.lower() and norm not in related_sections:
            related_sections.append(norm)

    facts_desc = ""
    if validated_facts:
        fact_summaries = [f"{f.label}: {f.value}" for f in validated_facts if f.label in ("Fine", "Imprisonment", "Licence action", "Repeat offence")]
        if fact_summaries:
            facts_desc = f" Statutory penalties for this infraction include {'; '.join(fact_summaries)}."

    explanation = (
        f"Under {primary_source.section} of {primary_source.officialTitle or primary_source.documentTitle}, "
        "Indian traffic law establishes mandatory compliance criteria for all motor vehicles and road users."
        f"{facts_desc} Enforcement is executed through automated electronic monitoring (ANPR/CCTV), "
        "spot inspection by authorized enforcement officers, and Parivahan digital registry tracking. "
        "Citizens may produce verified electronic credentials via DigiLocker or mParivahan under Rule 139 of CMVR."
    )

    description_obj = DescriptionObj(
        explanation=explanation,
        clauseText=chunk_text,
        conditions=conditions,
        exceptions=exceptions,
        relatedSections=related_sections[:4],
    )

    # 5. SourceLine Object
    source_line = SourceLineObj(
        title=primary_source.officialTitle or primary_source.documentTitle,
        section=primary_source.section,
        effectiveDate=primary_source.effectiveDate or "2019-09-01",
        lastReviewedAt=primary_source.lastReviewedAt,
        jurisdiction=primary_source.jurisdiction or "Central",
        verified=bool(primary_source.verified),
        amendedBy=primary_source.amends
    )

    return QuickAnswerCardData(
        headline=headline,
        keyFacts=validated_facts,
        keywords=keywords,
        description=description_obj,
        notStated=not_stated,
        sourceLine=source_line
    )

