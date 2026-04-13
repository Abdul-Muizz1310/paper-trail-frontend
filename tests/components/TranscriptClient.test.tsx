import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranscriptClient } from "@/app/debates/[id]/transcript/TranscriptClient";

// ---------- api mock ----------
const mockUseDebate = vi.fn();
vi.mock("@/lib/api", () => ({
  useDebate: (...args: unknown[]) => mockUseDebate(...args),
}));

// ---------- next/link mock (render as plain <a>) ----------
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const DEBATE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("TranscriptClient", () => {
  it("P1 shows loading state when query is pending", () => {
    mockUseDebate.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(<TranscriptClient debateId={DEBATE_ID} />, { wrapper });
    expect(screen.getByTestId("transcript-loading")).toBeInTheDocument();
  });

  it("P2 shows error state when query fails", () => {
    mockUseDebate.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("fail"),
    });
    render(<TranscriptClient debateId={DEBATE_ID} />, { wrapper });
    expect(screen.getByTestId("transcript-error")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load this transcript/)).toBeInTheDocument();
  });

  it("P3 renders transcript markdown when data is available", () => {
    mockUseDebate.mockReturnValue({
      data: {
        id: DEBATE_ID,
        claim: "test",
        status: "done",
        verdict: "TRUE",
        confidence: 0.9,
        rounds: [],
        transcript_md: "# Debate transcript\n\nHello world",
        created_at: "2026-04-10T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    render(<TranscriptClient debateId={DEBATE_ID} />, { wrapper });
    expect(screen.getByText("Debate transcript")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("P4 renders empty string when transcript_md is null", () => {
    mockUseDebate.mockReturnValue({
      data: {
        id: DEBATE_ID,
        claim: "test",
        status: "done",
        verdict: null,
        confidence: null,
        rounds: [],
        transcript_md: null,
        created_at: "2026-04-10T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    render(<TranscriptClient debateId={DEBATE_ID} />, { wrapper });
    // No crash; transcript view renders but without content
    expect(screen.queryByTestId("transcript-loading")).toBeNull();
    expect(screen.queryByTestId("transcript-error")).toBeNull();
  });

  it("P5 has a back link to the debate page", () => {
    mockUseDebate.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(<TranscriptClient debateId={DEBATE_ID} />, { wrapper });
    const backLink = screen.getByText("cd ..");
    expect(backLink.closest("a")).toHaveAttribute("href", `/debates/${DEBATE_ID}`);
  });
});
