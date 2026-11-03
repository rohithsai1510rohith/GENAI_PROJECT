import React, { useState } from "react";
import {
  Scale,
  FileText,
  Calendar,
  MessageSquare,
  Copy,
  Check,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { FineResultItem } from "../../types";

interface FineResultCardProps {
  item: FineResultItem;
  onInspect: (item: FineResultItem) => void;
  onAskAssistant: (query: string) => void;
}

export const FineResultCard: React.FC<FineResultCardProps> = ({
  item,
  onInspect,
  onAskAssistant,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCitation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${item.rule} - ${item.documentTitle}\n${item.fineText}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <article
      className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs hover:shadow-md hover:border-accent-primary/40 transition-all duration-200 flex flex-col justify-between group"
      aria-labelledby={`fine-rule-${item.section.replace(/\s+/g, "-")}`}
    >
      <div className="space-y-3.5">
        {/* Top Badges & Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-light text-accent-primary font-semibold text-xs border border-accent-primary/20">
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            <span id={`fine-rule-${item.section.replace(/\s+/g, "-")}`}>
              {item.section || "Statutory Rule"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-text-muted text-xs">
            {item.page && <span>Page {item.page}</span>}
            <span className="text-[11px] px-2 py-0.5 rounded bg-bg-secondary text-text-secondary font-medium">
              Match {(item.score * 100).toFixed(0)}%
            </span>
            {(!item.chunkText || item.chunkText.toLowerCase().includes(item.fineText.toLowerCase().trim())) && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-medium inline-flex items-center gap-0.5">
                <Check className="w-3 h-3 text-emerald-600" />
                Verbatim
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-text-primary group-hover:text-accent-primary transition-colors leading-snug">
          {item.rule}
        </h3>

        {/* Dynamic Legal Excerpt / Penalty Text */}
        <div className="bg-bg-secondary/60 border border-border-subtle rounded-lg p-3 text-xs sm:text-sm text-text-secondary leading-relaxed font-normal">
          <p className="line-clamp-4 whitespace-pre-wrap">{item.fineText}</p>
        </div>

        {/* Document Origin & Date */}
        <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-text-muted pt-1">
          <div className="flex items-center gap-1 min-w-0">
            <FileText className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
            <span className="truncate max-w-[220px]" title={item.documentTitle}>
              {item.documentTitle}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            <span>Official Gazette</span>
          </div>
        </div>

        {/* Test Data Flag */}
        {item.isTestData && (
          <div className="flex items-center gap-1.5 text-status-warning-text bg-status-warning-bg/60 border border-status-warning-border px-2.5 py-1 rounded text-[11px] font-medium">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Sample Test Provision (Fictionalized record)</span>
          </div>
        )}
      </div>

      {/* Action Strip */}
      <div className="pt-4 mt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onInspect(item)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-primary hover:text-accent-hover transition-colors py-1 focus-visible:ring-2 focus-visible:ring-accent-primary rounded"
        >
          <span>Inspect Full Clause</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCitation}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-secondary text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
            title="Copy statutory citation"
            aria-label="Copy citation"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Citation</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onAskAssistant(`What are the penalties and rules under ${item.section}?`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-white text-xs font-medium transition-colors shadow-2xs focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </div>
      </div>
    </article>
  );
};
