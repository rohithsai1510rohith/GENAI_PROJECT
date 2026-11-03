import React from "react";
import { DescriptionObj, SourceItem } from "../../types";
import { FileText, CheckCircle2, AlertOctagon, Link2, Quote } from "lucide-react";

interface DetailsPanelProps {
  id: string;
  isOpen: boolean;
  description: DescriptionObj;
  sources?: SourceItem[];
  onSelectSection?: (section: string) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  id,
  isOpen,
  description,
  sources = [],
  onSelectSection,
}) => {
  if (!isOpen) return null;

  const {
    explanation,
    clauseText,
    conditions = [],
    exceptions = [],
    relatedSections = [],
  } = description;

  // Primary source for clause display
  const primarySource = sources[0];

  return (
    <div
      id={id}
      role="region"
      aria-label="Detailed Statutory Description"
      className="mt-3 pt-3 border-t border-border-subtle space-y-4 animate-in fade-in-50 duration-200"
    >
      {/* 1. Plain-Language Explanation */}
      {explanation && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <FileText className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
            <span>Statutory Overview</span>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed bg-bg-secondary/40 p-3 rounded-xl border border-border-subtle">
            {explanation}
          </p>
        </div>
      )}

      {/* 2. Exact Statutory Clause Quote */}
      {clauseText && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
            <span className="flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
              <span>Verbatim Clause Text {primarySource?.section ? `(${primarySource.section})` : ""}</span>
            </span>
            {primarySource?.documentTitle && (
              <span className="text-[10px] text-text-muted font-normal truncate max-w-[200px]">
                {primarySource.documentTitle}
              </span>
            )}
          </div>
          <blockquote className="text-xs text-text-primary bg-bg-card border-l-4 border-accent-primary p-3 rounded-r-xl shadow-2xs font-mono whitespace-pre-wrap leading-relaxed">
            {clauseText}
          </blockquote>
        </div>
      )}

      {/* 3. Conditions & Prerequisites */}
      {conditions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Statutory Conditions &amp; Criteria</span>
          </div>
          <ul className="space-y-1 pl-1">
            {conditions.map((cond, idx) => (
              <li key={idx} className="text-xs text-text-secondary flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span className="leading-relaxed">{cond}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Statutory Exceptions */}
      {exceptions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>Exemptions &amp; Safe Harbors</span>
          </div>
          <ul className="space-y-1 pl-1">
            {exceptions.map((exc, idx) => (
              <li key={idx} className="text-xs text-text-secondary flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <span className="leading-relaxed">{exc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Related Statutory Sections */}
      {relatedSections.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Link2 className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
            <span>Related Provisions &amp; Enactments</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {relatedSections.map((sec, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSection?.(`What is stated in ${sec}?`)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-bg-secondary text-text-secondary hover:text-accent-primary hover:bg-bg-card border border-border-subtle transition-colors"
                title={`Ask about ${sec}`}
              >
                <span>{sec}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

