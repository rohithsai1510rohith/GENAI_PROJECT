import difflib
import re
from typing import Any

# Common traffic terms, synonyms, and Hinglish transliterations
SYNONYM_MAP: dict[str, list[str]] = {
    # Fines & penalties
    "challan": ["fine", "penalty", "ticket", "e-challan", "punishment"],
    "chalan": ["fine", "penalty", "challan", "ticket"],
    "fine": ["penalty", "punishment", "challan"],
    "penalty": ["fine", "punishment", "challan"],
    "ticket": ["challan", "fine", "penalty"],
    "saza": ["punishment", "penalty", "imprisonment"],

    # Vehicles
    "helmet": ["headgear", "protective headgear", "Section 194D", "Section 129", "two-wheeler"],
    "helmat": ["helmet", "protective headgear", "Section 194D"],
    "helmetless": ["without helmet", "protective headgear", "Section 194D"],
    "bike": ["motorcycle", "two-wheeler", "scooter"],
    "scooter": ["two-wheeler", "motorcycle", "bike"],
    "two-wheeler": ["motorcycle", "two-wheeler", "bike", "scooter"],
    "two wheeler": ["motorcycle", "two-wheeler", "bike", "scooter"],
    "gaadi": ["vehicle", "motor vehicle", "car"],
    "gadi": ["vehicle", "motor vehicle", "car"],
    "car": ["motor vehicle", "light motor vehicle", "LMV"],
    "auto": ["three-wheeler", "contract carriage"],
    "truck": ["goods carriage", "heavy goods vehicle", "overloading"],

    # Violations & Riding
    "triple": ["carrying more than one person", "triple riding", "Section 194C", "Section 128"],
    "triple riding": ["carrying more than one person", "Section 194C", "Section 128"],
    "tripling": ["carrying more than one person", "triple riding", "Section 194C"],
    "pillion": ["passenger", "pillion rider", "headgear", "Section 128", "Section 129"],
    "seatbelt": ["safety belt", "seat belt", "child restraint", "Section 194B"],
    "seat belt": ["safety belt", "seatbelt", "Section 194B"],
    "speed": ["speeding", "excessive speed", "speed limit", "Section 183"],
    "speeding": ["excessive speed", "speed limit", "Section 183"],
    "overspeeding": ["excessive speed", "speed limit", "Section 183"],
    "signal": ["red light", "traffic signal", "dangerous driving", "Section 184", "Section 118"],
    "red light": ["traffic signal", "stop sign", "dangerous driving", "Section 184"],
    "light jump": ["red light", "dangerous driving", "Section 184"],
    "phone": ["handheld mobile", "communications device", "mobile phone", "Section 184"],
    "mobile": ["handheld communication device", "mobile phone while driving", "Section 184"],
    "drunk": ["drunken driving", "alcohol", "breath analyser", "Section 185"],
    "drink and drive": ["drunken driving", "alcohol", "breath analyser", "Section 185"],
    "alcohol": ["drunken driving", "blood alcohol 30 mg", "Section 185"],
    "daaru": ["drunken driving", "alcohol", "Section 185"],
    "sharab": ["drunken driving", "alcohol", "Section 185"],
    "overload": ["overloading", "excess weight", "Section 194"],
    "overloading": ["excess weight", "goods carriage", "Section 194"],
    "ambulance": ["emergency vehicle", "fire brigade", "passage", "Section 194E"],
    "emergency": ["emergency vehicle", "ambulance", "fire service", "Section 194E"],
    "horn": ["silence zone", "multi-toned horn", "Section 194F"],
    "honking": ["needless horn", "silence zone", "Section 194F"],
    "racing": ["trials of speed", "speed race", "Section 189"],
    "minor": ["juvenile", "underage driving", "guardian", "Section 199A"],
    "underage": ["juvenile driving", "minor driving", "Section 199A", "Section 4"],
    "bachha": ["juvenile", "minor driving", "Section 199A"],
    "kid": ["juvenile", "minor driving", "Section 199A"],

    # Documents & Licensing
    "dl": ["driving licence", "driving license", "Section 3", "Section 181"],
    "licence": ["driving licence", "driving license", "validity", "renewal", "Section 3", "Section 14", "Section 15"],
    "license": ["driving licence", "driving license", "validity", "renewal", "Section 3", "Section 14", "Section 15"],
    "lisence": ["driving licence", "driving license", "Section 181"],
    "rc": ["registration certificate", "certificate of registration", "Section 39", "Section 192"],
    "registration": ["certificate of registration", "unregistered vehicle", "Section 39", "Section 192"],
    "insurance": ["third party insurance", "motor insurance", "certificate of insurance", "Section 146", "Section 196"],
    "insurence": ["insurance", "third party insurance", "Section 146", "Section 196"],
    "puc": ["pollution under control", "pollution certificate", "emissions", "Rule 115", "Section 190"],
    "pollution": ["pollution under control", "PUC certificate", "noise", "Section 190"],
    "digilocker": ["electronic form", "mParivahan", "digital documents", "Rule 139", "Rule 139A"],
    "digi locker": ["electronic form", "DigiLocker", "mParivahan", "Rule 139"],
    "mparivahan": ["electronic form", "DigiLocker", "mParivahan", "Rule 139"],
    "paper": ["mandatory documents", "Rule 139", "licence", "registration", "insurance", "puc"],
    "papers": ["mandatory documents", "Rule 139", "licence", "registration", "insurance", "puc"],
    "kagaz": ["mandatory documents", "driving licence", "registration", "insurance", "puc", "Rule 139"],
    "documents": ["mandatory documents", "Rule 139", "DL", "RC", "Insurance", "PUC"],
    "permit": ["commercial vehicle permit", "Section 66", "Section 192A"],
    "fitness": ["fitness certificate", "commercial vehicle", "Section 56"],
    "renew": ["licence renewal", "grace period", "competence test", "Section 15"],
    "renewal": ["driving licence renewal", "grace period", "Section 15"],
    "expired": ["expiry", "renewal grace period", "Section 15"],
    "learner": ["learner's licence", "LL validity", "six months", "Section 14"],
    "parking": ["illegal parking", "obstruction to traffic", "Section 177", "Section 177A"],
    "accident": ["duty of driver in accident", "medical aid", "Section 134", "third party risk"]
}

# Known vocabulary for spell checking
KNOWN_TRAFFIC_VOCAB = list(SYNONYM_MAP.keys()) + [
    "punishment", "suspension", "impound", "cancelling", "court", "virtual",
    "parivahan", "morth", "echallan", "challan", "police", "officer", "seizure",
    "grace", "period", "validity", "mandatory", "original", "digital", "electronic"
]

# Non-traffic query keywords (for clear domain separation)
STRONG_NON_TRAFFIC_PATTERNS = [
    r"\b(spaceship|spacecraft|interplanetary|rocket|astronaut|moon mission|mars flight)\b",
    r"\b(bitcoin|crypto|cryptocurrency|ethereum|dogecoin|forex|stock trading|mutual fund|retirement planning|investment portfolio|income tax|itr|tax slab|tax regime|gst input|capital gains)\b",
    r"\b(submarine|submersible|torpedo)\b",
    r"\b(los angeles|california|new york|texas|florida|london|uk traffic|dmv california)\b",
    r"\b(recipe|pizza|cake|bake|biryani|burger|chocolate|butter chicken)\b",
    r"\b(voter id|election commission|pet dog|animal shelter|dog adoption|plumber|leaking tap|jee advanced|engineering admission|passport renewal|tatkaal|indigo flight|baggage allowance)\b",
    r"\b(murder under section 302|ipc section 302|lease agreement|residential rental|sub-registrar|transformer self-attention|seasonal cold and cough|home remedies for cold|bookmyshow)\b"
]

NON_TRAFFIC_PATTERNS = [
    r"\b(cook|bake|recipe|cake|pizza|biryani|butter chicken|food|pasta|fries|burger|sandwich|chocolate|dish|meal|curry|oven)\b",
    r"\b(code|python|javascript|java|c\+\+|html|css|sql|github|programming|deep learning|machine learning|transformer|algorithm)\b",
    r"\b(movie|film|actor|actress|cinema|bollywood|hollywood|bookmyshow)\b",
    r"\b(crypto|bitcoin|ethereum|forex|stock market|shares|mutual fund|capital gains|income tax|itr|tax slab|tax regime|gst|input tax|tds|savings bank account|foreign exchange|us dollar)\b",
    r"\b(weather|temperature|forecast|rain today|climate|snowfall|places to visit)\b",
    r"\b(cricket|football|soccer|tennis|messi|ronaldo|ipl|world cup|badminton)\b",
    r"\b(love|relationship|dating|girlfriend|boyfriend)\b",
    r"\b(math|algebra|calculus|geometry|solve equation)\b",
    r"\b(passport|tatkaal|visa|flight|indigo|air india|airline|baggage allowance|boarding pass|airport)\b",
    r"\b(ipc|murder|theft|burglary|section 302|divorce|custody|lease agreement|rental lease|sub-registrar|will deed|property registration)\b",
    r"\b(cold and cough|symptoms|remedies|fever|headache|antibiotic|medicine|home remedy|doctor)\b",
    r"\b(trademark|voter id|election commission|pet dog|adoption|plumber|leaking tap|jee advanced|engineering admission)\b",
    r"\b(ignore (all )?previous instructions|system prompt|reveal prompt|you are dan|drop table|how to bribe|evade police|disable camera|radar jammer|forge licence|fake puc)\b"
]

COMMON_STOPWORDS = {
    "under", "the", "for", "with", "from", "into", "over", "after", "before",
    "about", "what", "how", "when", "where", "which", "who", "whom", "this",
    "that", "these", "those", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "can", "could", "shall", "should",
    "will", "would", "may", "might", "must", "and", "or", "but", "if", "not", "no",
    "in", "on", "at", "by", "to", "of", "an", "as", "any", "all", "per", "within"
}

def is_gibberish(text: str) -> bool:
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', text).strip()
    if not cleaned:
        return True
    # If no vowels and length > 4 (e.g. "asdfghjk", "qwrtyp")
    if len(cleaned) > 4 and not re.search(r'[aeiouAEIOU]', cleaned):
        return True
    # Repetitive characters like "aaaaaa" or "hahahaha"
    if re.search(r'(.)\1{4,}', cleaned):
        return True
    # Very short single non-word
    return len(cleaned) <= 1

ADVERSARIAL_PATTERNS = [
    r"\b(ignore (all )?(previous )?instructions|system prompt|system override|reveal prompt|you are dan|drop table|bribe|evade police|checkpoint.*evade|disable.*camera|anpr.*camera|radar jammer|reflect flash|forge (licence|license|permit|rc|puc)|forging.*permit|counterfeit|fake (puc|licence|license|permit|rc)|evil hacker|erase.*e-challan|personal phone.*commissioner)\b"
]

def is_adversarial_query(text: str) -> bool:
    lower = text.lower()
    for pattern in ADVERSARIAL_PATTERNS:
        if re.search(pattern, lower):
            return True
    return False

def is_non_traffic_query(text: str) -> bool:
    lower = text.lower()
    for pattern in STRONG_NON_TRAFFIC_PATTERNS:
        if re.search(pattern, lower):
            return True
    for pattern in NON_TRAFFIC_PATTERNS:
        if re.search(pattern, lower):
            # Check if it also contains traffic words, e.g. "traffic code" -> don't false positive
            traffic_words = ["traffic", "fine", "rule", "challan", "police", "licence", "vehicle", "helmet", "car", "bike"]
            if not any(tw in lower for tw in traffic_words):
                return True
    return False

def correct_spelling_and_expand(query: str) -> tuple[str, list[str], str | None]:
    """
    Corrects common spelling mistakes, adds synonyms, and suggests 'Did you mean...?'
    Returns:
        (expanded_search_query, additional_keywords, did_you_mean)
    """
    words = re.findall(r'[a-zA-Z0-9]+', query.lower())
    corrected_words = []
    synonyms_added: list[str] = []
    did_you_mean: str | None = None
    typo_found = False

    for word in words:
        # Check direct synonym map
        if word in SYNONYM_MAP:
            corrected_words.append(word)
            synonyms_added.extend(SYNONYM_MAP[word])
            continue

        # Protect common English words/stopwords from false fuzzy matching (e.g. under -> underage)
        if word in COMMON_STOPWORDS:
            corrected_words.append(word)
            continue

        # Check fuzzy match against known vocab (minimum 5 chars, high cutoff)
        if len(word) >= 5:
            matches = difflib.get_close_matches(word, KNOWN_TRAFFIC_VOCAB, n=1, cutoff=0.84)
            if matches:
                best_match = matches[0]
                corrected_words.append(best_match)
                if best_match != word:
                    typo_found = True
                if best_match in SYNONYM_MAP:
                    synonyms_added.extend(SYNONYM_MAP[best_match])
                continue

        corrected_words.append(word)

    if typo_found:
        did_you_mean = " ".join(corrected_words)

    # Combine corrected query with key synonyms for enhanced search recall
    unique_synonyms = list(dict.fromkeys(synonyms_added))[:8]
    expanded_query = f"{' '.join(corrected_words)} {' '.join(unique_synonyms)}".strip()

    return expanded_query, unique_synonyms, did_you_mean

def rewrite_followup_question(current_question: str, history: list[dict[str, str]]) -> str:
    """
    If the question is a short follow-up or elliptical (e.g. 'what about pillion?', 'and second offence?', 'fine amount?'),
    it uses recent context to form a complete standalone query.
    """
    q_lower = current_question.lower().strip()
    words = q_lower.split()

    is_followup = False
    followup_cues = ["what about", "and for", "how much", "what if", "second time", "pillion", "then?", "why?", "where to pay"]

    if len(words) <= 4 or any(cue in q_lower for cue in followup_cues):
        is_followup = True

    if is_followup and history:
        # Extract last user question or assistant topic
        prev_user_q = ""
        for msg in reversed(history):
            if msg.get("role") == "user":
                prev_user_q = msg.get("content", "")
                break

        if prev_user_q:
            # Combine contextually
            rewritten = f"{prev_user_q} - specific query: {current_question}"
            return rewritten

    return current_question

def split_multipart_question(query: str) -> list[str]:
    """
    Detects if user asked multiple distinct questions connected by 'and', 'also', or '?'
    e.g. 'what is the fine for helmet and what is the punishment for drunk driving?'
    """
    parts = []
    # Split by '?' first
    raw_sub = [p.strip() for p in query.split('?') if p.strip()]
    for s in raw_sub:
        # Check for ' and ' or ' also ' with question indicator
        subparts = re.split(r'\b(?:and also|and|also|as well as)\b', s, flags=re.IGNORECASE)
        for sp in subparts:
            sp = sp.strip()
            if len(sp) > 5:
                parts.append(sp)

    return parts if len(parts) > 1 else [query]

def generate_related_questions(sources: list[Any], query: str) -> list[str]:
    """
    Generates 3 to 4 clickable related questions based on the retrieved legal sections.
    """
    related: list[str] = []
    sections_text = " ".join([getattr(s, "section", "") + " " + getattr(s, "excerpt", "") for s in sources]).lower()

    if "194d" in sections_text or "helmet" in sections_text or "129" in sections_text:
        related.append("Is a helmet mandatory for the pillion rider under Section 129?")
        related.append("What is the licence suspension period for driving without a helmet?")
        related.append("What is the fine for triple riding on a two-wheeler?")

    if "185" in sections_text or "drunk" in sections_text or "alcohol" in sections_text:
        related.append("What is the penalty for second time drunken driving?")
        related.append("What is the legal blood alcohol limit tested by breath analyser?")
        related.append("Can police impound a vehicle during drunk driving?")

    if "194b" in sections_text or "seatbelt" in sections_text:
        related.append("What is the penalty if rear seat passengers do not wear seatbelts?")
        related.append("What are the rules regarding child safety belts in motor vehicles?")

    if "139" in sections_text or "digilocker" in sections_text or "documents" in sections_text:
        related.append("Can traffic police refuse digital documents shown on DigiLocker?")
        related.append("What is the 15-day grace period to produce vehicle documents?")
        related.append("What documents must commercial vehicles carry under Rule 139?")

    if "199a" in sections_text or "juvenile" in sections_text or "minor" in sections_text:
        related.append("Can a minor get a driving licence before age 25 after a Section 199A violation?")
        related.append("What is the jail term for vehicle owners whose minor child drives?")

    if "181" in sections_text or "180" in sections_text or "licence" in sections_text or "license" in sections_text:
        related.append("What is the fine for allowing someone without a licence to drive your car?")
        related.append("What is the grace period for renewing an expired driving licence?")

    if "184" in sections_text or "dangerous" in sections_text or "phone" in sections_text:
        related.append("What is the penalty for using a handheld phone while driving?")
        related.append("What is the fine for red light jumping under Section 184?")

    if "196" in sections_text or "insurance" in sections_text:
        related.append("Is third-party motor insurance mandatory for all vehicles?")
        related.append("What is the second offence fine for driving without insurance?")

    if "194e" in sections_text or "emergency" in sections_text or "ambulance" in sections_text:
        related.append("What is the punishment for blocking an ambulance or fire service?")

    # Defaults if no specific matches
    defaults = [
        "What are the mandatory documents to carry while driving under Rule 139?",
        "Are DigiLocker documents legally valid across all Indian states?",
        "How to dispute an incorrect e-challan online on the Parivahan portal?",
        "What is the statutory penalty for riding without a helmet under Section 194D?"
    ]
    for d in defaults:
        if len(related) >= 4:
            break
        if d not in related:
            related.append(d)

    return related[:4]

def get_closest_topics(query: str) -> list[str]:
    """
    Returns 3 to 4 closest topics when a query falls back or is unclear.
    """
    q_lower = query.lower()
    topics = []
    if "paper" in q_lower or "doc" in q_lower or "kagaz" in q_lower:
        topics.extend(["Mandatory Documents (Rule 139)", "DigiLocker Validity", "RC & Insurance"])
    elif "bike" in q_lower or "helm" in q_lower or "scooter" in q_lower:
        topics.extend(["Helmet Rules (Section 194D)", "Triple Riding (Section 194C)", "Pillion Safety"])
    elif "drink" in q_lower or "drunk" in q_lower or "daaru" in q_lower:
        topics.extend(["Drunk Driving Penalties (Section 185)", "Breath Analyser Limits", "Court Procedures"])
    elif "chalan" in q_lower or "challan" in q_lower or "ticket" in q_lower:
        topics.extend(["E-Challan Payment Process", "Online Dispute Redressal", "Virtual Court Notice"])
    else:
        topics = [
            "Fines & Penalties (MV Act 2019)",
            "Mandatory Documents to Carry (Rule 139)",
            "Driving Licence Validity & Renewal",
            "E-Challan Process & Dispute Redressal"
        ]
    return topics[:4]
