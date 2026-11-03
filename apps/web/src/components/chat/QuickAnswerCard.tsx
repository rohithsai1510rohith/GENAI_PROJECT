import React, { useState } from "react";
import {
  QuickAnswerCardData,
  SourceItem,
} from "../../types";
import { DetailsPanel } from "./DetailsPanel";
import { useChatStore } from "../../store/chatStore";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Hash,
  Scale,
  Calendar,
  AlertCircle,
  FileCheck2,
} from "lucide-react";

interface QuickAnswerCardProps {
  card: QuickAnswerCardData;
  sources?: SourceItem[];
  allVerified?: boolean;
  anyUnverifiedOrSample?: boolean;
  isReviewDue?: boolean;
  latencyMs?: number;
  feedback?: "thumbs_up" | "thumbs_down";
  onFeedbackClick?: (rating: "thumbs_up" | "thumbs_down") => void;
  onRegenerate?: () => void;
  onSelectPrompt?: (prompt: string) => void;
  initialExpanded?: boolean;
}

export const QuickAnswerCard: React.FC<QuickAnswerCardProps> = ({
  card,
  sources = [],
  allVerified = false,
  anyUnverifiedOrSample = true,
  isReviewDue = false,
  latencyMs,
  feedback,
  onFeedbackClick,
  onRegenerate,
  onSelectPrompt,
  initialExpanded = false,
}) => {
  const { openSourceDrawer, briefMode } = useChatStore();
  const [detailsOpen, setDetailsOpen] = useState(
    initialExpanded !== undefined ? initialExpanded : !briefMode
  );
  const [copied, setCopied] = useState(false);

  const {
    headline,
    keyFacts = [],
    keywords = [],
    description,
    notStated = [],
    sourceLine,
  } = card;

  // Active primary source
  const primarySource = sources[0] || (sourceLine ? {
    documentTitle: sourceLine.title,
    officialTitle: sourceLine.title,
    section: sourceLine.section,
    effectiveDate: sourceLine.effectiveDate,
    jurisdiction: sourceLine.jurisdiction,
    sourceUrl: null,
    verified: sourceLine.verified,
    chunkText: "",
    excerpt: "",
    score: 1.0,
  } : null);

  // Copy clean plain-text answer without markdown or test notice
  const handleCopyPlainText = async () => {
    try {
      const factLines = keyFacts.map((kf) => `• ${kf.label}: ${kf.value}`).join("\n");
      const srcText = `Source: ${sourceLine?.title || primarySource?.documentTitle || "Statutory Document"}, ${sourceLine?.section || primarySource?.section || "Provisions"} | In force from ${sourceLine?.effectiveDate || primarySource?.effectiveDate || "2019-09-01"} | ${sourceLine?.jurisdiction || primarySource?.jurisdiction || "Central"}`;
      const plainText = `${headline}\n\n${factLines}\n\n${description?.explanation || ""}\n\n${srcText}\n\n(Informational, not legal advice. Confirm with transport authority.)`;
      await navigator.clipboard.writeText(plainText.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const hasDetails = Boolean(
    description?.explanation ||
    description?.clauseText ||
    (description?.conditions && description.conditions.length > 0) ||
    (description?.exceptions && description.exceptions.length > 0) ||
    (description?.relatedSections && description.relatedSections.length > 0)
  );

  return (
    <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 text-text-primary transition-all">
      {/* 1. Headline */}
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-accent-light text-accent-primary flex items-center justify-center flex-shrink-0 mt-0.5 border border-accent-primary/20">
          <Scale className="w-4 h-4 text-accent-primary" aria-hidden="true" />
        </div>
        <h3 className="text-sm sm:text-base font-bold text-text-primary leading-snug tracking-tight">
          {headline}
        </h3>
      </div>

      {/* 2. Key Facts Grid (2-col desktop, 1-col mobile; semantic accents) */}
      {keyFacts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {keyFacts.map((fact, idx) => {
            const isFine = fact.label.toLowerCase().includes("fine") || fact.label.toLowerCase().includes("penalty");
            const isImprisonment = fact.label.toLowerCase().includes("imprisonment") || fact.label.toLowerCase().includes("jail");
            const isDisqualification = fact.label.toLowerCase().includes("licence") || fact.label.toLowerCase().includes("license");

            let tileClasses = "bg-bg-secondary/60 border-border-subtle text-text-primary";
            let labelClasses = "text-text-muted";
            let valueClasses = "text-text-primary font-semibold";

            if (isFine) {
              tileClasses = "bg-accent-light/40 border-accent-primary/30 text-accent-primary";
              labelClasses = "text-accent-primary/80 font-bold";
              valueClasses = "text-accent-primary font-bold text-sm sm:text-base";
            } else if (isImprisonment) {
              tileClasses = "bg-status-danger-bg/50 border-status-danger-border text-status-danger-text";
              labelClasses = "text-rose-600 dark:text-rose-400 font-bold";
              valueClasses = "text-rose-700 dark:text-rose-300 font-bold";
            } else if (isDisqualification) {
              tileClasses = "bg-status-warning-bg/50 border-status-warning-border text-status-warning-text";
              labelClasses = "text-amber-700 dark:text-amber-300 font-bold";
              valueClasses = "text-amber-800 dark:text-amber-200 font-bold";
            }

            return (
              <div
                key={idx}
                className={`p-2.5 sm:p-3 rounded-xl border transition-colors flex flex-col justify-between ${tileClasses}`}
              >
                <span className={`text-[11px] uppercase tracking-wider block mb-0.5 ${labelClasses}`}>
                  {fact.label}
                </span>
                <span className={`text-xs sm:text-sm leading-snug break-words ${valueClasses}`}>
                  {fact.value}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Keyword Chips */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {keywords.map((kw, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt?.(`What are the regulations concerning ${kw}?`)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-bg-secondary hover:bg-accent-light hover:text-accent-primary text-text-secondary border border-border-subtle transition-colors shadow-2xs"
            >
              <Hash className="w-3 h-3 text-text-muted" aria-hidden="true" />
              <span>{kw}</span>
            </button>
          ))}
        </div>
      )}

      {/* 4. Not Stated Line (if any standard facts were omitted in retrieved text) */}
      {notStated.length > 0 && (
        <div className="text-[11px] text-text-muted flex items-center gap-1.5 px-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" aria-hidden="true" />
          <span>
            <strong className="font-medium">Not specified in cited provisions:</strong> {notStated.join(", ")}
          </span>
        </div>
      )}

      {/* 5. Compact Source and Currency Line with Verification Chips */}
      <div className="pt-3 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-secondary">
        <div className="flex flex-wrap items-center gap-1.5 leading-relaxed text-[11px] sm:text-xs">
          <span className="font-semibold text-text-primary">Source:</span>
          <span>
            {sourceLine?.title || primarySource?.officialTitle || primarySource?.documentTitle || "Statutory Document"}
            {sourceLine?.section || primarySource?.section ? `, ${sourceLine?.section || primarySource?.section}` : ""}
          </span>
          <span className="text-border-strong hidden sm:inline">|</span>
          <span>In force from {sourceLine?.effectiveDate || primarySource?.effectiveDate || "2019-09-01"}</span>
          <span className="text-border-strong hidden sm:inline">|</span>
          <span>Last reviewed {sourceLine?.lastReviewedAt || primarySource?.lastReviewedAt || "Current"}</span>
          <span className="text-border-strong hidden sm:inline">|</span>
          <span className="font-medium text-text-muted">{sourceLine?.jurisdiction || primarySource?.jurisdiction || "Central"}</span>

          {sourceLine?.amendedBy && (
            <span className="text-accent-primary font-medium">
              (Amended by {sourceLine.amendedBy})
            </span>
          )}
        </div>

        {/* Verification Status Chips */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {allVerified && !anyUnverifiedOrSample ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success-text border border-status-success-border"
              title={`Verified against official publication${primarySource?.verifiedAt ? ` on ${primarySource.verifiedAt}` : ""}`}
            >
              <FileCheck2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Verified source</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-warning-bg text-status-warning-text border border-status-warning-border"
              title="Retrieved from test/sample document pending official verification"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>Unverified source</span>
            </span>
          )}

          {isReviewDue && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-warning-bg text-status-warning-text border border-status-warning-border"
              title="Statutory review cycle is due for this provision"
            >
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>Review due</span>
            </span>
          )}

          {primarySource && (
            <button
              type="button"
              onClick={() => openSourceDrawer(primarySource)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-accent-primary hover:bg-accent-light/50 border border-transparent hover:border-accent-primary/20 transition-colors"
              aria-label="View cited source text in drawer"
            >
              <span>View source</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* 6. Expandable Detailed Description Panel */}
      {hasDetails && description && (
        <DetailsPanel
          id="detailed-statutory-panel"
          isOpen={detailsOpen}
          description={description}
          sources={sources}
          onSelectSection={onSelectPrompt}
        />
      )}

      {/* 7. Action Row: Show Details, Copy plain text, Regenerate, Thumbs, Latency */}
      <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          {hasDetails && (
            <button
              type="button"
              onClick={() => setDetailsOpen(!detailsOpen)}
              aria-expanded={detailsOpen}
              aria-controls="detailed-statutory-panel"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-secondary text-text-primary hover:bg-bg-card hover:border-accent-primary/30 border border-border-subtle transition-all shadow-2xs min-h-[32px]"
            >
              {detailsOpen ? (
                <>
                  <span>Hide details</span>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Show details</span>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyPlainText}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-border-subtle transition-colors min-h-[32px]"
            aria-label="Copy plain text response without notices"
            title="Copy plain text"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-600 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>

          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-border-subtle transition-colors min-h-[32px]"
              aria-label="Regenerate statutory answer"
              title="Regenerate"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}
        </div>

        {/* Right Feedback & Latency */}
        <div className="flex items-center gap-3">
          {latencyMs !== undefined && latencyMs > 0 && (
            <span className="text-[11px] text-text-muted">
              {latencyMs}ms
            </span>
          )}

          {onFeedbackClick && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onFeedbackClick("thumbs_up")}
                className={`p-1.5 rounded-md hover:bg-bg-secondary transition-colors focus-visible:ring-1 focus-visible:ring-accent-primary min-h-[32px] min-w-[32px] flex items-center justify-center ${
                  feedback === "thumbs_up"
                    ? "text-emerald-600 bg-status-success-bg font-bold"
                    : "text-text-muted hover:text-text-primary"
                }`}
                aria-label="Thumbs up - accurate penalty details"
                title="Mark as accurate"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onFeedbackClick("thumbs_down")}
                className={`p-1.5 rounded-md hover:bg-bg-secondary transition-colors focus-visible:ring-1 focus-visible:ring-accent-primary min-h-[32px] min-w-[32px] flex items-center justify-center ${
                  feedback === "thumbs_down"
                    ? "text-rose-600 bg-status-danger-bg font-bold"
                    : "text-text-muted hover:text-text-primary"
                }`}
                aria-label="Thumbs down - inaccurate or missing penalty"
                title="Report issue"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

