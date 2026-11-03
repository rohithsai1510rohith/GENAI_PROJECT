import React from "react";
import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight, Construction } from "lucide-react";

interface EmptyStateProps {
  title: string;
  badge?: string;
  description: string;
  icon?: LucideIcon;
  primaryAction?: {
    label: string;
    href: string;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  badge = "Scheduled for Upcoming Phase",
  description,
  icon: Icon = Construction,
  primaryAction = { label: "Consult AI Assistant", href: "/chat" },
}) => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-12">
      <div className="max-w-md w-full text-center bg-bg-card border border-border-subtle rounded-xl p-8 shadow-sm">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent-light flex items-center justify-center text-accent-primary">
          <Icon className="w-7 h-7" aria-hidden="true" />
        </div>

        {badge && (
          <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wide uppercase rounded-full bg-bg-secondary text-text-muted border border-border-subtle">
            {badge}
          </span>
        )}

        <h1 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight mb-2">
          {title}
        </h1>

        <p className="text-sm text-text-muted leading-relaxed mb-6">
          {description}
        </p>

        {primaryAction && (
          <Link
            to={primaryAction.href}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-white text-sm font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-primary min-h-[44px]"
          >
            <span>{primaryAction.label}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
};
