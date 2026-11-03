from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    title: str = Field(..., description="Display Document Title")
    officialTitle: str | None = Field(default=None, description="Official Statutory Title")
    type: str = Field(default="Act", description="Act, Rules, Notification, or Guideline")
    documentType: str | None = Field(default="Act", description="Act, Rules, Notification, or Guideline")
    jurisdiction: str = Field(default="Central", description="Central or State")
    notificationNumber: str | None = Field(default=None, description="Official Gazette Notification Number")
    effectiveDate: str | None = "2019-09-01"
    sourceUrl: str | None = None
    sha256: str | None = None
    verified: bool | None = False
    verifiedBy: str | None = None
    verifiedAt: str | None = None
    lastReviewedAt: str | None = None
    supersededBy: str | None = None
    amends: str | None = None
    isTestData: bool | None = False

class IngestRequest(BaseModel):
    filePath: str | None = None
    content: str | None = None
    metadata: DocumentMetadata

class IngestResponse(BaseModel):
    documentId: str
    title: str
    status: str
    chunksCreated: int
    totalVectorsInIndex: int
    message: str
