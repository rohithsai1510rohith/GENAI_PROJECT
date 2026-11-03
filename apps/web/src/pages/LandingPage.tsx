import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Search,
  ArrowRight,
  Scale,
  FileCheck2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  X,
  FileText,
  CreditCard,
  Gauge,
  HardHat,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { SEO } from "../components/common/SEO";

interface StatutoryCard {
  title: string;
  section: string;
  penalty: string;
  category: "all" | "licence" | "fines" | "signals" | "safety" | "challan";
  description: string;
  query: string;
  urgent?: boolean;
}

const STATUTORY_ITEMS: StatutoryCard[] = [
  {
    title: "Drunk Driving & Breath Alcohol",
    section: "Section 185",
    penalty: "₹10,000 fine / 6 Months Jail",
    category: "fines",
    description: "Blood alcohol content exceeding 30 mg per 100 ml detected by breath analyser.",
    query: "What is the penalty for drunk driving under Section 185?",
    urgent: true,
  },
  {
    title: "Riding Without Helmet (Driver & Pillion)",
    section: "Section 129 / 194D",
    penalty: "₹1,000 + 3 Mo Disqualification",
    category: "safety",
    description: "Mandatory for every person driving or riding on a two-wheeler to wear BIS standard helmet.",
    query: "Is a helmet mandatory for pillion riders and what is the fine under Section 129?",
  },
  {
    title: "Driving Without a Valid Licence (DL)",
    section: "Section 181",
    penalty: "₹5,000 Spot Fine / Court",
    category: "licence",
    description: "Driving a motor vehicle on public roads without holding an effective driving licence.",
    query: "What is the penalty for driving without a valid driving licence under Section 181?",
  },
  {
    title: "Traffic Light Jump & Dangerous Driving",
    section: "Section 184",
    penalty: "₹1,000 to ₹5,000 / Jail",
    category: "signals",
    description: "Jumping red traffic signals, reckless lane cutting, or driving in a manner dangerous to public.",
    query: "What is the fine for violating traffic signals and dangerous driving under Section 184?",
  },
  {
    title: "Driving Without Insurance (Third Party)",
    section: "Section 196",
    penalty: "₹2,000 (1st) / ₹4,000 (Repeat)",
    category: "fines",
    description: "Operating an uninsured motor vehicle without mandatory third-party liability coverage.",
    query: "What is the penalty for driving without valid third party insurance under Section 196?",
  },
  {
    title: "Mobile Phone Use While Driving",
    section: "Section 184(c)",
    penalty: "₹1,000 to ₹5,000",
    category: "signals",
    description: "Using handheld mobile devices, texting, or talking without hands-free navigation while driving.",
    query: "What is the fine for using a mobile phone while driving under Section 184?",
  },
  {
    title: "Over Speeding on Highways & Cities",
    section: "Section 183",
    penalty: "₹1,000 (LMV) / ₹2,000 (Heavy)",
    category: "signals",
    description: "Exceeding prescribed statutory speed limits detected by speed guns or electronic radar cameras.",
    query: "What are the penalties for over speeding under Section 183?",
  },
  {
    title: "Mandatory Documents to Carry",
    section: "Rule 139 CMVR",
    penalty: "Produce within 15 Days",
    category: "licence",
    description: "Mandatory production of Driving Licence, RC, Insurance, and PUC certificate upon demand.",
    query: "What documents are mandatory to carry under Rule 139 of Central Motor Vehicles Rules?",
  },
  {
    title: "DigiLocker & mParivahan Legal Validity",
    section: "Rule 139A CMVR",
    penalty: "100% Legal Parity",
    category: "challan",
    description: "Digital documents presented via DigiLocker or mParivahan are legally valid at par with physical originals.",
    query: "Is DigiLocker or mParivahan accepted by traffic police as valid original documents?",
  },
  {
    title: "Juvenile Driving (Minor at the Wheel)",
    section: "Section 199A",
    penalty: "₹25,000 + 3 Yrs Jail for Guardian",
    category: "fines",
    description: "Guardian held guilty; motor vehicle registration cancelled for 12 months, juvenile debarred until age 25.",
    query: "What is the penalty for underage or juvenile driving under Section 199A?",
    urgent: true,
  },
  {
    title: "Blocking Emergency Vehicles (Ambulance)",
    section: "Section 194E",
    penalty: "₹10,000 Fine / 6 Mo Jail",
    category: "safety",
    description: "Failing to draw to side of the road to allow free passage to an ambulance or fire service vehicle.",
    query: "What is the penalty for blocking an ambulance or emergency vehicle under Section 194E?",
    urgent: true,
  },
  {
    title: "Triple Riding on Two-Wheeler",
    section: "Section 194C",
    penalty: "₹1,000 + 3 Mo Disqualification",
    category: "safety",
    description: "Carrying more than one pillion rider on a two-wheeler motorcycle or scooter.",
    query: "What is the fine for triple riding on a two-wheeler under Section 194C?",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Inquiries", icon: Sparkles },
  { id: "fines", label: "Fines & Penalties", icon: Scale },
  { id: "licence", label: "Licences & RC", icon: FileText },
  { id: "signals", label: "Signals & Speed", icon: Gauge },
  { id: "safety", label: "Helmets & Safety", icon: HardHat },
  { id: "challan", label: "E-Challan & DigiLocker", icon: Smartphone },
];

export const LandingPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 3) {
      navigate(`/chat?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleCardClick = (targetQuery: string) => {
    navigate(`/chat?q=${encodeURIComponent(targetQuery)}`);
  };

  const filteredCards =
    activeCategory === "all"
      ? STATUTORY_ITEMS
      : STATUTORY_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <div className="flex-1 flex flex-col">
      <SEO
        title="Official Indian Traffic Rules, Fines & Statutory Discovery Engine"
        description="Search Indian road safety regulations, Motor Vehicles Act 1988 (2019 Amendments), and Central Motor Vehicles Rules with direct citations to official MoRTH gazettes."
        canonicalPath="/"
      />

      {/* 1. Enhanced Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 border-b border-border-subtle bg-gradient-to-b from-bg-secondary/60 via-bg-primary to-bg-primary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Top National Dataset Ribbon */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-light border border-accent-primary/20 text-accent-primary text-xs font-semibold shadow-xs">
              <span className="text-sm" role="img" aria-label="Indian flag">🇮🇳</span>
              <span>Official National Dataset • MoRTH &amp; Parivahan Sewa</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success-bg border border-status-success-border text-status-success-text text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
              <span>Motor Vehicles Act 1988 (2019 Amendments) &amp; CMVR 1989</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto mb-6">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-text-primary tracking-tight leading-[1.12] mb-4">
              Understand Indian Traffic Rules &amp;{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 dark:from-blue-400 dark:via-indigo-300 dark:to-blue-300">
                Statutory Penalties
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base md:text-lg text-text-muted max-w-3xl mx-auto leading-relaxed">
              Instant, cited legal answers with exact clause text, fine amounts, and court compound procedures directly
              indexed from official Ministry of Road Transport and Highways (MoRTH) statutory gazettes.
            </p>
          </div>

          {/* Interactive Search Bar Form */}
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto mb-4">
            <div className="relative flex items-center shadow-lg rounded-2xl bg-bg-card border-2 border-border-strong hover:border-accent-primary/50 focus-within:border-accent-primary transition-all p-1.5 md:p-2">
              <Search className="w-5 h-5 text-accent-primary ml-3 flex-shrink-0" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about fines, speeding, helmets, driving licences, DigiLocker, e-challans..."
                aria-label="Ask a traffic law or penalty question"
                className="w-full px-3 py-2 text-sm sm:text-base text-text-primary bg-transparent focus:outline-none placeholder:text-text-muted"
                minLength={3}
                maxLength={500}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1.5 mr-1 text-text-muted hover:text-text-primary rounded-lg transition-colors"
                  aria-label="Clear search input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={query.trim().length < 3}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-xs flex-shrink-0 min-h-[44px]"
              >
                <span>Ask</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Prompt Micro-Tags */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-text-muted mt-2.5 px-2">
              <span className="font-semibold text-text-secondary">Try asking:</span>
              <button
                type="button"
                onClick={() => setQuery("What is the penalty for drunk driving?")}
                className="text-accent-primary hover:underline"
              >
                Drunk driving fine
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setQuery("Is helmet mandatory for pillion rider?")}
                className="text-accent-primary hover:underline"
              >
                Helmet under Sec 129
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setQuery("Can I show driving licence on DigiLocker?")}
                className="text-accent-primary hover:underline"
              >
                DigiLocker validity
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setQuery("How to renew expired driving licence?")}
                className="text-accent-primary hover:underline"
              >
                DL renewal grace period
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setQuery("What is the penalty for jumping a red light?")}
                className="text-accent-primary hover:underline"
              >
                Signal jump fine
              </button>
            </div>
          </form>

          {/* Category Filter Pills */}
          <div className="max-w-4xl mx-auto mt-8 mb-6">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? "bg-accent-primary text-white shadow-sm ring-2 ring-accent-primary/20"
                        : "bg-bg-card hover:bg-bg-secondary text-text-secondary border border-border-subtle hover:border-accent-primary/30"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Statutory Cards Grid */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-accent-primary" aria-hidden="true" />
                <span>Verified Statutory Rules &amp; Compound Fines</span>
              </h2>
              <span className="text-xs text-text-muted">
                Showing {filteredCards.length} statutory provisions
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredCards.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleCardClick(item.query)}
                  className="flex flex-col text-left p-4 rounded-xl border border-border-subtle bg-bg-card hover:bg-bg-card-subtle hover:border-accent-primary/50 transition-all shadow-xs hover:shadow-md group focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight bg-bg-secondary text-accent-primary border border-border-subtle">
                      {item.section}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        item.urgent
                          ? "bg-status-danger-bg text-status-danger-text border border-status-danger-border"
                          : "bg-status-warning-bg text-status-warning-text border border-status-warning-border"
                      }`}
                    >
                      {item.penalty}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors line-clamp-1 mb-1">
                    {item.title}
                  </h3>

                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed flex-1 mb-3">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle/60 text-xs font-semibold text-accent-primary group-hover:translate-x-0.5 transition-transform">
                    <span>Ask Legal Assistant</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Official Government Portals Fast-Access Directory */}
          <div className="max-w-5xl mx-auto mt-10 pt-6 border-t border-border-subtle">
            <div className="text-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Official Ministry Portals &amp; Citizen Services Directory
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://parivahan.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card hover:bg-bg-secondary border border-border-subtle text-xs font-semibold text-text-secondary hover:text-accent-primary transition-colors"
              >
                <span>🌐 Parivahan Sewa Portal</span>
                <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
              </a>
              <a
                href="https://echallan.parivahan.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card hover:bg-bg-secondary border border-border-subtle text-xs font-semibold text-text-secondary hover:text-accent-primary transition-colors"
              >
                <span>🚗 Check &amp; Pay E-Challan</span>
                <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
              </a>
              <a
                href="https://sarathi.parivahan.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card hover:bg-bg-secondary border border-border-subtle text-xs font-semibold text-text-secondary hover:text-accent-primary transition-colors"
              >
                <span>🪪 Sarathi Driving Licence Services</span>
                <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
              </a>
              <a
                href="https://morth.nic.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card hover:bg-bg-secondary border border-border-subtle text-xs font-semibold text-text-secondary hover:text-accent-primary transition-colors"
              >
                <span>🏛️ MoRTH Gazette Notifications</span>
                <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
              </a>
              <a
                href="https://www.digilocker.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card hover:bg-bg-secondary border border-border-subtle text-xs font-semibold text-text-secondary hover:text-accent-primary transition-colors"
              >
                <span>📲 DigiLocker India (Rule 139A)</span>
                <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. StepCards Workflow Section */}
      <section className="py-12 md:py-20 border-b border-border-subtle bg-bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Transparent Statutory Verification
            </h2>
            <p className="text-sm text-text-muted mt-2">
              Every penalty and rule is directly mapped to statutory clauses without generative hallucinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-xl border border-border-subtle bg-bg-card-subtle p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-primary flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Search className="w-4 h-4 text-accent-primary" aria-hidden="true" />
                <span>Ask Naturally</span>
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Enter your question in plain English. The hybrid BM25 + FAISS retrieval handles synonyms, typos,
                and colloquial phrases.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-border-subtle bg-bg-card-subtle p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-primary flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Scale className="w-4 h-4 text-accent-primary" aria-hidden="true" />
                <span>Exact Statutory Citation</span>
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                The assistant cites the exact Act, Section, and clause number. Confidence tiers clearly indicate
                relevance.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-border-subtle bg-bg-card-subtle p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-primary flex items-center justify-center font-bold text-sm">
                03
              </div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-accent-primary" aria-hidden="true" />
                <span>Inspect Full Clause Text</span>
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Click any citation card to slide open the Source Drawer and review the unedited statutory clause
                text and official gazette URLs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Statutory Scope & Trust Disclosure */}
      <section className="py-12 md:py-16 bg-bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-border-subtle bg-bg-card p-6 sm:p-8 space-y-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-status-warning-bg text-status-warning-text flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-text-primary">
                  Statutory Scope &amp; Legal Advisory Notice
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  TrafficRules.in is an informational technology tool created to make Indian road safety laws accessible to the general public.
                  It references the Central Motor Vehicles Act 1988 (as amended by the Motor Vehicles Amendment Act 2019) and the Central Motor Vehicles Rules 1989.
                </p>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  State-level compound fine notifications (e.g. Delhi, Maharashtra, Karnataka) may prescribe tailored spot penalties.
                  Always verify official notification gazettes on Parivahan Sewa before making legal representations.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <ShieldCheck className="w-4 h-4 text-accent-primary" aria-hidden="true" />
                <span>Zero Hallucination Retrieval Policy</span>
              </div>
              <a
                href="https://parivahan.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-primary hover:text-accent-hover"
              >
                <span>Visit Parivahan Sewa Portal</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
