import React from "react";
import { Scale, ExternalLink, ChevronRight, AlertTriangle } from "lucide-react";
import { SourceItem } from "../../types";
import { useChatStore } from "../../store/chatStore";

interface SourceCardProps {
  source: SourceItem;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  const { openSourceDrawer } = useChatStore();

  const scorePct = Math.round(source.score * 100);

  const getConfidenceClasses = (score: number) => {
    if (score >= 0.52) {
      return {
        badge: "bg-status-success-bg text-status-success-text border-status-success-border",
        label: "High Confidence",
      };
    }
    if (score >= 0.35) {
      return {
        badge: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
        label: "Medium Confidence",
      };
    }
    return {
      badge: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
      label: "Low Confidence",
    };
  };

  const confidence = getConfidenceClasses(source.score);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openSourceDrawer(source)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSourceDrawer(source);
        }
      }}
      className="group text-left p-3.5 rounded-xl border border-border-subtle bg-bg-card hover:bg-bg-card-subtle hover:border-accent-primary/50 transition-all cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-accent-primary"
      aria-label={`Inspect source clause: ${source.section} in ${source.documentTitle}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Scale className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" aria-hidden="true" />
          <h4 className="text-xs font-bold text-text-primary truncate">
            {source.section || "Statutory Provision"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confidence.badge}`}
          >
            {scorePct}% match
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary transition-colors" />
        </div>
      </div>

      <p className="text-[11px] text-text-muted truncate mb-2">
        {source.documentTitle}
        {source.page && ` \u00B7 Page ${source.page}`}
      </p>

      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed bg-bg-secondary/40 p-2 rounded-md font-mono text-[11px]">
        {source.excerpt}
      </p>

      {source.isTestData && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          <span>Sample test data source</span>
        </div>
      )}
    </div>
  );
};
