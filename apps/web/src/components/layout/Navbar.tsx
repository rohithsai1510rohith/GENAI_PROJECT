import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, Moon, Sun, MessageSquare, BookOpen, FileText, Info, Menu, X, CircleDot } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { fetchHealth } from "../../services/api";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchHealth()
      .then((h) => {
        if (mounted) {
          setDbHealthy(h.dependencies.database.status === "up");
        }
      })
      .catch(() => {
        if (mounted) setDbHealthy(false);
      });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  interface NavLinkItem {
    label: string;
    path: string;
    icon?: any;
    badge?: string;
  }

  const navLinks: NavLinkItem[] = [
    { label: "Home", path: "/" },
    { label: "Assistant", path: "/chat", icon: MessageSquare },
    { label: "Fines Directory", path: "/fines", icon: BookOpen },
    { label: "Documents", path: "/documents", icon: FileText },
    { label: "About", path: "/about", icon: Info },
    { label: "Admin", path: "/admin", icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-border-subtle transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-accent-primary rounded-lg py-1 px-1.5"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-primary flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base tracking-tight text-text-primary leading-tight">
                TrafficRules<span className="text-accent-primary">.in</span>
              </span>
              <span className="text-[10px] text-text-muted hidden sm:inline-block leading-tight font-medium">
                Indian Statutory Rules & Fines
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "text-accent-primary bg-accent-light/60 font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-secondary text-text-muted font-normal border border-border-subtle">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Health Pill, Theme Toggle, Mobile Menu Button */}
          <div className="flex items-center gap-2.5">
            {/* Live Database Status indicator */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border-subtle bg-bg-card-subtle"
              title={dbHealthy ? "PostgreSQL & AI Service operational" : "Checking service status"}
            >
              <CircleDot
                className={`w-3 h-3 ${
                  dbHealthy === true
                    ? "text-emerald-500 animate-pulse"
                    : dbHealthy === false
                    ? "text-rose-500"
                    : "text-amber-500"
                }`}
                aria-hidden="true"
              />
              <span className="text-text-muted text-[11px]">
                {dbHealthy === true ? "Statutory DB Online" : dbHealthy === false ? "Degraded" : "Connecting..."}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-accent-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 text-slate-700" aria-hidden="true" />
              ) : (
                <Sun className="w-5 h-5 text-amber-300" aria-hidden="true" />
              )}
            </button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-accent-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border-subtle bg-bg-card px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-md text-base font-medium flex items-center justify-between ${
                  isActive
                    ? "text-accent-primary bg-accent-light/60 font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                }`}
              >
                <span>{link.label}</span>
                {link.badge && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-bg-secondary text-text-muted border border-border-subtle">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
