from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message text content")

class Filters(BaseModel):
    jurisdiction: str | None = "Central"
    topic: str | None = "all"

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Citizen inquiry")
    history: list[ChatMessage] | None = Field(default_factory=list)
    filters: Filters | None = Field(default_factory=Filters)
    stream: bool | None = False

class SourceItem(BaseModel):
    id: str
    documentTitle: str
    officialTitle: str | None = None
    section: str
    page: int | None = 1
    chunkText: str = Field(default="", description="Full retrieved chunk text")
    excerpt: str
    score: float
    sourceUrl: str | None = None
    jurisdiction: str | None = "Central"
    effectiveDate: str | None = "2019-09-01"
    documentType: str | None = "Act"
    notificationNumber: str | None = None
    sha256: str | None = None
    verified: bool | None = False
    verifiedBy: str | None = None
    verifiedAt: str | None = None
    lastReviewedAt: str | None = None
    supersededBy: str | None = None
    amends: str | None = None
    isTestData: bool | None = False

class KeyFactItem(BaseModel):
    label: str
    value: str
    sourceIndex: int = 0
    quote: str = ""

class DescriptionObj(BaseModel):
    explanation: str = ""
    clauseText: str = ""
    conditions: list[str] = Field(default_factory=list)
    exceptions: list[str] = Field(default_factory=list)
    relatedSections: list[str] = Field(default_factory=list)

class SourceLineObj(BaseModel):
    title: str = ""
    section: str = ""
    effectiveDate: str = ""
    lastReviewedAt: str | None = None
    jurisdiction: str = "Central"
    verified: bool = False
    amendedBy: str | None = None

class QuickAnswerCardData(BaseModel):
    headline: str
    keyFacts: list[KeyFactItem] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    description: DescriptionObj = Field(default_factory=DescriptionObj)
    notStated: list[str] = Field(default_factory=list)
    sourceLine: SourceLineObj = Field(default_factory=SourceLineObj)

class QueryResponse(BaseModel):
    answer: str
    card: QuickAnswerCardData | None = None
    sources: list[SourceItem]
    grounded: bool = True
    confidence: float
    confidenceTier: str = "HIGH"  # "HIGH", "MEDIUM", "LOW"
    didYouMean: str | None = None
    relatedQuestions: list[str] = Field(default_factory=list)
    closestTopics: list[str] = Field(default_factory=list)
    isNonTraffic: bool = False
    isGibberish: bool = False
    latencyMs: int | None = 0

class SuggestionItem(BaseModel):
    text: str
    category: str
    section: str | None = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    indexLoaded: bool
    totalDocuments: int
    totalVectors: int
    groqModel: str
    isTestData: bool = False
    message: str | None = None
