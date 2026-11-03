import React from "react";
import { ShieldCheck, Lock, EyeOff, Trash2, Cookie, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "../components/common/SEO";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-12">
      <SEO
        title="Privacy Policy & Telemetry Governance"
        description="Review how citizen privacy, automated PII scrubbing, and 90-day retention policies are strictly maintained on TrafficRules.in."
        canonicalPath="/privacy"
      />
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-light border border-accent-ring text-accent-primary text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Statutory Privacy & Data Governance</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
          Privacy Policy & Telemetry Notice
        </h1>
        <p className="text-base text-text-muted max-w-2xl mx-auto leading-relaxed">
          TrafficRules.in is dedicated to transparent, public-interest statutory information discovery.
          Learn how we handle citizen queries, protect personal data, and enforce strict PII redaction.
        </p>
      </div>

      {/* Main Privacy Commitments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-bg-card border border-border-subtle shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center border border-accent-ring">
            <EyeOff className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Automated PII Redaction</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            All user queries sent to our AI assistant are automatically sanitized prior to long-term telemetry logging.
            Personal identifiers—including email addresses, phone numbers, and Indian vehicle registration plates (e.g. DL01AB1234)—are permanently scrubbed with redaction tokens.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-bg-card border border-border-subtle shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center border border-accent-ring">
            <Trash2 className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Strict Retention & Purge Policy</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Citizen query logs are retained solely for statutory query frequency analytics, evaluation benchmarks, and quality improvement.
            All historical query logs are systematically purged after 90 days (configurable via <code>QUERY_LOG_RETENTION_DAYS</code>).
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-bg-card border border-border-subtle shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center border border-accent-ring">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">No Citizen Account Requirement</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            General citizens do not register or create accounts. Sessions utilize anonymous client-generated UUIDs that are ephemeral and never linked to your identity or browser fingerprint.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-bg-card border border-border-subtle shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center border border-accent-ring">
            <Cookie className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Cookie & Session Transparency</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            We do not use tracking or advertising cookies. The only cookies utilized are secure, SameSite=Strict, httpOnly cookies exclusively reserved for authenticated administrative portal sessions.
          </p>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="space-y-8 bg-bg-card p-8 rounded-2xl border border-border-subtle text-sm text-text-secondary leading-relaxed">
        <section className="space-y-3">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-primary" />
            1. Information We Collect
          </h3>
          <p>
            When you interact with the statutory assistant, our systems temporarily process the query text, selected state/central jurisdiction, and traffic domain (e.g. fines, licensing).
            This data is used in real-time to retrieve relevant statutory sections from the Motor Vehicles Act 1988 and official central gazettes.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-primary" />
            2. Data Security & Storage
          </h3>
          <p>
            Administrative credentials and authorization keys are stored using industry-standard Argon2id cryptographic hashing.
            Administrative access tokens are kept in volatile frontend memory only (never written to persistent storage like localStorage) and expire after 15 minutes.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-primary" />
            3. Local Browser Storage & Chat History
          </h3>
          <p>
            To provide a seamless conversational experience, your browser&apos;s <code>localStorage</code> retains your theme preference (<code>theme</code>), an anonymous session identifier (<code>traffic_anon_id</code>), and local chat history (up to 20 conversations under <code>traffic_assistant_chat_store</code>). This chat history remains strictly on your local device, is never transmitted to third parties, and can be removed at any time using the in-app delete or &quot;Clear all&quot; buttons.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-primary" />
            4. Disclaimer & Statutory Inquiries
          </h3>
          <p>
            TrafficRules.in provides sample statutory information for educational and reference purposes only.
            For disputed e-challans or court summonses, citizens should refer to official Regional Transport Offices (RTO) or consult certified legal practitioners.
          </p>
        </section>

        <div className="pt-4 border-t border-border-subtle flex flex-wrap gap-4 items-center justify-between text-xs text-text-muted">
          <span>Effective Date: September 1, 2019 (Updated 2026)</span>
          <Link to="/" className="text-accent-primary font-medium hover:underline">
            &larr; Return to Home Overview
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
