import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickAnswerCard } from "../components/chat/QuickAnswerCard";
import { QuickAnswerCardData } from "../types";

const mockCard: QuickAnswerCardData = {
  headline: "Section 194D: Penalty for not wearing protective headgear",
  keyFacts: [
    { label: "Section / Rule", value: "Section 194D", sourceIndex: 0, quote: "Section 194D" },
    { label: "Fine", value: "₹1,000", sourceIndex: 0, quote: "fine of one thousand rupees" },
    { label: "Licence action", value: "3-month disqualification", sourceIndex: 0, quote: "disqualified for holding a licence for three months" },
  ],
  keywords: ["Helmet", "Section 129", "Disqualification"],
  notStated: ["Repeat offence", "Applies to"],
  description: {
    explanation: "Two-wheeler riders and pillions must wear ISI-standard helmets under Section 129.",
    clauseText: "Whoever drives a motor cycle or causes or allows a motor cycle to be driven in contravention of the provisions of section 129...",
    conditions: ["Applies to both driver and pillion passenger above 4 years of age"],
    exceptions: ["Sikhs wearing turbans are exempt"],
    relatedSections: ["Section 129", "Section 194C"],
  },
  sourceLine: {
    title: "Motor Vehicles (Amendment) Act 2019",
    section: "Section 194D",
    effectiveDate: "2019-09-01",
    lastReviewedAt: "2026-10-15",
    jurisdiction: "Central",
    verified: false,
  },
};

describe("QuickAnswerCard Component", () => {
  it("renders headline and key facts accurately", () => {
    render(<QuickAnswerCard card={mockCard} />);

    expect(screen.getByText("Section 194D: Penalty for not wearing protective headgear")).toBeDefined();
    expect(screen.getByText("₹1,000")).toBeDefined();
    expect(screen.getByText("Section 194D")).toBeDefined();
    expect(screen.getByText("3-month disqualification")).toBeDefined();
  });

  it("displays keyword chips and notStated items", () => {
    render(<QuickAnswerCard card={mockCard} />);

    expect(screen.getByText("Helmet")).toBeDefined();
    expect(screen.getByText(/Not specified in cited provisions/)).toBeDefined();
    expect(screen.getByText(/Repeat offence, Applies to/)).toBeDefined();
  });

  it("renders compact source line and unverified status chip", () => {
    render(
      <QuickAnswerCard
        card={mockCard}
        allVerified={false}
        anyUnverifiedOrSample={true}
      />
    );

    expect(screen.getByText(/Motor Vehicles \(Amendment\) Act 2019/)).toBeDefined();
    expect(screen.getByText(/In force from 2019-09-01/)).toBeDefined();
    expect(screen.getByText("Unverified source")).toBeDefined();
  });

  it("renders verified status chip when verified is true", () => {
    render(
      <QuickAnswerCard
        card={mockCard}
        allVerified={true}
        anyUnverifiedOrSample={false}
      />
    );

    expect(screen.getByText("Verified source")).toBeDefined();
  });

  it("toggles details panel when show/hide details button is clicked", () => {
    render(<QuickAnswerCard card={mockCard} initialExpanded={false} />);

    const toggleButton = screen.getByRole("button", { name: /details/i });
    expect(toggleButton).toBeDefined();
    expect(toggleButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggleButton);
    expect(toggleButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/ISI-standard helmets/)).toBeDefined();
  });
});

