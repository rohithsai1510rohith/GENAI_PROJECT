import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, MessageSquare, BookOpen, Scale, Search } from "lucide-react";
import { SEO } from "../components/common/SEO";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16 text-center">
      <SEO title="Page Not Found (404)" noindex={true} />
      <div className="max-w-lg w-full bg-bg-card border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-status-danger-bg text-status-danger-text flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl sm:text-5xl font-black text-text-primary tracking-tight">404</span>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Statutory Route Not Found
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
            The requested page or statutory reference does not exist or has been relocated.
            Use the links below to find verified traffic rules and penalties.
          </p>
        </div>

        {/* Quick Portal Navigation Grid */}
        <div className="grid grid-cols-2 gap-2 text-left pt-2">
          <Link
            to="/chat"
            className="p-3 rounded-xl border border-border-subtle bg-bg-primary hover:bg-bg-secondary hover:border-accent-primary/40 transition-colors flex items-center gap-2.5 text-xs font-semibold text-text-primary"
          >
            <MessageSquare className="w-4 h-4 text-accent-primary flex-shrink-0" />
            <span>AI Assistant</span>
          </Link>

          <Link
            to="/fines"
            className="p-3 rounded-xl border border-border-subtle bg-bg-primary hover:bg-bg-secondary hover:border-accent-primary/40 transition-colors flex items-center gap-2.5 text-xs font-semibold text-text-primary"
          >
            <Scale className="w-4 h-4 text-accent-primary flex-shrink-0" />
            <span>Fines Lookup</span>
          </Link>

          <Link
            to="/knowledge"
            className="p-3 rounded-xl border border-border-subtle bg-bg-primary hover:bg-bg-secondary hover:border-accent-primary/40 transition-colors flex items-center gap-2.5 text-xs font-semibold text-text-primary"
          >
            <BookOpen className="w-4 h-4 text-accent-primary flex-shrink-0" />
            <span>Knowledge Base</span>
          </Link>

          <Link
            to="/about"
            className="p-3 rounded-xl border border-border-subtle bg-bg-primary hover:bg-bg-secondary hover:border-accent-primary/40 transition-colors flex items-center gap-2.5 text-xs font-semibold text-text-primary"
          >
            <Search className="w-4 h-4 text-accent-primary flex-shrink-0" />
            <span>Methodology</span>
          </Link>
        </div>

        {/* Primary Return Button */}
        <div className="pt-2 border-t border-border-subtle">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Main Portal</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
