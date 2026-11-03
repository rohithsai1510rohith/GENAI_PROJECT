import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../services/api";

describe("Phase 6 Admin Frontend Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    // Default mock for silent refresh fetch to prevent network errors in test environment
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/auth/refresh")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ success: false }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} }),
      } as Response);
    });
  });

  describe("AdminLoginPage", () => {
    it("renders Admin Authority Portal form without any hard-coded demo credentials", () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <AdminLoginPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText("Admin Authority Portal")).toBeInTheDocument();
      expect(screen.getByLabelText(/Official Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Secure Password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign In to Admin Portal" })).toBeInTheDocument();

      // Strictly verify no demo auto-fill box or default credentials are shown
      expect(screen.queryByText(/Demo Admin Credentials/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Auto Fill" })).not.toBeInTheDocument();
    });

    it("displays error alert when login fails", async () => {
      vi.spyOn(api, "adminLogin").mockRejectedValue(new Error("Invalid administrative credentials"));

      render(
        <AuthProvider>
          <MemoryRouter>
            <AdminLoginPage />
          </MemoryRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/Official Email Address/i);
      const passwordInput = screen.getByLabelText(/Secure Password/i);

      fireEvent.change(emailInput, { target: { value: "officer@trafficassistant.gov.in" } });
      fireEvent.change(passwordInput, { target: { value: "WrongSecretPassword123!" } });

      fireEvent.click(screen.getByRole("button", { name: "Sign In to Admin Portal" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Invalid administrative credentials")).toBeInTheDocument();
      });
    });
  });

  describe("AdminDashboardPage", () => {
    it("renders authenticated dashboard with analytics, telemetry, and tabs", async () => {
      // Mock silent refresh returning active user session
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/v1/auth/refresh")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  token: "mock-jwt-in-memory-token",
                  user: { id: "user-1", email: "admin@transport.gov.in", role: "admin" },
                },
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: {} }),
        } as Response);
      });

      vi.spyOn(api, "fetchAdminAnalytics").mockResolvedValue({
        totalQueries: 142,
        answeredQueries: 136,
        unansweredQueries: 6,
        groundedRate: "95.8%",
        feedback: {
          total: 20,
          positive: 19,
          negative: 1,
          satisfactionRate: "95%",
        },
        vectorIndex: {
          totalVectors: 55,
          activeDocuments: 3,
          lastReindexAt: "2026-10-22T05:00:00Z",
        },
      });

      vi.spyOn(api, "fetchAdminDocuments").mockResolvedValue({
        documents: [
          {
            id: "doc-1",
            title: "Motor Vehicles (Amendment) Act 2019",
            rawFilename: "mv_act.txt",
            type: "Act",
            jurisdiction: "Central",
            effectiveDate: "2019-09-01",
            sourceUrl: "https://morth.nic.in",
            status: "indexed",
            chunkCount: 24,
            isTestData: false,
            verified: true,
            indexedAt: new Date().toISOString(),
          },
        ],
        count: 1,
      });

      vi.spyOn(api, "fetchAdminQueries").mockResolvedValue({
        queries: [
          {
            id: "log-1",
            question: "What is the fine for helmet under Section 194D?",
            answered: true,
            topScore: 0.89,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      });

      render(
        <AuthProvider>
          <MemoryRouter>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Administrative Control Portal")).toBeInTheDocument();
        expect(screen.getByText("Official Authority")).toBeInTheDocument();
        expect(screen.getByText("142")).toBeInTheDocument();
        expect(screen.getByText("95.8%")).toBeInTheDocument();
      });

      // Verify Tab switching
      const registryTab = screen.getByRole("button", { name: /Statutory Document Registry/i });
      fireEvent.click(registryTab);

      await waitFor(() => {
        expect(screen.getByText("Statutory Document Registry")).toBeInTheDocument();
        expect(screen.getByText("Motor Vehicles (Amendment) Act 2019")).toBeInTheDocument();
        expect(screen.getByText("Deactivate")).toBeInTheDocument();
      });
    });

    it("handles administrator sign out and clears session", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/v1/auth/refresh")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  token: "mock-jwt-in-memory-token",
                  user: { id: "user-1", email: "admin@transport.gov.in", role: "admin" },
                },
              }),
          } as Response);
        }
        if (url.includes("/api/v1/auth/logout")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: {} }),
        } as Response);
      });

      vi.spyOn(api, "fetchAdminAnalytics").mockResolvedValue({
        totalQueries: 10,
        answeredQueries: 10,
        unansweredQueries: 0,
        groundedRate: "100%",
        feedback: { total: 0, positive: 0, negative: 0, satisfactionRate: "100%" },
        vectorIndex: { totalVectors: 10, activeDocuments: 1, lastReindexAt: new Date().toISOString() },
      });
      vi.spyOn(api, "fetchAdminDocuments").mockResolvedValue({ documents: [], count: 0 });
      vi.spyOn(api, "fetchAdminQueries").mockResolvedValue({ queries: [], total: 0, limit: 25, offset: 0 });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={["/admin"]}>
            <AdminDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Sign Out/i })).toBeInTheDocument();
      });

      const signOutBtn = screen.getByRole("button", { name: /Sign Out/i });
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/auth/logout"),
          expect.anything()
        );
      });
    });
  });
});
