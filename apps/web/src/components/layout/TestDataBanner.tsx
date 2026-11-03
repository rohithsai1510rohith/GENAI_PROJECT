import React, { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { fetchMetaFilters } from "../../services/api";

export const TestDataBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState<boolean>(true); // default true for safety

  useEffect(() => {
    let mounted = true;
    fetchMetaFilters()
      .then((meta) => {
        if (mounted) {
          // Banner shows only while any active document is unverified or sample
          setShowBanner(meta.hasSampleOrUnverifiedData ?? true);
        }
      })
      .catch(() => {
        // Keep true on error
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      role="alert"
      aria-label="Test Data Notice"
      className="bg-status-warning-bg border-b border-status-warning-border text-status-warning-text px-4 py-2 text-xs md:text-sm font-medium transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>
            <strong>TEST DATA ACTIVE:</strong> Knowledge base contains unverified sample test documents for system evaluation.
            Answers are for technical verification, not formal legal counsel.
          </span>
        </div>
        <a
          href="https://parivahan.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline hover:text-amber-900 dark:hover:text-amber-200 flex-shrink-0 focus-visible:ring-1 focus-visible:ring-amber-500 rounded"
        >
          <span>Official Portal</span>
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
};
