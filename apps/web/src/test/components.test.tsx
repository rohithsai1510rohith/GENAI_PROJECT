import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageBubble } from "../components/chat/MessageBubble";
import { SourceDrawer } from "../components/chat/SourceDrawer";
import { EmptyState } from "../components/common/EmptyState";
import { FineResultCard } from "../components/fines/FineResultCard";
import { NotFoundPage } from "../pages/NotFoundPage";
import { useChatStore } from "../store/chatStore";
import { MemoryRouter } from "react-router-dom";

describe("Frontend Components Test Suite", () => {
  it("renders user MessageBubble with right alignment and content", () => {
    render(
      <MessageBubble
        message={{
          id: "u1",
          role: "user",
          content: "What is drunk driving fine?",
          timestamp: new Date().toISOString(),
        }}
      />
    );

    expect(screen.getByText("What is drunk driving fine?")).toBeInTheDocument();
  });

  it("renders assistant MessageBubble with Markdown and sources list", () => {
    render(
      <MessageBubble
        message={{
          id: "a1",
          role: "assistant",
          content: "### Statutory Provisions\nUnder Section 185, fine is **Rs. 10,000**.",
          sources: [
            {
              documentTitle: "Motor Vehicles Amendment Act 2019",
              section: "Section 185",
              page: 1,
              score: 0.85,
              chunkText: "Section 185: Drunk driving penalty Rs. 10,000",
              excerpt: "Section 185: Drunk driving penalty Rs. 10,000",
              isTestData: true,
            },
          ],
          confidenceTier: "HIGH",
          grounded: true,
          timestamp: new Date().toISOString(),
        }}
      />
    );

    expect(screen.getByText("Statutory Provisions")).toBeInTheDocument();
    expect(screen.getByText("Section 185")).toBeInTheDocument();
    expect(screen.getByText("85% match")).toBeInTheDocument();
  });

  it("renders fallback notice when message is ungrounded", () => {
    render(
      <MessageBubble
        message={{
          id: "a2",
          role: "assistant",
          content: "I specialize strictly in Indian traffic rules.",
          grounded: false,
          confidenceTier: "LOW",
          closestTopics: ["Traffic Violations & Penalties"],
          timestamp: new Date().toISOString(),
        }}
      />
    );

    expect(screen.getByText("Out-of-Scope or Low Statutory Grounding")).toBeInTheDocument();
    expect(screen.getByText("Traffic Violations & Penalties")).toBeInTheDocument();
  });

  it("renders SourceDrawer when an active source is set in store", () => {
    useChatStore.getState().openSourceDrawer({
      documentTitle: "Motor Vehicles Act",
      section: "Section 129: Protective Headgear",
      page: 2,
      chunkText: "Section 129: Every person driving a motorcycle shall wear protective headgear.",
      excerpt: "Section 129: Every person driving a motorcycle shall wear protective headgear.",
      score: 0.9,
      sourceUrl: "https://morth.nic.in",
    });

    render(<SourceDrawer />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Section 129: Protective Headgear")).toBeInTheDocument();
    expect(screen.getByText("Page number: 2")).toBeInTheDocument();

    // Clicking close button dismisses drawer
    const closeBtn = screen.getByLabelText("Close clause drawer");
    fireEvent.click(closeBtn);
    expect(useChatStore.getState().activeSourceForDrawer).toBeNull();
  });

  it("renders EmptyState placeholder component with action link", () => {
    render(
      <MemoryRouter>
        <EmptyState
          title="Fines Directory Placeholder"
          badge="Phase 5"
          description="Coming soon in next release."
          primaryAction={{ label: "Go to Chat", href: "/chat" }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Fines Directory Placeholder")).toBeInTheDocument();
    expect(screen.getByText("Phase 5")).toBeInTheDocument();
    expect(screen.getByText("Go to Chat")).toBeInTheDocument();
  });

  it("renders FineResultCard with statutory excerpt, score, and action triggers", () => {
    const handleInspect = vi.fn();
    const handleAsk = vi.fn();

    render(
      <FineResultCard
        item={{
          rule: "Section 185: Driving by a drunken person",
          documentTitle: "Motor Vehicles Amendment Act 2019",
          section: "Section 185",
          fineText: "Punishable with imprisonment up to 6 months or fine of Rs. 10,000.",
          chunkText: "Full clause of Section 185 text...",
          page: 1,
          score: 0.88,
          isTestData: true,
        }}
        onInspect={handleInspect}
        onAskAssistant={handleAsk}
      />
    );

    expect(screen.getByText("Section 185: Driving by a drunken person")).toBeInTheDocument();
    expect(screen.getByText("Match 88%")).toBeInTheDocument();
    expect(screen.getByText(/Punishable with imprisonment/)).toBeInTheDocument();

    // Click inspect
    fireEvent.click(screen.getByText("Inspect Full Clause"));
    expect(handleInspect).toHaveBeenCalledTimes(1);

    // Click ask assistant
    fireEvent.click(screen.getByText("Ask AI"));
    expect(handleAsk).toHaveBeenCalledWith("What are the penalties and rules under Section 185?");
  });

  it("renders NotFoundPage with 404 heading and return link", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Statutory Route Not Found")).toBeInTheDocument();
    expect(screen.getByText("Return to Main Portal")).toBeInTheDocument();
    expect(screen.getByText("Fines Lookup")).toBeInTheDocument();
  });
});
