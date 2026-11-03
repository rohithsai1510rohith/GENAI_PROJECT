import asyncio
import json
from collections.abc import AsyncGenerator

from app.core.config import settings
from app.core.logging import logger
from app.generation.card_builder import build_quick_answer_card
from app.generation.prompts import SYSTEM_PROMPT, build_context_string
from app.schemas.chat_schemas import ChatMessage, SourceItem

try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False


class GroqLLMClient:
    """
    Groq Cloud LLM Client enforcing grounded retrieval answers,
    prompt-injection defense, exponential backoff retries, and SSE streaming.
    """

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.GROQ_MODEL
        self.temperature = max(0.1, min(0.2, float(settings.GROQ_TEMPERATURE)))
        self.max_tokens = settings.GROQ_MAX_TOKENS
        self._client = None
        self._init_client()

    def _init_client(self):
        if HAS_GROQ and self.api_key and self.api_key.strip() and not self.api_key.startswith("your_"):
            try:
                self._client = Groq(api_key=self.api_key.strip())
                logger.info(f"Initialized Groq client (model: {self.model}, temp: {self.temperature})")
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                self._client = None
        else:
            self._client = None

    def _format_messages(
        self,
        question: str,
        sources: list[SourceItem],
        history: list[ChatMessage] | None = None,
        confidence_tier: str = "HIGH"
    ) -> list[dict[str, str]]:
        context_str = build_context_string(sources)
        system_content = SYSTEM_PROMPT.format(context=context_str)

        if confidence_tier == "MEDIUM":
            system_content += "\nNOTE: Closest statutory match found. Explicitly note that this is the closest verified statutory provision."

        messages = [{"role": "system", "content": system_content}]

        if history:
            for msg in history[-4:]:
                messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": question})
        return messages

    def _get_special_response(
        self,
        is_non_traffic: bool,
        is_gibberish: bool,
        is_grounded: bool,
        did_you_mean: str | None = None
    ) -> str | None:
        if is_non_traffic:
            return (
                "### 🇮🇳 Official Transport & Statutory Directory Guidance\n\n"
                "I am the **Indian Statutory Traffic Rules & Penalties Assistant**, grounded directly in official data from the **Ministry of Road Transport and Highways (MoRTH)** and **Parivahan Sewa** (`https://parivahan.gov.in`).\n\n"
                "Your inquiry appears to be outside motor vehicle and traffic legislation. To ensure accuracy and prevent misinformation, answers are strictly derived from official transport regulations and gazette notifications.\n\n"
                "#### 📚 Verified Official Government Portals for Transport Services:\n"
                "- **Driving Licences & Learner Applications**: [Sarathi Parivahan](https://sarathi.parivahan.gov.in)\n"
                "- **Vehicle Registration & RC Services**: [Vahan Parivahan](https://vahan.parivahan.gov.in)\n"
                "- **E-Challan Verification & Payment**: [Parivahan E-Challan](https://echallan.parivahan.gov.in)\n"
                "- **Official Acts, Rules & Gazette Notifications**: [MoRTH Official Portal](https://morth.nic.in)\n"
                "- **DigiLocker Digital Documents (Rule 139A)**: [DigiLocker India](https://www.digilocker.gov.in)\n\n"
                "Feel free to ask any question regarding traffic fines, statutory penalties, helmet rules, licence renewal, speed limits, or vehicle compliance!"
            )

        if is_gibberish:
            return (
                "### ℹ️ Query Not Recognized\n\n"
                "I couldn't identify recognizable traffic terms in your inquiry. Please check your spelling or choose a topic such as **helmet rules**, **driving licence validity**, **drunk driving fines**, or **speed limits**.\n\n"
                "You can also check official guidelines on [Parivahan Sewa](https://parivahan.gov.in)."
            )

        if not is_grounded:
            if did_you_mean:
                return (
                    f"### ℹ️ Statutory Information Notice\n\n"
                    f"I couldn't find an exact statutory match for your query in the current dataset. Did you mean: **{did_you_mean}**?\n\n"
                    "To prevent inaccuracies or hallucinations, no penalty amount has been assumed. According to official **Ministry of Road Transport and Highways (MoRTH)** guidelines, you can verify your query or view official notification gazettes directly at the official portal:\n\n"
                    "- 🌐 **Official Parivahan Portal**: [parivahan.gov.in](https://parivahan.gov.in)\n"
                    "- 📜 **MoRTH Acts & Rules**: [morth.nic.in](https://morth.nic.in)"
                )
            return (
                "### ℹ️ Official Statutory Dataset Guidance\n\n"
                "This query could not be matched with high confidence in the verified Indian Traffic Rules & Penalties dataset (Motor Vehicles Act 1988 / 2019 Amendments & CMVR 1989).\n\n"
                "To uphold our zero-hallucination policy, no unverified fine has been generated. For comprehensive state-specific rules and live notifications, please consult the official central and state transport authorities:\n\n"
                "- 🌐 **Parivahan Sewa Portal**: [https://parivahan.gov.in](https://parivahan.gov.in)\n"
                "- 🚗 **E-Challan Online Redressal & Inquiries**: [https://echallan.parivahan.gov.in](https://echallan.parivahan.gov.in)\n"
                "- 🏛️ **Ministry of Road Transport & Highways**: [https://morth.nic.in](https://morth.nic.in)"
            )

        return None

    async def generate_response(
        self,
        question: str,
        sources: list[SourceItem],
        history: list[ChatMessage] | None = None,
        confidence_tier: str = "HIGH",
        is_grounded: bool = True,
        is_non_traffic: bool = False,
        is_gibberish: bool = False,
        did_you_mean: str | None = None,
        subqueries: list[str] | None = None
    ) -> str:
        special = self._get_special_response(is_non_traffic, is_gibberish, is_grounded, did_you_mean)
        if special:
            return special

        prefix = ""
        if did_you_mean:
            prefix += f"*(Showing results for: **{did_you_mean}**)*\n\n"
        if confidence_tier == "MEDIUM":
            prefix += "> ℹ️ *Note: Closest statutory match found in official documents based on your query.*\n\n"

        if self._client:
            messages = self._format_messages(question, sources, history, confidence_tier)
            for attempt in range(3):
                try:
                    completion = self._client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens,
                    )
                    return prefix + completion.choices[0].message.content
                except Exception as e:
                    logger.warning(f"Groq API call attempt {attempt + 1} failed: {e}")
                    if attempt < 2:
                        await asyncio.sleep(0.5 * (2 ** attempt))
                    else:
                        logger.error("All Groq API retries failed. Falling back to extractive synthesis.")

        return prefix + self._build_extractive_answer(sources, subqueries)

    async def stream_response(
        self,
        question: str,
        sources: list[SourceItem],
        history: list[ChatMessage] | None = None,
        confidence_tier: str = "HIGH",
        is_grounded: bool = True,
        is_non_traffic: bool = False,
        is_gibberish: bool = False,
        did_you_mean: str | None = None,
        related_questions: list[str] | None = None,
        closest_topics: list[str] | None = None,
        subqueries: list[str] | None = None
    ) -> AsyncGenerator[str, None]:
        special = self._get_special_response(is_non_traffic, is_gibberish, is_grounded, did_you_mean)
        if special:
            for word in special.split(" "):
                yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
                await asyncio.sleep(0.01)

            done_payload = {
                "type": "done",
                "sources": [s.dict() for s in sources],
                "confidenceTier": confidence_tier,
                "didYouMean": did_you_mean,
                "relatedQuestions": related_questions or [],
                "closestTopics": closest_topics or [],
                "card": None,
                "isNonTraffic": is_non_traffic,
                "isGibberish": is_gibberish
            }
            yield f"data: {json.dumps(done_payload)}\n\n"
            return

        # 1. Build and emit Quick Answer Card BEFORE the first token if grounded
        card = None
        if is_grounded and sources:
            card = build_quick_answer_card(sources, question, subqueries)
            if card:
                card_data = card.dict()
                yield f"event: card\ndata: {json.dumps(card_data)}\n\n"
                yield f"data: {json.dumps({'type': 'card', 'card': card_data})}\n\n"

        if did_you_mean:
            typo_note = f"*(Showing results for: **{did_you_mean}**)*\n\n"
            yield f"data: {json.dumps({'type': 'token', 'content': typo_note})}\n\n"
        if confidence_tier == "MEDIUM":
            med_note = "> ℹ️ *Note: Closest statutory match found in official documents based on your query.*\n\n"
            yield f"data: {json.dumps({'type': 'token', 'content': med_note})}\n\n"

        if self._client:
            messages = self._format_messages(question, sources, history, confidence_tier)
            for attempt in range(3):
                try:
                    stream = self._client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens,
                        stream=True,
                    )
                    for chunk in stream:
                        delta = chunk.choices[0].delta.content or ""
                        if delta:
                            yield f"data: {json.dumps({'type': 'token', 'content': delta})}\n\n"
                            await asyncio.sleep(0.003)

                    done_payload = {
                        "type": "done",
                        "sources": [s.dict() for s in sources],
                        "confidenceTier": confidence_tier,
                        "didYouMean": did_you_mean,
                        "relatedQuestions": related_questions or [],
                        "closestTopics": closest_topics or [],
                        "card": card.dict() if card else None,
                        "description": card.description.dict() if card else None,
                        "isNonTraffic": False,
                        "isGibberish": False
                    }
                    yield f"data: {json.dumps(done_payload)}\n\n"
                    return
                except Exception as e:
                    logger.warning(f"Groq streaming attempt {attempt + 1} failed: {e}")
                    if attempt < 2:
                        await asyncio.sleep(0.5 * (2 ** attempt))
                    else:
                        logger.error("All Groq streaming attempts failed. Yielding extractive fallback.")

        # Extractive fallback
        extractive = self._build_extractive_answer(sources, subqueries)
        for word in extractive.split(" "):
            yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
            await asyncio.sleep(0.01)

        done_payload = {
            "type": "done",
            "sources": [s.dict() for s in sources],
            "confidenceTier": confidence_tier,
            "didYouMean": did_you_mean,
            "relatedQuestions": related_questions or [],
            "closestTopics": closest_topics or [],
            "card": card.dict() if card else None,
            "description": card.description.dict() if card else None,
            "isNonTraffic": False,
            "isGibberish": False
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    def _build_extractive_answer(self, sources: list[SourceItem], subqueries: list[str] | None = None) -> str:
        if not sources:
            return (
                "### ℹ️ Statutory Information Notice\n\n"
                "I could not locate verified statutory provisions matching your inquiry in the current official transport enactments. "
                "To uphold statutory accuracy and prevent misinformation, unverified penalties are never generated. "
                "Please verify directly on the official Ministry of Road Transport and Highways portal (https://morth.nic.in) or Parivahan Sewa (https://parivahan.gov.in)."
            )

        if subqueries and len(subqueries) > 1:
            answer = "### 🏛️ Multi-Part Statutory Legal Findings\n\n"
            for idx, sq in enumerate(subqueries, 1):
                best_s = sources[(idx - 1) % len(sources)]
                sec_name = best_s.section or "Statutory Regulation"
                doc_name = best_s.officialTitle or best_s.documentTitle or "The Motor Vehicles (Amendment) Act, 2019"
                answer += (
                    f"#### Part {idx}: {sq.strip().capitalize()}\n"
                    f"Under **{sec_name}** of *{doc_name}*, this traffic regulation is strictly enforced under Indian law. "
                    f"Statutory penalty schedule: {best_s.excerpt[:130].strip()}...\n\n"
                    f"- **Governing Section**: {sec_name}\n"
                    f"- **Statutory Source**: {doc_name}\n\n"
                )
            answer += "- **Enforcement & Compliance**: Automated e-challans generated via ANPR/CCTV. Electronic credentials via DigiLocker or mParivahan are accepted under CMVR Rule 139.\n"
            return answer

        top = sources[0]
        top_text = top.chunkText or top.excerpt or ""
        sec_title = top.section or "Statutory Provisions"
        doc_title = top.officialTitle or top.documentTitle or "The Motor Vehicles (Amendment) Act, 2019"

        clean_sec = sec_title.split(":")[0].strip() if ":" in sec_title else sec_title
        offence_name = sec_title.split(":")[1].strip().split("(")[0].strip() if ":" in sec_title else "this traffic violation"

        import re

        # Sub-block analysis for accurate first offence parsing
        low = top_text.lower()
        first_block = low
        if "first offence" in low:
            first_block = low.split("first offence", 1)[1]
            if "second" in first_block or "subsequent" in first_block:
                first_block = re.split(r"second|subsequent", first_block)[0]

        # 1. Clean fine amount
        fine_val = None
        m_fine = re.search(r"(?:₹|Rs\.?)\s*([\d,]+(?:\s*(?:to|-)\s*[\d,]+)?)", first_block)
        if m_fine:
            fine_val = f"₹{m_fine.group(1)}"
        elif "five thousand rupees" in first_block and "one thousand rupees" in first_block:
            fine_val = "₹1,000 to ₹5,000"
        elif "twenty-five thousand rupees" in first_block:
            fine_val = "₹25,000"
        elif "fifteen thousand rupees" in first_block:
            fine_val = "₹15,000"
        elif "ten thousand rupees" in first_block:
            fine_val = "₹10,000"
        elif "five thousand rupees" in first_block:
            fine_val = "₹5,000"
        elif "two thousand rupees" in first_block:
            fine_val = "₹2,000"
        elif "one thousand rupees" in first_block:
            fine_val = "₹1,000"
        elif "five hundred rupees" in first_block:
            fine_val = "₹500"
        else:
            m_all = re.search(r"(?:₹|Rs\.?)\s*([\d,]+(?:\s*(?:to|-)\s*[\d,]+)?)", low)
            if m_all:
                fine_val = f"₹{m_all.group(1)}"
            elif "ten thousand rupees" in low:
                fine_val = "₹10,000"
            elif "five thousand rupees" in low:
                fine_val = "₹5,000"
            elif "two thousand rupees" in low:
                fine_val = "₹2,000"
            elif "one thousand rupees" in low:
                fine_val = "₹1,000"
            elif "five hundred rupees" in low:
                fine_val = "₹500"
            else:
                fine_val = "prescribed statutory fine"

        # 2. Imprisonment duration
        imp_val = None
        if "imprisonment" in first_block:
            if "six months" in first_block or "6 months" in first_block:
                imp_val = "imprisonment up to 6 months"
            elif "three months" in first_block or "3 months" in first_block:
                imp_val = "imprisonment up to 3 months"
            elif "one year" in first_block or "1 year" in first_block:
                imp_val = "imprisonment up to 1 year"
            elif "two years" in first_block or "2 years" in first_block:
                imp_val = "imprisonment up to 2 years"
            elif "three years" in first_block or "3 years" in first_block:
                imp_val = "imprisonment up to 3 years"

        # 3. Licence action
        lic_val = None
        if "disqualified" in low or "suspension" in low or "licence" in low:
            if "three months" in low or "3 months" in low:
                lic_val = "3-month driving licence disqualification"
            elif "six months" in low or "6 months" in low:
                lic_val = "6-month driving licence suspension"
            elif "one year" in low or "1 year" in low:
                lic_val = "1-year driving licence suspension"

        # 4. Repeat offence escalation
        rep_val = None
        if "fifteen thousand rupees" in low and "two years" in low:
            rep_val = "up to ₹15,000 fine and up to 2 years imprisonment"
        elif "ten thousand rupees" in low and "two years" in low:
            rep_val = "up to ₹10,000 fine and up to 2 years imprisonment"
        elif "ten thousand rupees" in low:
            rep_val = "up to ₹10,000 fine"
        elif "fifteen hundred rupees" in low or "1,500" in low:
            rep_val = "fine up to ₹1,500"
        elif "second or subsequent" in low or "subsequent offence" in low:
            rep_val = "escalated fines and penalties within 3 years"

        # Compose 30-45 word statutory summary paragraph
        penalty_parts = [f"a fine of {fine_val}"]
        if imp_val:
            penalty_parts.append(f"{imp_val}")
        if lic_val:
            penalty_parts.append(f"{lic_val}")
        penalty_desc = ", ".join(penalty_parts)

        repeat_sentence = ""
        if rep_val:
            repeat_sentence = f" A subsequent offence committed within three years carries {rep_val}."
        else:
            repeat_sentence = " Valid digital vehicular documents presented via DigiLocker or mParivahan are accepted under CMVR Rule 139."

        summary_para = (
            f"Under **{clean_sec}** ({offence_name}) of *{doc_title}*, "
            f"violating these provisions is punishable with {penalty_desc} for the first offence."
            f"{repeat_sentence}"
        )

        # Build structured important points
        bullets = [
            f"- **Statutory Section**: **{clean_sec}** ({offence_name})",
            f"- **First Offence**: Fine of {fine_val}" + (f", {imp_val}" if imp_val else "") + (f", {lic_val}" if lic_val else ""),
        ]
        if rep_val:
            bullets.append(f"- **Repeat Offence (within 3 yrs)**: {rep_val.capitalize()}")
        bullets.append("- **Compliance & Enforcement**: Automated e-challans via ANPR/CCTV cameras. Digital DL & RC accepted under CMVR Rule 139.")

        return f"### 🏛️ Statutory Finding: {clean_sec}\n\n{summary_para}\n\n" + "\n".join(bullets)


groq_client = GroqLLMClient()
