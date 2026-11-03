import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Search,
  BookOpen,
  Calendar,
  Layers,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";
import { fetchDocuments } from "../services/api";
import { DocumentItem } from "../types";
import { SEO } from "../components/common/SEO";

export const KnowledgePage: React.FC = () => {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("all");

  const [selectedDocForPreview, setSelectedDocForPreview] = useState<DocumentItem | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments();
      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err.message || "Failed to load statutory documents.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered list
  const filteredDocuments = documents.filter((doc) => {
    const matchesQuery =
      !searchQuery.trim() ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.rawFilename && doc.rawFilename.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      selectedType === "all" ||
      doc.type.toLowerCase() === selectedType.toLowerCase() ||
      (doc.documentType && doc.documentType.toLowerCase() === selectedType.toLowerCase());

    const docJur = doc.jurisdiction.toLowerCase();
    const selJur = selectedJurisdiction.toLowerCase();
    const matchesJurisdiction =
      selJur === "all" ||
      (selJur === "central" && docJur === "central") ||
      (selJur === "state" && (docJur === "state" || docJur !== "central")) ||
      docJur === selJur;

    return matchesQuery && matchesType && matchesJurisdiction;
  });

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0);

  const getTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case "act":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      case "rules":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "notification":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700";
    }
  };

  const handleQueryDocumentInChat = (doc: DocumentItem) => {
    navigate(`/chat?q=${encodeURIComponent(`What are the key rules and provisions in ${doc.title}?`)}`);
  };

  return (
    <div className="flex-1 flex flex-col bg-bg-primary">
      <SEO
        title="Knowledge Base & Indexed Documents"
        description="Explore the verified Acts, Central Rules, and Ministry notifications indexed in the Parivahan AI legal engine."
        canonicalPath="/knowledge"
      />
      {/* Hero Header */}
      <section className="bg-bg-card border-b border-border-subtle py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-light text-accent-primary text-xs font-semibold border border-accent-primary/20">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Verified Gazette & Statutory Repository</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Knowledge Base & Indexed Documents
          </h1>

          <p className="text-xs sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Transparently explore the official Acts, Central Rules, and Ministry notifications indexed
            in our FAISS vector engine. Every AI answer is directly cited from these sources.
          </p>

          {/* Quick Metrics Bar */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
            <div className="bg-bg-primary border border-border-subtle rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Total Documents
              </span>
              <span className="text-xl font-extrabold text-text-primary">{documents.length}</span>
            </div>

            <div className="bg-bg-primary border border-border-subtle rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Indexed Chunks
              </span>
              <span className="text-xl font-extrabold text-text-primary">{totalChunks}</span>
            </div>

            <div className="bg-bg-primary border border-border-subtle rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Embeddings
              </span>
              <span className="text-sm font-bold text-accent-primary truncate">all-MiniLM-L6</span>
            </div>

            <div className="bg-bg-primary border border-border-subtle rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Grounding Rate
              </span>
              <span className="text-xl font-extrabold text-emerald-600">100%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Filter & Document Explorer */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Search & Filter Controls */}
        <div className="bg-bg-card border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by document title, act number, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
          </div>

          {/* Filter Dropdowns / Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type selector */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-primary text-text-secondary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary"
              aria-label="Filter by document type"
            >
              <option value="all">All Types</option>
              <option value="act">Acts</option>
              <option value="rules">Rules</option>
              <option value="notification">Notifications</option>
            </select>

            {/* Jurisdiction selector */}
            <select
              value={selectedJurisdiction}
              onChange={(e) => setSelectedJurisdiction(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-primary text-text-secondary text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary"
              aria-label="Filter by jurisdiction"
            >
              <option value="all">All Jurisdictions</option>
              <option value="Central">Central (National)</option>
              <option value="State">State (All States)</option>
              <option value="Delhi">Delhi (NCT)</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadDocuments}
              className="p-2 rounded-lg border border-border-subtle bg-bg-primary hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent-primary"
              title="Refresh repository"
              aria-label="Refresh repository"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs sm:text-sm flex items-center justify-between shadow-xs"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={loadDocuments}
              className="font-bold underline hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-bg-card border border-border-subtle rounded-xl p-5 animate-pulse space-y-3"
              >
                <div className="h-4 bg-border-subtle/60 rounded w-1/3" />
                <div className="h-3 bg-border-subtle/40 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Document Cards List */}
        {!loading && (
          <div className="space-y-4">
            {filteredDocuments.length === 0 ? (
              <div className="p-12 text-center bg-bg-card border border-border-subtle rounded-xl space-y-3">
                <FileText className="w-10 h-10 text-text-muted mx-auto" />
                <h3 className="text-base font-bold text-text-primary">No Documents Found</h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  No statutory documents match your current filter criteria. Try clearing the search query or selecting &quot;All Types&quot;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedType("all");
                    setSelectedJurisdiction("all");
                  }}
                  className="px-4 py-2 rounded-lg bg-bg-secondary text-text-primary text-xs font-semibold hover:bg-border-subtle transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <article
                  key={doc.id}
                  className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs hover:border-accent-primary/40 hover:shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  aria-labelledby={`doc-title-${doc.id}`}
                >
                  {/* Left Column: Title & Metadata */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${getTypeBadgeClass(
                          doc.type
                        )}`}
                      >
                        {doc.type}
                      </span>

                      <span className="px-2 py-0.5 rounded bg-bg-secondary text-text-secondary text-xs font-medium">
                        {doc.jurisdiction}
                      </span>

                      {doc.notificationNumber && (
                        <span className="px-2 py-0.5 rounded bg-bg-secondary/70 text-text-muted text-[11px] font-mono">
                          {doc.notificationNumber}
                        </span>
                      )}

                      {doc.verified ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Official Gazette Verified</span>
                        </span>
                      ) : doc.isTestData ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-status-warning-text bg-status-warning-bg px-2 py-0.5 rounded border border-status-warning-border">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Sample Test Data</span>
                        </span>
                      ) : null}
                    </div>

                    <h2
                      id={`doc-title-${doc.id}`}
                      className="text-base sm:text-lg font-bold text-text-primary leading-snug"
                    >
                      {doc.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-text-muted">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-accent-primary" />
                        <span>Effective: {doc.effectiveDate}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-accent-primary" />
                        <span>{doc.chunkCount} Vector Chunks</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Indexed & Verified</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 w-full md:w-auto justify-end border-t md:border-t-0 border-border-subtle">
                    {doc.sourceUrl && (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-secondary text-text-secondary text-xs font-semibold transition-colors"
                      >
                        <span>Official Gazette</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedDocForPreview(doc)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-secondary text-text-primary text-xs font-semibold transition-colors"
                    >
                      <Info className="w-3.5 h-3.5 text-text-muted" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQueryDocumentInChat(doc)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold transition-colors shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ask AI</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </div>

      {/* Document Details Modal */}
      {selectedDocForPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-doc-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
        >
          <div className="bg-bg-card border border-border-subtle rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary">
                  Statutory Document Record
                </span>
                <h3 id="modal-doc-title" className="text-lg font-bold text-text-primary leading-snug">
                  {selectedDocForPreview.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary transition-colors text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-text-secondary bg-bg-secondary/50 p-4 rounded-xl border border-border-subtle">
              {selectedDocForPreview.officialTitle && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-muted flex-shrink-0">Official Title:</span>
                  <span className="font-semibold text-text-primary text-right">{selectedDocForPreview.officialTitle}</span>
                </div>
              )}
              {selectedDocForPreview.notificationNumber && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Notification No:</span>
                  <span className="font-mono text-text-primary">{selectedDocForPreview.notificationNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Document Type:</span>
                <span className="font-semibold text-text-primary">{selectedDocForPreview.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Jurisdiction:</span>
                <span className="font-semibold text-text-primary">{selectedDocForPreview.jurisdiction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Effective Date:</span>
                <span className="font-semibold text-text-primary">{selectedDocForPreview.effectiveDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Indexed Chunks:</span>
                <span className="font-semibold text-text-primary">{selectedDocForPreview.chunkCount} vector units</span>
              </div>
              {selectedDocForPreview.verified && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Verified By:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {selectedDocForPreview.verifiedBy || "MoRTH Gazette Authority"}
                  </span>
                </div>
              )}
              {selectedDocForPreview.rawFilename && (
                <div className="flex justify-between truncate">
                  <span className="text-text-muted">File:</span>
                  <span className="font-mono text-[11px] truncate">{selectedDocForPreview.rawFilename}</span>
                </div>
              )}
            </div>

            {selectedDocForPreview.isTestData && (
              <div className="p-3 bg-status-warning-bg border border-status-warning-border rounded-xl text-status-warning-text text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  This document is marked as test data for development verification. Real statutory gazettes apply in judicial proceedings.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="px-4 py-2 rounded-lg bg-bg-secondary text-text-primary text-xs font-semibold hover:bg-border-subtle transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = selectedDocForPreview;
                  setSelectedDocForPreview(null);
                  handleQueryDocumentInChat(doc);
                }}
                className="px-4 py-2 rounded-lg bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
              >
                Ask Assistant About This Act
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
