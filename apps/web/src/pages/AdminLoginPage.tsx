import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, Key, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SEO } from "../components/common/SEO";

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both official email address and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login({ email: email.trim(), password });
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Invalid administrative credentials or account locked.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <SEO title="Admin Authority Portal" noindex={true} canonicalPath="/admin/login" />
      <div className="max-w-md w-full space-y-8 bg-bg-card p-8 rounded-2xl border border-border-subtle shadow-md">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center border border-accent-ring">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Admin Authority Portal
          </h1>
          <p className="text-sm text-text-muted">
            Authenticate to manage official statutory gazettes, monitor RAG queries, and update vector indices.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-status-danger-bg text-status-danger-text border border-status-danger-border text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1.5">
              Official Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@trafficassistant.gov.in"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1.5">
              Secure Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Key className="w-4 h-4" />
              </div>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-accent-primary text-white font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-ring disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <span>Sign In to Admin Portal</span>
            )}
          </button>
        </form>

        {/* Back Link */}
        <div className="pt-2 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Assistant</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
