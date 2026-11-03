import React, { useEffect, useState } from "react";
import { Filter, ChevronDown, Check } from "lucide-react";
import { useChatStore } from "../../store/chatStore";
import { fetchMetaFilters } from "../../services/api";
import { MetaFiltersResponse } from "../../types";

export const FilterBar: React.FC = () => {
  const { filters, setFilters } = useChatStore();
  const [meta, setMeta] = useState<MetaFiltersResponse | null>(null);
  const [jurOpen, setJurOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchMetaFilters()
      .then((data) => {
        if (mounted) setMeta(data);
      })
      .catch(() => {
        // Fallback default
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentJur = filters.jurisdiction || "All";
  const currentTopic = filters.topic || "All";

  return (
    <div className="py-2.5 px-4 bg-bg-card border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-text-muted">
        <Filter className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wider text-[11px]">Filters:</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Jurisdiction Filter Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setJurOpen(!jurOpen);
              setTopicOpen(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-card-subtle hover:bg-bg-secondary text-text-primary text-xs font-medium focus-visible:ring-1 focus-visible:ring-accent-primary min-h-[34px]"
            aria-expanded={jurOpen}
            aria-haspopup="listbox"
          >
            <span className="text-text-muted">Jurisdiction:</span>
            <span className="font-semibold text-accent-primary">
              {currentJur === "All" ? "All (National + States)" : currentJur}
            </span>
            <ChevronDown className="w-3 h-3 text-text-muted" aria-hidden="true" />
          </button>

          {jurOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setJurOpen(false)} />
              <div
                role="listbox"
                className="absolute left-0 mt-1.5 w-60 rounded-xl bg-bg-popover border border-border-subtle shadow-lg z-30 py-1 max-h-64 overflow-y-auto"
              >
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ jurisdiction: "All" });
                    setJurOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-bg-secondary transition-colors ${
                    currentJur === "All" ? "text-accent-primary font-semibold bg-accent-light/40" : "text-text-primary"
                  }`}
                >
                  <span>All (National &amp; States)</span>
                  {currentJur === "All" && <Check className="w-3.5 h-3.5 text-accent-primary" />}
                </button>

                {meta?.jurisdictions.map((j) => {
                  const isSelected = currentJur.toLowerCase() === j.id.toLowerCase();
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => {
                        setFilters({ jurisdiction: j.id });
                        setJurOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-bg-secondary transition-colors ${
                        isSelected ? "text-accent-primary font-semibold bg-accent-light/40" : "text-text-primary"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{j.name}</span>
                        {!j.hasDocuments && (
                          <span className="text-[10px] text-text-muted">(No specific state docs indexed)</span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Topic Filter Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setTopicOpen(!topicOpen);
              setJurOpen(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-card-subtle hover:bg-bg-secondary text-text-primary text-xs font-medium focus-visible:ring-1 focus-visible:ring-accent-primary min-h-[34px]"
            aria-expanded={topicOpen}
            aria-haspopup="listbox"
          >
            <span className="text-text-muted">Topic:</span>
            <span className="font-semibold text-accent-primary">
              {currentTopic === "All" ? "All Statutory Topics" : currentTopic}
            </span>
            <ChevronDown className="w-3 h-3 text-text-muted" aria-hidden="true" />
          </button>

          {topicOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setTopicOpen(false)} />
              <div
                role="listbox"
                className="absolute right-0 mt-1.5 w-64 rounded-xl bg-bg-popover border border-border-subtle shadow-lg z-30 py-1 max-h-64 overflow-y-auto"
              >
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ topic: "All" });
                    setTopicOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-bg-secondary transition-colors ${
                    currentTopic === "All" ? "text-accent-primary font-semibold bg-accent-light/40" : "text-text-primary"
                  }`}
                >
                  <span>All Statutory Topics</span>
                  {currentTopic === "All" && <Check className="w-3.5 h-3.5 text-accent-primary" />}
                </button>

                {meta?.topics.map((t) => {
                  const isSelected = currentTopic.toLowerCase() === t.id.toLowerCase();
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setFilters({ topic: t.id });
                        setTopicOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-bg-secondary transition-colors ${
                        isSelected ? "text-accent-primary font-semibold bg-accent-light/40" : "text-text-primary"
                      }`}
                    >
                      <span>{t.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
