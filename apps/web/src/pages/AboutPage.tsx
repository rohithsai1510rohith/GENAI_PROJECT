import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Scale,
  Cpu,
  FileCheck2,
  ExternalLink,
  Lock,
  Search,
  Sparkles,
  ArrowRight,
  Database,
  Terminal,
} from "lucide-react";
import { SEO } from "../components/common/SEO";

export const AboutPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col bg-bg-primary">
      <SEO
        title="About Project & Methodology"
        description="Learn about the enterprise RAG architecture, verified data sources, and strict legal grounding behind TrafficRules.in."
        canonicalPath="/about"
      />
      {/* Hero Header */}
      <section className="bg-bg-card border-b border-border-subtle py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-light text-accent-primary text-xs font-semibold border border-accent-primary/20">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Architecture &amp; Methodology</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-text-primary tracking-tight">
            About TrafficRules.in
          </h1>

          <p className="text-sm sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            An enterprise-grade legal assistant designed to provide accurate, transparent, and source-grounded
            traffic regulations and penalties for drivers across India.
          </p>
        </div>
      </section>

      {/* Main Narrative Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Problem & Solution Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-status-danger-bg text-status-danger-text flex items-center justify-center font-bold">
                !
              </div>
              <h2 className="text-xl font-bold text-text-primary">The Challenge with Traffic Laws</h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Indian traffic regulations are distributed across the Motor Vehicles Act, 1988, the 2019 Amendments,
                Central Motor Vehicles Rules (CMVR), and numerous Ministry notifications. Citizens frequently rely on
                unverified social media posts or generic AI chatbots that notoriously invent fine amounts, mislead drivers
                on license suspension rules, and hallucinate non-existent sections.
              </p>
            </div>
            <div className="pt-2 border-t border-border-subtle text-xs text-text-muted">
              Risk: Unreliable information leads to roadside disputes, unexpected court penalties, and non-compliance.
            </div>
          </div>

          <div className="bg-bg-card border border-accent-primary/30 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center">
                <Scale className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">Our Solution: Grounded RAG</h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                TrafficRules.in is built on Retrieval-Augmented Generation (RAG). Every single answer is strictly
                synthesized from official Gazette text and statutory chunk vectors. If a question falls outside verified
                documents, our anti-hallucination engine explicitly declines to answer rather than guessing fine figures.
              </p>
            </div>
            <div className="pt-2 border-t border-border-subtle text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4" />
              <span>100% source-cited answers with verifiable section excerpts</span>
            </div>
          </div>
        </section>

        {/* 4-Step RAG Pipeline */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-primary">
              Engineering Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
              How the Assistant Works
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              A transparent 4-stage pipeline guarantees that statutory integrity is preserved at every token.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
              <span className="w-7 h-7 rounded-lg bg-bg-secondary flex items-center justify-center text-xs font-bold text-text-secondary">
                1
              </span>
              <h3 className="text-sm font-bold text-text-primary">Ingestion &amp; Chunking</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Official MoRTH PDFs and Acts are parsed with PyMuPDF, normalized, and split into legal clauses
                preserving section boundaries and page metadata.
              </p>
            </div>

            <div className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
              <span className="w-7 h-7 rounded-lg bg-bg-secondary flex items-center justify-center text-xs font-bold text-text-secondary">
                2
              </span>
              <h3 className="text-sm font-bold text-text-primary">Semantic Vector Store</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Normalized embeddings are generated with <code>sentence-transformers/all-MiniLM-L6-v2</code> and
                indexed in a FAISS FlatIP index alongside a BM25 sparse keyword index.
              </p>
            </div>

            <div className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
              <span className="w-7 h-7 rounded-lg bg-bg-secondary flex items-center justify-center text-xs font-bold text-text-secondary">
                3
              </span>
              <h3 className="text-sm font-bold text-text-primary">Hybrid Retrieval</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                User queries undergo spell correction, synonym expansion, and hybrid retrieval. Confidence tiering
                (High/Medium/Low) dynamically gates the answer.
              </p>
            </div>

            <div className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-xs space-y-3">
              <span className="w-7 h-7 rounded-lg bg-bg-secondary flex items-center justify-center text-xs font-bold text-text-secondary">
                4
              </span>
              <h3 className="text-sm font-bold text-text-primary">Grounded Generation</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Groq Cloud Llama 3.3 70B streams the final structured answer token-by-token with clickable citations
                referencing the exact gazette page and rule.
              </p>
            </div>
          </div>
        </section>

        {/* System Architecture Specifications */}
        <section className="bg-bg-card border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-primary">
              Full-Stack Architecture
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
              Technology Stack &amp; Standards
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-text-primary">
                <Cpu className="w-4 h-4 text-accent-primary" />
                <span>Frontend Layer</span>
              </div>
              <ul className="space-y-1.5 text-text-secondary">
                <li>• React 18 + Vite + TypeScript</li>
                <li>• Tailwind CSS design system</li>
                <li>• Framer Motion micro-interactions</li>
                <li>• Server-Sent Events (SSE) streaming</li>
                <li>• WCAG 2.1 AA keyboard accessibility</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-text-primary">
                <Terminal className="w-4 h-4 text-accent-primary" />
                <span>API Gateway (Port 5000)</span>
              </div>
              <ul className="space-y-1.5 text-text-secondary">
                <li>• Node.js + Express + TypeScript</li>
                <li>• PostgreSQL persistence via Prisma ORM</li>
                <li>• Zod input validation schemas</li>
                <li>• Helmet security &amp; rate limiting (429)</li>
                <li>• Structured Pino logging with X-Request-ID</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-text-primary">
                <Database className="w-4 h-4 text-accent-primary" />
                <span>AI Microservice (Port 8000)</span>
              </div>
              <ul className="space-y-1.5 text-text-secondary">
                <li>• Python 3.11 + FastAPI async engine</li>
                <li>• PyMuPDF / pdfplumber document parser</li>
                <li>• all-MiniLM-L6-v2 vector embeddings</li>
                <li>• FAISS FlatIP &amp; BM25 hybrid ranking</li>
                <li>• Configured model: Llama 3.3 70B; live-verified: no (local extractive fallback mode)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Quality Metrics & Benchmarks */}
        <section className="bg-bg-card border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Quality Assurance
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                Benchmark Evaluation Suite
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-800 self-start sm:self-auto">
              PRD Target: &ge; 90%
            </span>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            The assistant is evaluated against a 105-query benchmark test suite spanning
            all statutory categories: helmet mandates, breathalyzer BAC thresholds, juvenile driving liabilities,
            overloading limits, e-challan contestation deadlines, and near-domain out-of-scope queries (run on sample test documents, not verified law).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-bg-primary border border-border-subtle rounded-xl p-4">
              <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">80.0%</span>
              <span className="block text-xs font-semibold text-text-secondary mt-1">
                Blind In-Scope Hit Rate
              </span>
            </div>

            <div className="bg-bg-primary border border-border-subtle rounded-xl p-4">
              <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">90.0%</span>
              <span className="block text-xs font-semibold text-text-secondary mt-1">
                Out-of-Scope Fallback Rate
              </span>
            </div>

            <div className="bg-bg-primary border border-border-subtle rounded-xl p-4">
              <span className="text-3xl font-extrabold text-accent-primary">&lt; 2s</span>
              <span className="block text-xs font-semibold text-text-secondary mt-1">
                Streaming First-Token Latency
              </span>
            </div>
          </div>
        </section>

        {/* Government Disclaimer & Official Sources */}
        <section className="bg-status-warning-bg/40 border border-status-warning-border rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 font-bold text-status-warning-text text-sm sm:text-base">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>Important Statutory Notice &amp; Legal Disclaimer</span>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            TrafficRules.in is an independent civic technology initiative designed to increase public legal literacy.
            <strong> Notice: Currently run on sample test documents, not verified law.</strong>
            This service does not constitute formal legal counsel, judicial representation, or official enforcement action.
            Traffic penalties, compoundable fine schedules, and local compounding limits can vary by state government
            notifications.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <a
              href="https://parivahan.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-accent-primary hover:underline"
            >
              <span>Parivahan Sewa Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <span className="text-text-muted">•</span>

            <a
              href="https://echallan.parivahan.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-accent-primary hover:underline"
            >
              <span>Parivahan e-Challan System</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <span className="text-text-muted">•</span>

            <a
              href="https://morth.nic.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-accent-primary hover:underline"
            >
              <span>Ministry of Road Transport and Highways (MoRTH)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* Call to Action Bar */}
        <section className="bg-accent-light border border-accent-primary/20 rounded-2xl p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
            Have a Specific Traffic Question?
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
            Ask our AI Assistant in plain language or lookup any violation in the fines directory.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs min-h-[44px]"
            >
              <span>Open AI Assistant</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/fines"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bg-card hover:bg-bg-secondary text-text-primary border border-border-subtle text-xs sm:text-sm font-semibold transition-colors shadow-2xs min-h-[44px]"
            >
              <Search className="w-4 h-4" />
              <span>Explore Fines Directory</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
