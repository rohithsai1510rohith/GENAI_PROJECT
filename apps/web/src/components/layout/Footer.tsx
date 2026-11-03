import React from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border-subtle bg-bg-card transition-colors mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent-primary flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <span className="font-bold text-base text-text-primary">
                TrafficRules<span className="text-accent-primary">.in</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md">
              An AI-assisted statutory discovery engine for Indian road safety laws, motor vehicle amendment penalties,
              and mandatory documents under the Motor Vehicles Act 1988 / 2019 Amendments and Central Motor Vehicles Rules 1989.
            </p>
          </div>

          {/* Direct Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-3">
              Application
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-text-secondary">
              <li>
                <Link to="/" className="hover:text-accent-primary transition-colors">
                  Home Overview
                </Link>
              </li>
              <li>
                <Link to="/chat" className="hover:text-accent-primary transition-colors">
                  AI Legal Assistant
                </Link>
              </li>
              <li>
                <Link to="/fines" className="hover:text-accent-primary transition-colors">
                  Penalty Directory
                </Link>
              </li>
              <li>
                <Link to="/documents" className="hover:text-accent-primary transition-colors">
                  Statutory Records
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-accent-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-accent-primary transition-colors font-medium text-accent-primary">
                  Admin Authority Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Official Indian Transport Portals */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-3">
              Official Portals
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-text-secondary">
              <li>
                <a
                  href="https://parivahan.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent-primary transition-colors"
                >
                  <span>Parivahan Sewa (MoRTH)</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href="https://echallan.parivahan.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent-primary transition-colors"
                >
                  <span>E-Challan Official Portal</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href="https://morth.nic.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent-primary transition-colors"
                >
                  <span>Ministry of Road Transport</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer & Attribution */}
        <div className="border-t border-border-subtle pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-text-muted">
          <p className="text-center sm:text-left">
            <strong>Disclaimer:</strong> This application provides statutory information for educational and reference purposes only.
            It does not constitute formal legal counsel. For disputed challans, consult a certified legal advocate or the relevant Regional Transport Authority.
          </p>
          <p className="flex-shrink-0">
            &copy; {new Date().getFullYear()} TrafficRules.in &middot; Built with Groq &amp; FAISS
          </p>
        </div>
      </div>
    </footer>
  );
};
