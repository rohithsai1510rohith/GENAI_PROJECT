import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  LogOut,
  UploadCloud,
  FileText,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Database,
  BarChart3,
  Search,
  Check,
  Layers,
  Sparkles,
  Server,
  Power,
  Calendar,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchAdminAnalytics,
  fetchAdminDocuments,
  updateAdminDocumentStatus,
  uploadAdminDocument,
  ingestAdminDocument,
  deleteAdminDocument,
  triggerAdminReindex,
  fetchAdminQueries,
  purgeAdminAnalytics,
} from "../services/api";
import { AdminAnalyticsData } from "../types";
import { SEO } from "../components/common/SEO";

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, logout, isLoading: authLoading } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"upload" | "documents" | "telemetry" | "queries">("upload");

  // State
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [globalReindexing, setGlobalReindexing] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Date Filters for Telemetry
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docOfficialTitle, setDocOfficialTitle] = useState("");
  const [docType, setDocType] = useState("Act");
  const [docJurisdiction, setDocJurisdiction] = useState("Central");
  const [docNotificationNumber, setDocNotificationNumber] = useState("");
  const [docEffectiveDate, setDocEffectiveDate] = useState("2026-01-01");
  const [docSourceUrl, setDocSourceUrl] = useState("https://morth.nic.in");
  const [docVerified, setDocVerified] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ingestionStep, setIngestionStep] = useState<number>(0);
  const [ingestionStatusMsg, setIngestionStatusMsg] = useState<string>("");

  // Registry Search & Filter
  const [searchFilter, setSearchFilter] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !token) {
      navigate("/admin/login");
    }
  }, [token, authLoading, navigate]);

  // Load Analytics, Documents, Queries
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const analyticsData = await fetchAdminAnalytics(token, {
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setAnalytics(analyticsData);

      setLoadingDocs(true);
      const docsData = await fetchAdminDocuments(token);
      setDocuments(docsData.documents || []);

      const queriesData = await fetchAdminQueries(token, { limit: 25 });
      setQueries(queriesData.queries || []);
    } catch (err: any) {
      if (err.message?.includes("401") || err.message?.includes("token")) {
        await logout();
        navigate("/admin/login");
      }
    } finally {
      setLoadingDocs(false);
    }
  }, [token, fromDate, toDate, logout, navigate]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const handleGlobalReindex = async () => {
    if (!token) return;
    try {
      setGlobalReindexing(true);
      setNotification({ type: "info", message: "Rebuilding entire FAISS vector index under concurrency lock..." });
      const res = await triggerAdminReindex(token);
      setNotification({
        type: "success",
        message: `Successfully rebuilt knowledge base! ${res.totalVectors} vectors indexed.`,
      });
      await loadData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to rebuild index" });
    } finally {
      setGlobalReindexing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf" || ext === "txt") {
        setUploadFile(file);
        if (!docTitle) {
          setDocTitle(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
        }
      } else {
        setNotification({ type: "error", message: "Only .pdf and .txt files are supported. Markdown (.md) is rejected." });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf" || ext === "txt") {
        setUploadFile(file);
        if (!docTitle) {
          setDocTitle(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
        }
      } else {
        setNotification({ type: "error", message: "Only .pdf and .txt files are supported. Markdown (.md) is rejected." });
      }
    }
  };

  const handleUploadAndIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!uploadFile) {
      setNotification({ type: "error", message: "Please select a PDF or TXT file to upload." });
      return;
    }
    if (!docTitle.trim()) {
      setNotification({ type: "error", message: "Please provide a descriptive document title." });
      return;
    }

    try {
      setIsUploading(true);
      setIngestionStep(1);
      setIngestionStatusMsg("Uploading file & verifying magic bytes and SHA-256 hash...");

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", docTitle.trim());
      formData.append("officialTitle", docOfficialTitle.trim() || docTitle.trim());
      formData.append("type", docType);
      formData.append("documentType", docType);
      formData.append("jurisdiction", docJurisdiction);
      formData.append("notificationNumber", docNotificationNumber.trim());
      formData.append("effectiveDate", docEffectiveDate);
      formData.append("sourceUrl", docSourceUrl.trim());
      formData.append("verified", String(docVerified));

      const uploadRes = await uploadAdminDocument(formData, token);

      setIngestionStep(2);
      setIngestionStatusMsg("Document accepted. Checking extractable text...");

      setIngestionStep(3);
      setIngestionStatusMsg("Generating embeddings and indexing into FAISS...");
      const ingestRes = await ingestAdminDocument(uploadRes.id, token);

      setIngestionStep(4);
      setIngestionStatusMsg(
        `Successfully indexed ${ingestRes.chunksCreated || "all"} chunks! Document is now live for queries.`
      );

      setNotification({
        type: "success",
        message: `Document '${docTitle}' successfully uploaded and indexed!`,
      });

      // Reset form
      setUploadFile(null);
      setDocTitle("");
      setDocOfficialTitle("");
      setDocNotificationNumber("");
      setDocVerified(false);
      await loadData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Document upload or ingestion failed." });
      setIngestionStep(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleDocStatus = async (docId: string, currentStatus: string) => {
    if (!token) return;
    try {
      const targetStatus = currentStatus === "inactive" ? "active" : "inactive";
      await updateAdminDocumentStatus(docId, targetStatus, token);
      setNotification({
        type: "success",
        message: `Document status changed to ${targetStatus === "inactive" ? "Inactive (excluded from search)" : "Active"}`,
      });
      await loadData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update status" });
    }
  };

  const handleDeleteDoc = async (docId: string, title: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to permanently delete '${title}'? This will remove its vectors from the FAISS store.`)) {
      return;
    }
    try {
      await deleteAdminDocument(docId, token);
      setNotification({ type: "success", message: `Document '${title}' successfully deleted and de-indexed.` });
      await loadData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to delete document" });
    }
  };

  const handlePurge = async () => {
    if (!token) return;
    if (!window.confirm("Purge query logs older than 90 days?")) return;
    try {
      const res = await purgeAdminAnalytics(token, 90);
      setNotification({
        type: "success",
        message: `Purge completed: ${res.deletedQueryLogs} logs removed.`,
      });
      await loadData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Purge failed" });
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (doc.rawFilename && doc.rawFilename.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesJurisdiction =
      jurisdictionFilter === "all" || doc.jurisdiction?.toLowerCase() === jurisdictionFilter.toLowerCase();
    return matchesSearch && matchesJurisdiction;
  });

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <SEO title="Administrative Control Portal" noindex={true} canonicalPath="/admin" />
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light text-accent-primary flex items-center justify-center border border-accent-ring">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                Administrative Control Portal
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Official Authority
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Logged in as <strong className="text-text-primary">{user?.email || "Admin Officer"}</strong> &middot; Role: {user?.role || "admin"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGlobalReindex}
            disabled={globalReindexing}
            className="px-3.5 py-2 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-secondary text-text-secondary text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${globalReindexing ? "animate-spin text-accent-primary" : ""}`} />
            <span>Re-Index Vector Store</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Global Notifications */}
      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border shadow-sm ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : notification.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
              : "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
          }`}
        >
          {notification.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
          {notification.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
          {notification.type === "info" && <RefreshCw className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />}
          <div className="flex-1 font-medium">{notification.message}</div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards - Strictly Honest Calculated DB Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-bg-card border border-border-subtle shadow-sm space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Queries</span>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {analytics?.totalQueries ?? 0}
          </div>
          <p className="text-xs text-text-muted">
            {analytics?.answeredQueries ?? 0} answered &middot; {analytics?.unansweredQueries ?? 0} unanswered
          </p>
        </div>

        <div className="p-5 rounded-xl bg-bg-card border border-border-subtle shadow-sm space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Grounded Retrieval Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {analytics?.groundedRate ?? "0.0%"}
          </div>
          <p className="text-xs text-text-muted">
            Computed from official DB query log records
          </p>
        </div>

        <div className="p-5 rounded-xl bg-bg-card border border-border-subtle shadow-sm space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Citizen Feedback</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {analytics?.feedback?.satisfactionRate ?? "N/A"}
          </div>
          <p className="text-xs text-text-muted">
            {analytics?.feedback?.positive ?? 0} thumbs up &middot; {analytics?.feedback?.negative ?? 0} thumbs down
          </p>
        </div>

        <div className="p-5 rounded-xl bg-bg-card border border-border-subtle shadow-sm space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Indexed Vector Store</span>
            <Database className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {analytics?.vectorIndex?.totalVectors ?? 0} <span className="text-xs font-normal text-text-muted">vectors</span>
          </div>
          <p className="text-xs text-text-muted">
            {analytics?.vectorIndex.activeDocuments ?? 0} active documents in retrieval
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "upload"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload &amp; Live Ingestion</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "documents"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Statutory Document Registry ({documents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("queries")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "queries"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Sanitized Query Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("telemetry")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "telemetry"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>System Topology &amp; Governance</span>
        </button>
      </div>

      {/* Tab 1: Upload & Ingestion */}
      {activeTab === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Upload Form */}
          <div className="lg:col-span-7 bg-bg-card p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-accent-primary" />
                Ingest Official Transport Document
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Upload verified PDFs or TXT documents (max 20 MB). Magic bytes and SHA-256 deduplication are strictly validated.
              </p>
            </div>

            <form onSubmit={handleUploadAndIngest} className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  uploadFile
                    ? "border-accent-primary bg-accent-light/30"
                    : "border-border-strong hover:border-accent-primary bg-bg-card-subtle"
                }`}
                onClick={() => document.getElementById("file-upload-input")?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadFile ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-accent-primary" />
                    <p className="text-sm font-semibold text-text-primary">{uploadFile.name}</p>
                    <p className="text-xs text-text-muted">{(uploadFile.size / 1024).toFixed(1)} KB &middot; Ready for upload</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 mx-auto text-text-muted" />
                    <p className="text-sm font-medium text-text-primary">
                      Drag &amp; drop official PDF or TXT gazette here
                    </p>
                    <p className="text-xs text-text-muted">or click to browse from local computer (Max 20 MB &middot; PDF or TXT only)</p>
                  </div>
                )}
              </div>

              {/* Metadata Fields */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Motor Vehicles (Driving Regulations) Gazette 2026"
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                      Official Gazette Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={docOfficialTitle}
                      onChange={(e) => setDocOfficialTitle(e.target.value)}
                      placeholder="e.g. The Motor Vehicles Act, 1988"
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                      Notification Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={docNotificationNumber}
                      onChange={(e) => setDocNotificationNumber(e.target.value)}
                      placeholder="e.g. S.O. 3147(E) or GSR 575(E)"
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                      Statutory Type
                    </label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    >
                      <option value="Act">Act (Statute)</option>
                      <option value="Rules">Rules / Regulation</option>
                      <option value="Notification">Official Gazette Notification</option>
                      <option value="Circular">Transport Circular</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                      Jurisdiction
                    </label>
                    <select
                      value={docJurisdiction}
                      onChange={(e) => setDocJurisdiction(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    >
                      <option value="Central">Central (All India)</option>
                      <option value="Delhi">Delhi NCT</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                      Effective Date (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      required
                      value={docEffectiveDate}
                      onChange={(e) => setDocEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1">
                      Official Source Link
                    </label>
                    <input
                      type="url"
                      value={docSourceUrl}
                      onChange={(e) => setDocSourceUrl(e.target.value)}
                      placeholder="https://morth.nic.in"
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>
                </div>

                {/* Verification Checkbox (Part 0 Item 3: Admin explicit declaration) */}
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-text-primary bg-bg-secondary/40 p-3 rounded-xl border border-border-subtle hover:border-accent-primary/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={docVerified}
                      onChange={(e) => setDocVerified(e.target.checked)}
                      className="w-4 h-4 rounded border-border-subtle text-accent-primary focus:ring-accent-primary"
                    />
                    <span>I checked this file against the official source</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUploading || !uploadFile}
                className="w-full py-2.5 px-4 rounded-lg bg-accent-primary text-white font-medium hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Ingestion Pipeline...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload &amp; Index Document</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Live Ingestion Stepper */}
          <div className="lg:col-span-5 bg-bg-card p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                Live Ingestion Pipeline Status
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Monitors magic bytes validation, PyMuPDF extraction, and FAISS atomic persistence.
              </p>
            </div>

            <div className="space-y-4 my-auto py-4">
              {[
                { step: 1, label: "Magic Bytes Verification & SHA-256 Deduplication" },
                { step: 2, label: "PyMuPDF Extractable Text Check" },
                { step: 3, label: "Statutory Chunking & MiniLM Embeddings" },
                { step: 4, label: "FAISS Atomic Shadow Swap Under Write Lock" },
              ].map((item) => {
                const isDone = ingestionStep > item.step || ingestionStep === 4;
                const isCurrent = ingestionStep === item.step && ingestionStep !== 4;
                return (
                  <div key={item.step} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isDone
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-accent-primary text-white animate-pulse"
                          : "bg-bg-secondary text-text-muted border border-border-subtle"
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : item.step}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isDone
                          ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                          : isCurrent
                          ? "text-accent-primary font-semibold"
                          : "text-text-muted"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {ingestionStatusMsg ? (
              <div className="p-3.5 rounded-lg bg-bg-secondary border border-border-subtle text-xs text-text-secondary">
                <p className="font-semibold text-text-primary mb-0.5">Pipeline Output:</p>
                <p>{ingestionStatusMsg}</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-bg-card-subtle border border-border-subtle text-xs text-text-muted text-center">
                Ready for document submission.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Document Registry Table */}
      {activeTab === "documents" && (
        <div className="bg-bg-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Statutory Document Registry</h2>
              <p className="text-xs text-text-muted">
                Manage live statutory acts and gazettes. Deactivated documents are immediately excluded from citizen queries.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by title..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-border-subtle bg-bg-card text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary w-48"
                />
              </div>

              <select
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border-subtle bg-bg-card text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                <option value="all">All Jurisdictions</option>
                <option value="Central">Central</option>
                <option value="Delhi">Delhi</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Karnataka">Karnataka</option>
              </select>

              <button
                type="button"
                onClick={loadData}
                disabled={loadingDocs}
                className="p-1.5 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-secondary text-text-muted hover:text-text-primary"
                title="Refresh Documents"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDocs ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-secondary text-text-primary font-semibold border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4">Title &amp; Filename</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Jurisdiction</th>
                  <th className="py-3 px-4">Verified</th>
                  <th className="py-3 px-4">Chunks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      No documents match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => {
                    const isInactive = doc.status === "inactive" || doc.status === "deactivated";
                    return (
                      <tr key={doc.id} className="hover:bg-bg-card-subtle transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text-primary flex items-center gap-1.5">
                            <span>{doc.title}</span>
                            {doc.isTestData && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 font-normal">
                                Test Data
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted font-mono">{doc.rawFilename || doc.id}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-bg-secondary text-text-secondary border border-border-subtle">
                            {doc.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            {doc.jurisdiction}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {doc.verified ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              Verified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary">{doc.chunkCount ?? 0}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isInactive
                                ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                : doc.status === "indexed" || doc.status === "ready"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            }`}
                          >
                            {isInactive ? "Inactive" : doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleToggleDocStatus(doc.id, doc.status)}
                            className={`px-2 py-1 rounded text-[11px] font-medium border ${
                              isInactive
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                            title={isInactive ? "Activate document" : "Deactivate document"}
                          >
                            {isInactive ? "Reactivate" : "Deactivate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id, doc.title)}
                            className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Sanitized Query Logs */}
      {activeTab === "queries" && (
        <div className="bg-bg-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Citizen Query Telemetry</h2>
              <p className="text-xs text-text-muted">
                Sanitized logs with automatic PII redaction (email, phone, vehicle registration numbers).
              </p>
            </div>

            <button
              type="button"
              onClick={handlePurge}
              className="px-3 py-1.5 rounded-lg border border-border-subtle bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Logs &gt; 90 Days</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-secondary text-text-primary font-semibold border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Sanitized Question</th>
                  <th className="py-3 px-4">Top Score</th>
                  <th className="py-3 px-4">Answered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {queries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-text-muted">
                      No query logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  queries.map((q) => (
                    <tr key={q.id} className="hover:bg-bg-card-subtle transition-colors">
                      <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                        {new Date(q.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-medium text-text-primary max-w-md truncate">
                        {q.question}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {q.topScore ? q.topScore.toFixed(3) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            q.answered
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          }`}
                        >
                          {q.answered ? "Answered" : "Unanswered"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: System Topology & Date Filters */}
      {activeTab === "telemetry" && (
        <div className="space-y-6">
          {/* Date Filter Card */}
          <div className="bg-bg-card p-6 rounded-2xl border border-border-subtle shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent-primary" />
                Filter Telemetry Date Range
              </h3>
              <p className="text-xs text-text-muted">
                Analyze grounding rates and query counts across specific statutory intervals.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border-subtle bg-bg-card text-xs text-text-primary"
                title="From Date"
              />
              <span className="text-xs text-text-muted">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border-subtle bg-bg-card text-xs text-text-primary"
                title="To Date"
              />
              <button
                type="button"
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-hover"
              >
                Apply Filter
              </button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-border-subtle text-xs text-text-secondary hover:bg-bg-secondary"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-bg-card p-6 rounded-2xl border border-border-subtle shadow-sm space-y-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" />
                Service Architecture Status
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="font-semibold text-text-primary">React Web Client (Vite)</span>
                  <span className="text-emerald-600 font-semibold">Port 5173 / Online</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="font-semibold text-text-primary">Node Express API Gateway</span>
                  <span className="text-emerald-600 font-semibold">Port 5000 / Online</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="font-semibold text-text-primary">PostgreSQL 18.4 Database</span>
                  <span className="text-emerald-600 font-semibold">Port 5432 / Online</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="font-semibold text-text-primary">Python FastAPI RAG Microservice</span>
                  <span className="text-emerald-600 font-semibold">Port 8000 / Online</span>
                </div>
              </div>
            </div>

            <div className="bg-bg-card p-6 rounded-2xl border border-border-subtle shadow-sm space-y-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent-primary" />
                Security &amp; Retention Controls
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="text-text-muted">Access Token Storage:</span>
                  <span className="text-text-primary font-semibold">In-Memory Only (15 min)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="text-text-muted">Refresh Token Storage:</span>
                  <span className="text-text-primary font-semibold">httpOnly, SameSite=Strict Cookie</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="text-text-muted">Account Lockout Policy:</span>
                  <span className="text-text-primary font-semibold">5 failed attempts / 15 min lock</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card-subtle border border-border-subtle">
                  <span className="text-text-muted">Telemetry Retention Policy:</span>
                  <span className="text-text-primary font-semibold">90 Days (Automated Purge)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
