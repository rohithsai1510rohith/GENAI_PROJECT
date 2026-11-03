export interface SourceItem {
  id?: string;
  documentTitle: string;
  officialTitle?: string;
  section: string;
  page?: number;
  chunkText: string;
  excerpt: string;
  score: number;
  sourceUrl?: string | null;
  jurisdiction?: string;
  effectiveDate?: string;
  documentType?: string;
  notificationNumber?: string | null;
  sha256?: string | null;
  verified?: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  lastReviewedAt?: string | null;
  supersededBy?: string | null;
  amends?: string | null;
  amendedBy?: string | null;
  isTestData?: boolean;
}

export interface KeyFactItem {
  label: string;
  value: string;
  sourceIndex: number;
  quote: string;
}

export interface DescriptionObj {
  explanation: string;
  clauseText: string;
  conditions: string[];
  exceptions: string[];
  relatedSections: string[];
}

export interface SourceLineObj {
  title: string;
  section: string;
  effectiveDate: string;
  lastReviewedAt?: string | null;
  jurisdiction: string;
  verified: boolean;
  amendedBy?: string | null;
}

export interface QuickAnswerCardData {
  headline: string;
  keyFacts: KeyFactItem[];
  keywords: string[];
  description: DescriptionObj;
  notStated: string[];
  sourceLine: SourceLineObj;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  card?: QuickAnswerCardData;
  sources?: SourceItem[];
  timestamp: string;
  isStreaming?: boolean;
  confidenceTier?: "HIGH" | "MEDIUM" | "LOW";
  grounded?: boolean;
  containsTestData?: boolean;
  allVerified?: boolean;
  anyUnverifiedOrSample?: boolean;
  isReviewDue?: boolean;
  didYouMean?: string;
  relatedQuestions?: string[];
  closestTopics?: string[];
  isNonTraffic?: boolean;
  isGibberish?: boolean;
  feedback?: "thumbs_up" | "thumbs_down";
  feedbackReason?: string;
  latencyMs?: number;
  errored?: boolean;
  errorMessage?: string;
}

export interface FilterState {
  jurisdiction?: string;
  topic?: string;
}

export interface MetaFiltersResponse {
  jurisdictions: Array<{
    id: string;
    name: string;
    hasDocuments: boolean;
  }>;
  topics: Array<{
    id: string;
    name: string;
  }>;
  allActiveDocumentsVerified?: boolean;
  hasSampleOrUnverifiedData?: boolean;
  totalActiveDocuments?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  filters?: FilterState;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  uptime: number;
  timestamp: string;
  version: string;
  dependencies: {
    database: {
      status: "up" | "down";
      mode: "postgresql" | "in_memory_fallback (dev-only)";
      latencyMs?: number;
      error?: string | null;
    };
    aiService: {
      status: "up" | "down";
      error?: string | null;
    };
  };
  isTestData: boolean;
}

export interface SuggestionItem {
  text: string;
  category: string;
  section?: string;
}

export interface FineResultItem {
  rule: string;
  documentTitle: string;
  chunkText: string;
  fineText: string;
  section: string;
  page?: number;
  sourceUrl?: string | null;
  isTestData?: boolean;
  score: number;
}

export interface FinesSearchResponse {
  query: string;
  grounded: boolean;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  topScore: number;
  containsTestData: boolean;
  count: number;
  results: FineResultItem[];
  didYouMean?: string;
  relatedQuestions?: string[];
  closestTopics?: string[];
}

export interface DocumentItem {
  id: string;
  title: string;
  officialTitle?: string | null;
  documentType?: string;
  notificationNumber?: string | null;
  rawFilename: string | null;
  type: string;
  jurisdiction: string;
  effectiveDate: string;
  sourceUrl: string | null;
  sha256?: string | null;
  verified?: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  lastReviewedAt?: string | null;
  supersededBy?: string | null;
  amends?: string | null;
  status: string;
  chunkCount: number;
  isTestData: boolean;
  indexedAt: string;
}

export interface DocumentsResponse {
  documents: DocumentItem[];
  total: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export interface AdminLoginResponse {
  token: string;
  user: AdminUser;
}

export interface AdminAnalyticsData {
  totalQueries: number;
  answeredQueries: number;
  unansweredQueries: number;
  groundedRate: string;
  feedback: {
    total: number;
    positive: number;
    negative: number;
    satisfactionRate: string;
  };
  vectorIndex: {
    totalVectors: number;
    activeDocuments: number;
    lastReindexAt: string;
  };
}

export interface IngestionStatusResponse {
  id: string;
  status: string;
  chunksCreated?: number;
  totalVectorsInIndex?: number;
  message?: string;
}

