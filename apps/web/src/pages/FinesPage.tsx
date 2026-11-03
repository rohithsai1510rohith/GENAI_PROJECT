import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  Scale,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { searchFines } from "../services/api";
import { FineResultItem, FinesSearchResponse, SourceItem } from "../types";
import { FineResultCard } from "../components/fines/FineResultCard";
import { useChatStore } from "../store/chatStore";
import { SEO } from "../components/common/SEO";

const POPULAR_VIOLATIONS = [
  { label: "Drunk Driving", query: "drunk driving penalty under Section 185" },
  { label: "Without Helmet", query: "riding without helmet Section 194D" },
  { label: "Triple Riding", query: "triple riding fine Section 194C" },
  { label: "No Driving Licence", query: "driving without valid licence Section 181" },
  { label: "Red Light Jumping", query: "jumping red light dangerous driving Section 184" },
  { label: "Blocking Ambulance", query: "not giving way to ambulance Section 194E" },
  { label: "Uninsured Vehicle", query: "driving uninsured vehicle Section 196" },
  { label: "Goods Overloading", query: "overloading goods vehicle Section 194" },
  { label: "Digital Documents", query: "DigiLocker mParivahan valid under Rule 139" },
];

const CATEGORY_SPOTLIGHTS = [
  {
    title: "Driver Safety & Restraints",
    desc: "Mandatory helmet use, seatbelt compliance, child restraints, and passenger capacity rules.",
    sampleQuery: "helmet and seatbelt mandatory penalties",
    icon: ShieldCheck,
    sections: ["Section 194B", "Section 194C", "Section 194D"],
  },
  {
    title: "Substance & Reckless Driving",
    desc: "Blood alcohol limits (30 mg/100 ml), breathalyzer refusal, speeding, and hazardous driving.",
    sampleQuery: "penalties for drunken driving and speeding",
    icon: Scale,
    sections: ["Section 183", "Section 184", "Section 185"],
  },
  {
    title: "Licensing & Ownership Integrity",
    desc: "Unlicensed driving, minor/juvenile driving liabilities for parents, and disqualified drivers.",
    sampleQuery: "punishment for driving without licence or underage",
    icon: CheckCircle2,
    sections: ["Section 180", "Section 181", "Section 199A"],
  },
];

export const FinesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openSourceDrawer } = useChatStore();

  const urlQuery = searchParams.get("q") || "";
  const urlJurisdiction = searchParams.get("jurisdiction") || "Central";

  const [queryInput, setQueryInput] = useState(urlQuery);
  const [jurisdiction, setJurisdiction] = useState(urlJurisdiction);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] = useState<FinesSearchResponse | null>(null);

  // Sync state if URL changes externally
  useEffect(() => {
    if (urlQuery && urlQuery !== queryInput) {
      setQueryInput(urlQuery);
    }
    if (urlQuery) {
      executeSearch(urlQuery, jurisdiction);
    } else {
      setSearchResponse(null);
    }
  }, [urlQuery, jurisdiction]);

  const executeSearch = async (term: string, jur: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const data = await searchFines(trimmed, jur);
      setSearchResponse(data);
    } catch (err: any) {
      setError(err.message || "Failed to search traffic fines. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    setSearchParams({ q: queryInput.trim(), jurisdiction });
    executeSearch(queryInput.trim(), jurisdiction);
  };

  const handleTagClick = (tagQuery: string) => {
    setQueryInput(tagQuery);
    setSearchParams({ q: tagQuery, jurisdiction });
    executeSearch(tagQuery, jurisdiction);
  };

  const handleInspect = (item: FineResultItem) => {
    const sourceObj: SourceItem = {
      documentTitle: item.documentTitle,
      section: item.section,
      page: item.page,
      chunkText: item.chunkText || item.fineText,
      excerpt: item.fineText,
      score: item.score,
      sourceUrl: item.sourceUrl,
      isTestData: item.isTestData,
    };
    openSourceDrawer(sourceObj);
  };

  const handleAskAssistant = (question: string) => {
    navigate(`/chat?q=${encodeURIComponent(question)}`);
  };

  return (
    <div className="flex-1 flex flex-col bg-bg-primary">
      <SEO
        title="Statutory Fines & Penalties Directory"
        description="Search Indian traffic offences, fines, and legal compounding provisions grounded in the Motor Vehicles Act 2019."
        canonicalPath="/fines"
      />
      {/* Hero Header */}
      <section className="bg-bg-card border-b border-border-subtle py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-light text-accent-primary text-xs font-semibold border border-accent-primary/20">
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Strictly Grounded In Official Legal Texts</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Traffic Violations & Statutory Penalties
          </h1>

          <p className="text-xs sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Search offences in everyday language. Fine amounts, imprisonment terms, and suspension rules
            are retrieved dynamically from verified legal documents — never hardcoded or estimated.
          </p>

          {/* Search Bar Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="pt-2 max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            role="search"
          >
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search violation, e.g. drunk driving, riding without helmet..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-subtle bg-bg-primary text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all shadow-xs"
                required
                minLength={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={jurisdiction}
                onChange={(e) => {
                  setJurisdiction(e.target.value);
                  if (queryInput.trim().length >= 2) {
                    setSearchParams({ q: queryInput.trim(), jurisdiction: e.target.value });
                  }
                }}
                className="px-3 py-3 rounded-xl border border-border-subtle bg-bg-primary text-text-secondary text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-primary shadow-xs"
                aria-label="Filter by jurisdiction"
              >
                <option value="Central">Central (National)</option>
                <option value="All">All Jurisdictions</option>
              </select>

              <button
                type="submit"
                disabled={loading || queryInput.trim().length < 2}
                className="px-5 py-3 rounded-xl bg-accent-primary hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <span>Search</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Violation Tags */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="text-text-muted font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Quick lookups:
            </span>
            {POPULAR_VIOLATIONS.map((v) => (
              <button
                key={v.label}
                type="button"
                onClick={() => handleTagClick(v.query)}
                className="px-2.5 py-1 rounded-lg bg-bg-secondary hover:bg-border-subtle text-text-secondary hover:text-text-primary transition-colors text-xs font-medium border border-border-subtle/80"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs sm:text-sm flex items-start gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 flex justify-between items-center gap-2">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => executeSearch(queryInput, jurisdiction)}
                className="font-bold underline hover:opacity-80"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-border-subtle/60 rounded w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-bg-card rounded-xl border border-border-subtle p-5 space-y-3"
                >
                  <div className="h-4 bg-border-subtle/60 rounded w-1/3" />
                  <div className="h-6 bg-border-subtle/40 rounded w-3/4" />
                  <div className="h-16 bg-border-subtle/30 rounded w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results Display */}
        {!loading && searchResponse && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border-subtle">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Found {searchResponse.count} Statutory Provisions
                </h2>
                <p className="text-xs text-text-muted">
                  Results for &ldquo;<span className="font-medium text-text-primary">{searchResponse.query}</span>&rdquo; in {jurisdiction} Law
                </p>
              </div>

              {/* Confidence Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    searchResponse.confidenceTier === "HIGH"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : searchResponse.confidenceTier === "MEDIUM"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                  }`}
                >
                  Retrieval Confidence: {searchResponse.confidenceTier} ({(searchResponse.topScore * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Did You Mean Suggestion */}
            {searchResponse.didYouMean && (
              <div className="p-3 bg-accent-light text-accent-primary rounded-lg border border-accent-primary/20 text-xs sm:text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>
                  Did you mean:{" "}
                  <button
                    type="button"
                    onClick={() => handleTagClick(searchResponse.didYouMean!)}
                    className="font-bold underline hover:opacity-80"
                  >
                    {searchResponse.didYouMean}
                  </button>
                  ?
                </span>
              </div>
            )}

            {/* Ungrounded Fallback Message */}
            {!searchResponse.grounded && (
              <div className="p-5 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Out of Scope or Unverified Query</span>
                </div>
                <p>
                  No statutory provisions or fine amounts were found in verified traffic documents for this query. Per official anti-hallucination policy, we do not guess or estimate penalties.
                </p>
                <div className="pt-2">
                  <a
                    href="https://parivahan.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold underline hover:opacity-90"
                  >
                    <span>Check Official MoRTH Parivahan Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Results Grid */}
            {searchResponse.results.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResponse.results.map((item, idx) => (
                  <FineResultCard
                    key={`${item.section}-${idx}`}
                    item={item}
                    onInspect={handleInspect}
                    onAskAssistant={handleAskAssistant}
                  />
                ))}
              </div>
            )}

            {/* Related Questions Bar */}
            {searchResponse.relatedQuestions && searchResponse.relatedQuestions.length > 0 && (
              <div className="p-4 rounded-xl bg-bg-card border border-border-subtle space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
                  Related Traffic Questions:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {searchResponse.relatedQuestions.map((qText, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAskAssistant(qText)}
                      className="px-3 py-1.5 rounded-lg bg-bg-secondary hover:bg-accent-light hover:text-accent-primary text-text-secondary text-xs font-medium border border-border-subtle transition-colors text-left"
                    >
                      {qText} &rarr;
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Initial Overview / Category Spotlights (When no search has been performed) */}
        {!loading && !searchResponse && (
          <div className="space-y-8 pt-4">
            <div className="text-center space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-text-primary">
                Explore Legal Categories & Statutory Rules
              </h2>
              <p className="text-xs sm:text-sm text-text-muted max-w-lg mx-auto">
                Select a category below or type any violation above to view penalties extracted from the Motor Vehicles Act.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {CATEGORY_SPOTLIGHTS.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <div
                    key={cat.title}
                    className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-accent-primary/40 hover:shadow-sm transition-all"
                  >
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center">
                        <IconComponent className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-bold text-text-primary">{cat.title}</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">{cat.desc}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cat.sections.map((sec) => (
                          <span
                            key={sec}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-bg-secondary text-text-secondary"
                          >
                            {sec}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-border-subtle">
                      <button
                        type="button"
                        onClick={() => handleTagClick(cat.sampleQuery)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:text-accent-hover transition-colors"
                      >
                        <span>View Applicable Rules</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Official Settlement Disclaimer Card */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Official e-Challan Settlement
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Notice: To contest wrongful citations or pay pending e-challans online, always use the central government Parivahan portal.
                </p>
              </div>

              <a
                href="https://echallan.parivahan.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-secondary hover:bg-border-subtle text-text-primary text-xs font-semibold transition-colors flex-shrink-0"
              >
                <span>Visit Parivahan e-Challan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinesPage;
