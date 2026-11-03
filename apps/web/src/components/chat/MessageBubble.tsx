import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ShieldCheck,
  User,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  FileCheck2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Message } from "../../types";
import { SourceCard } from "./SourceCard";
import { FeedbackModal } from "./FeedbackModal";
import { QuickAnswerCard } from "./QuickAnswerCard";
import { submitFeedback } from "../../services/api";
import { useChatStore } from "../../store/chatStore";

interface MessageBubbleProps {
  message: Message;
  onSelectPrompt?: (prompt: string) => void;
  onRegenerate?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSelectPrompt,
  onRegenerate,
}) => {
  const isUser = message.role === "user";
  const { anonymousId, setMessageFeedback, openSourceDrawer } = useChatStore();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [targetRating, setTargetRating] = useState<"thumbs_up" | "thumbs_down">("thumbs_up");
  const [copied, setCopied] = useState(false);

  const handleFeedbackClick = (rating: "thumbs_up" | "thumbs_down") => {
    setTargetRating(rating);
    setFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (
    messageId: string,
    rating: "thumbs_up" | "thumbs_down",
    reason: string
  ) => {
    const prevFeedback = message.feedback;
    const prevReason = message.feedbackReason;

    // Optimistic update
    setMessageFeedback(messageId, rating, reason);

    try {
      await submitFeedback({
        messageId,
        rating,
        reason,
        anonymousId,
      });
    } catch {
      // Rollback on failure
      setMessageFeedback(messageId, prevFeedback as any, prevReason);
      alert("Failed to submit feedback. Please try again.");
    }
  };

  // User Message
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-in fade-in-50 duration-150">
        <div className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%]">
          <div className="bg-accent-primary text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs">
            <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-medium">
              {message.content}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted flex-shrink-0 mt-0.5 shadow-2xs">
            <User className="w-4 h-4 text-text-secondary" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  // Strip any legacy test data notice block from copy or display
  const cleanMarkdownContent = (content: string) => {
    return content
      .replace(/>\s*⚠️\s*\*\*TEST DATA NOTICE\*\*:[^\n]*\n?/gi, "")
      .replace(/>\s*Answers below are derived from synthetic[^\n]*\n?/gi, "")
      .trim();
  };

  const isLowConfidenceOrUngrounded =
    message.grounded === false || message.confidenceTier === "LOW";

  const handleCopyCleanText = async () => {
    try {
      const cleanText = cleanMarkdownContent(message.content);
      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const primarySource = message.sources && message.sources.length > 0 ? message.sources[0] : null;

  return (
    <div className="flex justify-start mb-6 animate-in fade-in-50 duration-200">
      <div className="flex items-start gap-3 max-w-[95%] sm:max-w-[85%] w-full">
        {/* Assistant Avatar */}
        <div className="w-8 h-8 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center flex-shrink-0 mt-1 shadow-2xs border border-accent-primary/20">
          <ShieldCheck className="w-4 h-4 text-accent-primary" aria-hidden="true" />
        </div>

        {/* Message Container */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 1. Quick Answer Card (Executive Highlights at a Glance) */}
          {message.card && (
            <QuickAnswerCard
              card={message.card}
              sources={message.sources}
              allVerified={message.allVerified}
              anyUnverifiedOrSample={message.anyUnverifiedOrSample}
              isReviewDue={message.isReviewDue}
              latencyMs={message.latencyMs}
              feedback={message.feedback}
              onFeedbackClick={handleFeedbackClick}
              onRegenerate={onRegenerate}
              onSelectPrompt={onSelectPrompt}
            />
          )}

          {/* 2. Comprehensive Detailed Statutory Analysis Body */}
          {(message.content || !message.card) && (
            <div className="bg-bg-card border border-border-subtle rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-xs space-y-4">
              {/* Out-of-Scope / Ungrounded Fallback Notice */}
              {isLowConfidenceOrUngrounded && !message.isStreaming && (
                <div className="rounded-xl bg-status-warning-bg border border-status-warning-border p-3.5 flex items-start gap-3 text-xs text-status-warning-text">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Out-of-Scope or Low Statutory Grounding
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      The query did not meet the similarity threshold against our indexed statutory provisions
                      (Motor Vehicles Act 1988, 2019 Amendments &amp; CMVR 1989).
                    </p>
                  </div>
                </div>
              )}

              {/* Markdown Content */}
              {message.content && (
                <div className="prose-legal">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-primary underline hover:text-accent-hover inline-flex items-center gap-0.5"
                        >
                          <span>{props.children}</span>
                          <ExternalLink className="w-3 h-3 inline" aria-hidden="true" />
                        </a>
                      ),
                    }}
                  >
                    {cleanMarkdownContent(message.content)}
                  </ReactMarkdown>

                  {message.isStreaming && (
                    <span
                      className="inline-block w-2 h-4 ml-1 bg-accent-primary rounded-xs animate-pulse-subtle align-middle"
                      aria-label="Generating response..."
                    />
                  )}
                </div>
              )}

              {/* Compact Source and Currency Line under answer (shown if card not present) */}
              {primarySource && !message.card && !message.isStreaming && (
                <div className="pt-3 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-secondary">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
                    <span className="font-semibold text-text-primary">Source:</span>
                    <span>{primarySource.officialTitle || primarySource.documentTitle}, {primarySource.section}</span>
                    <span className="text-border-strong hidden sm:inline">|</span>
                    <span>In force from {primarySource.effectiveDate || "2019-09-01"}</span>
                    <span className="text-border-strong hidden sm:inline">|</span>
                    <span>Last reviewed {primarySource.lastReviewedAt || "Current"}</span>
                    <span className="text-border-strong hidden sm:inline">|</span>
                    <span>{primarySource.jurisdiction || "Central"}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {message.allVerified ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success-text border border-status-success-border"
                        title={`Verified against official gazette${primarySource.verifiedAt ? ` on ${primarySource.verifiedAt}` : ""}`}
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

                    {message.isReviewDue && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-warning-bg text-status-warning-text border border-status-warning-border"
                        title="Statutory review cycle is due for this provision"
                      >
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        <span>Review due</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => openSourceDrawer(primarySource)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-accent-primary hover:bg-accent-light/50 transition-colors"
                      aria-label="View source in drawer"
                    >
                      <span>View source</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* Statutory Citations Cards */}
              {message.sources && message.sources.length > 0 && !message.card && (
                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                    Statutory Citations ({message.sources.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {message.sources.map((src, idx) => (
                      <SourceCard key={`${src.section}-${idx}`} source={src} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action row with copy, latency, feedback (shown if card not present) */}
              {!message.card && !message.isStreaming && message.id && (
                <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopyCleanText}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-secondary text-text-secondary transition-colors text-[11px]"
                      title="Copy plain text"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {message.latencyMs !== undefined && (
                      <span className="text-[11px] text-text-muted">
                        {message.latencyMs}ms
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleFeedbackClick("thumbs_up")}
                      className={`p-1.5 rounded-md hover:bg-bg-secondary transition-colors focus-visible:ring-1 focus-visible:ring-accent-primary min-h-[32px] min-w-[32px] flex items-center justify-center ${
                        message.feedback === "thumbs_up"
                          ? "text-emerald-600 bg-status-success-bg font-bold"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                      aria-label="Thumbs up - accurate response"
                      title="Mark as helpful"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFeedbackClick("thumbs_down")}
                      className={`p-1.5 rounded-md hover:bg-bg-secondary transition-colors focus-visible:ring-1 focus-visible:ring-accent-primary min-h-[32px] min-w-[32px] flex items-center justify-center ${
                        message.feedback === "thumbs_down"
                          ? "text-rose-600 bg-status-danger-bg font-bold"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                      aria-label="Thumbs down - inaccurate or missing penalty"
                      title="Report inaccuracy"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Closest Topics (Fallback) */}
          {message.closestTopics && message.closestTopics.length > 0 && !message.isStreaming && (
            <div className="p-3 bg-bg-card border border-border-subtle rounded-xl">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block mb-2">
                Available Statutory Categories:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.closestTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => onSelectPrompt?.(`What are the rules regarding ${topic}?`)}
                    className="px-2.5 py-1 rounded-md text-xs bg-bg-secondary text-text-secondary hover:text-accent-primary hover:bg-bg-card border border-border-subtle transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Related / Follow-up Suggested Questions */}
          {message.relatedQuestions && message.relatedQuestions.length > 0 && !message.isStreaming && (
            <div className="p-3 bg-bg-card border border-border-subtle rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Sparkles className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Recommended Follow-up Questions:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.relatedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSelectPrompt?.(q)}
                    className="text-left px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-secondary/70 hover:bg-accent-light/50 hover:text-accent-primary hover:border-accent-primary/40 border border-border-subtle transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        messageId={message.id}
        rating={targetRating}
        initialReason={message.feedbackReason}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};
