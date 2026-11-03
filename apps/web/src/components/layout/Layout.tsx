import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { TestDataBanner } from "./TestDataBanner";
import { SourceDrawer } from "../chat/SourceDrawer";

export const Layout: React.FC = () => {
  const location = useLocation();
  const isChatRoute = location.pathname === "/chat";

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary selection:bg-accent-light selection:text-accent-primary">
      {/* Skip to Main Content Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-primary focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Persistent Test Data Banner (shows only while any active document is unverified or sample) */}
      <TestDataBanner />

      {/* Primary Sticky Header */}
      <Navbar />

      {/* Main Content Viewport */}
      <main id="main-content" className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Global Source Inspection Drawer */}
      <SourceDrawer />

      {/* Global Footer (omitted on /chat per Part 5 Item 1) */}
      {!isChatRoute && <Footer />}
    </div>
  );
};

export default Layout;
