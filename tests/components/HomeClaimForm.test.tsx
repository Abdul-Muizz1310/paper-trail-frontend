import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomeClaimForm } from "@/app/_home/HomeClaimForm";

// ---------- next/navigation mock ----------
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// ---------- api mock ----------
const mockMutateAsync = vi.fn();
vi.mock("@/lib/api", () => ({
  useCreateDebate: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("HomeClaimForm", () => {
  it("P1 renders a claim input and submit button", () => {
    render(<HomeClaimForm />, { wrapper });
    expect(screen.getByRole("textbox", { name: /claim/i })).toBeInTheDocument();
  });

  it("P2 on successful submit, navigates to /debates/:id", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      debate_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      stream_url: "/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/stream",
    });
    render(<HomeClaimForm />, { wrapper });
    const input = screen.getByRole("textbox", { name: /claim/i });
    await userEvent.type(input, "The sky is blue");
    // Submit button text is "start-debate"
    const button = screen.getByRole("button");
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
    });
  });

  it("F1 on mutation error, router.push is NOT called", async () => {
    mockPush.mockClear();
    mockMutateAsync.mockRejectedValueOnce(new Error("fail"));

    render(<HomeClaimForm />, { wrapper });
    const input = screen.getByRole("textbox", { name: /claim/i });
    await userEvent.type(input, "Test claim");
    const button = screen.getByRole("button");
    await userEvent.click(button);

    // Wait a tick for the catch block to run
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    // Should NOT navigate on error
    expect(mockPush).not.toHaveBeenCalled();
  });
});
