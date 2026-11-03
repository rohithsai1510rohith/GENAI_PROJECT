import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Layout } from "./components/layout/Layout";
import { AuthProvider } from "./context/AuthContext";

// Lazy-loaded routes for optimal bundle code splitting (PRD Section 14)
const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const ChatPage = lazy(() => import("./pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const FinesPage = lazy(() => import("./pages/FinesPage").then((m) => ({ default: m.FinesPage })));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage").then((m) => ({ default: m.KnowledgePage })));
const AboutPage = lazy(() => import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

const PageLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh] text-center" role="status" aria-live="polite">
    <div className="w-12 h-12 rounded-full border-3 border-primary-200 border-t-primary-600 animate-spin mb-4" />
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading statutory intelligence...</p>
    <span className="sr-only">Loading page content</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<LandingPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="fines" element={<FinesPage />} />
                <Route path="documents" element={<KnowledgePage />} />
                <Route path="knowledge" element={<KnowledgePage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="admin/login" element={<AdminLoginPage />} />
                <Route path="admin" element={<AdminDashboardPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  );
};

export default App;
