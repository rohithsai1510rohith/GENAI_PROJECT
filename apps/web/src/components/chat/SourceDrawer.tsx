import React, { useEffect, useRef } from "react";
import { X, ExternalLink, Scale, AlertTriangle, FileText, Calendar, MapPin, Copy, Check, CheckCircle2 } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export const SourceDrawer: React.FC = () => {
  const { activeSourceForDrawer, closeSourceDrawer } = useChatStore();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Focus trap & Escape key handling
  useEffect(() => {
    if (!activeSourceForDrawer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSourceDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSourceForDrawer, closeSourceDrawer]);

  if (!activeSourceForDrawer) return null;

  const source = activeSourceForDrawer;
  const chunkText = source.chunkText || source.excerpt;
  const cleanExcerpt = source.excerpt.replace(/\.\.\.$/, "").trim();

  // Highlight excerpt inside chunkText if present
  const renderHighlightedContent = () => {
    if (!cleanExcerpt || !chunkText.includes(cleanExcerpt)) {
      return (
        <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-text-primary leading-relaxed">
          {chunkText}
        </pre>
      );
    }

    const startIndex = chunkText.indexOf(cleanExcerpt);
    const before = chunkText.slice(0, startIndex);
    const matched = chunkText.slice(startIndex, startIndex + cleanExcerpt.length);
    const after = chunkText.slice(startIndex + cleanExcerpt.length);

    return (
      <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-text-primary leading-relaxed">
        {before}
        <mark className="bg-amber-100 dark:bg-amber-900/50 text-text-primary px-1 py-0.5 rounded font-medium border-l-2 border-accent-primary">
          {matched}
        </mark>
        {after}
      </div>
    );
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(chunkText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={closeSourceDrawer}
        aria-hidden="true"
      />

      {/* Slide-in Panel */}
      <div
        ref={drawerRef}
        className="relative w-full max-w-lg md:max-w-xl bg-bg-card border-l border-border-subtle shadow-drawer h-full flex flex-col z-10 animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-start justify-between gap-3 bg-bg-card">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent-light text-accent-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <Scale className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-accent-primary block">
                Statutory Clause Citation
              </span>
              <h2
                id="source-drawer-title"
                className="text-sm sm:text-base font-bold text-text-primary leading-snug line-clamp-2"
              >
                {source.section || "Statutory Clause"}
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSourceDrawer}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-accent-primary min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Close clause drawer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Metadata Strip */}
        <div className="px-5 py-3 bg-bg-secondary/40 border-b border-border-subtle grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-text-muted truncate">
            <FileText className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
            <span className="truncate">{source.documentTitle}</span>
          </div>

          <div className="flex items-center gap-1.5 text-text-muted">
            <MapPin className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
            <span>Jurisdiction: {source.jurisdiction || "Central (National)"}</span>
          </div>

          {source.page && (
            <div className="flex items-center gap-1.5 text-text-muted">
              <span>Page number: {source.page}</span>
            </div>
          )}

          {source.effectiveDate && (
            <div className="flex items-center gap-1.5 text-text-muted">
              <Calendar className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
              <span>Effective: {source.effectiveDate}</span>
            </div>
          )}
        </div>

        {/* Verification Status Header */}
        {source.verified ? (
          <div className="px-5 py-2.5 bg-status-success-bg border-b border-status-success-border text-status-success-text flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
            <span>
              Official Statutory Enactment authenticated against the Gazette of India.
            </span>
          </div>
        ) : source.isTestData ? (
          <div className="px-5 py-2.5 bg-status-warning-bg border-b border-status-warning-border text-status-warning-text flex items-center gap-2 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>
              This chunk belongs to a synthetic test record. Verified statutory provisions may differ in gazette wording.
            </span>
          </div>
        ) : null}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Full Statutory Clause Text:
            </span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors border border-border-subtle"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-bg-card-subtle p-4 rounded-xl border border-border-subtle overflow-x-auto shadow-2xs">
            {renderHighlightedContent()}
          </div>
        </div>

        {/* Drawer Footer with Official Source Link */}
        <div className="p-4 sm:p-5 border-t border-border-subtle bg-bg-card flex items-center justify-between gap-3">
          {source.sourceUrl ? (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-primary hover:text-accent-hover hover:underline"
            >
              <span>View Official Transport Source</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-xs text-text-muted">Source: Ministry of Road Transport and Highways</span>
          )}

          <button
            type="button"
            onClick={closeSourceDrawer}
            className="px-4 py-2 rounded-lg bg-bg-secondary hover:bg-border-subtle text-text-primary text-xs font-medium transition-colors min-h-[38px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
