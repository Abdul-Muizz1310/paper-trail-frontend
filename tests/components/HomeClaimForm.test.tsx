import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeClaimForm } from "@/app/_home/HomeClaimForm";
import { ApiError } from "@/lib/api";

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
let mockIsError = false;
let mockError: unknown = null;
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    ApiError,
    TIMEOUT_STATUS: 408,
    useCreateDebate: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: mockIsError,
      error: mockError,
    }),
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("HomeClaimForm", () => {
  beforeEach(() => {
    // The submit cooldown is persisted to sessionStorage; clear it so the
    // real-clock submits in P2/F2 can't poison the pinned-clock cooldown
    // tests (F5/F6/F7), and so each test starts with a clean cooldown.
    window.sessionStorage.clear();
    mockIsError = false;
    mockError = null;
  });

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
    const button = screen.getByRole("button", { name: /start[- ]debate|compiling/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
    });
  });

  it("F1 when isError is true, error message and defaultClaim are passed to ClaimInput", () => {
    mockIsError = true;
    mockError = new Error("boom");
    render(<HomeClaimForm />, { wrapper });
    // The error prop renders as role=alert inside ClaimInput
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t start the debate/i);
    mockIsError = false;
    mockError = null;
  });

  it("F3 a 429 rate-limit error surfaces a distinct cooldown message", () => {
    mockIsError = true;
    mockError = new ApiError(429, "POST /debates → 429");
    render(<HomeClaimForm />, { wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent(/too quickly/i);
    // NOT the generic message
    expect(screen.queryByText(/couldn.t start the debate/i)).toBeNull();
    mockIsError = false;
    mockError = null;
  });

  it("F4 a timeout (408) error surfaces a distinct 'took too long' message", () => {
    mockIsError = true;
    mockError = new ApiError(408, "POST /debates → timed out");
    render(<HomeClaimForm />, { wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent(/took too long/i);
    mockIsError = false;
    mockError = null;
  });

  it("F5 a second submit inside the cooldown window does NOT fire a second debate run", async () => {
    // Guards the client-side submit cooldown: the only public entry point
    // must not spawn a fresh LLM debate on every rapid click. If the cooldown
    // in HomeClaimForm is removed, mutateAsync fires twice and this fails.
    mockMutateAsync.mockClear();
    mockPush.mockClear();
    mockMutateAsync.mockResolvedValue({
      debate_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      stream_url: "/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/stream",
    });
    // Pin wall-clock so the second click lands provably inside the 1500ms window.
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const user = userEvent.setup({ delay: null });
    render(<HomeClaimForm />, { wrapper });
    const input = screen.getByRole("textbox", { name: /claim/i });
    await user.type(input, "The sky is blue");
    const button = screen.getByRole("button", { name: /start[- ]debate|compiling/i });

    await user.click(button);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

    // 500ms later — still inside the 1500ms cooldown → dropped.
    nowSpy.mockReturnValue(1_000_500);
    await user.click(button);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });

  it("F6 a submit after the cooldown window elapses IS accepted (cooldown isn't a permanent lock)", async () => {
    mockMutateAsync.mockClear();
    mockPush.mockClear();
    mockMutateAsync.mockResolvedValue({
      debate_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      stream_url: "/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/stream",
    });
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    const user = userEvent.setup({ delay: null });
    render(<HomeClaimForm />, { wrapper });
    const input = screen.getByRole("textbox", { name: /claim/i });
    await user.type(input, "The sky is blue");
    const button = screen.getByRole("button", { name: /start[- ]debate|compiling/i });

    await user.click(button);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

    // 1600ms later — past the 1500ms cooldown → a fresh run is allowed.
    nowSpy.mockReturnValue(2_000_000 + 1600);
    await user.click(button);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));

    nowSpy.mockRestore();
  });

  it("F7 the cooldown survives a reload (persisted in sessionStorage, not just a ref)", async () => {
    // Guards the sessionStorage-backed cooldown: the in-memory ref alone
    // would be defeated by reload-then-resubmit. A fresh mount must still
    // see the prior submit's timestamp and drop a resubmit inside the
    // window. If the persistence is removed, the fresh mount's ref is 0 and
    // this second submit fires a second debate run — failing this test.
    mockMutateAsync.mockClear();
    mockPush.mockClear();
    mockMutateAsync.mockResolvedValue({
      debate_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      stream_url: "/debates/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/stream",
    });
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(5_000_000);
    const user = userEvent.setup({ delay: null });

    // First mount — one accepted submit writes the timestamp to storage.
    const first = render(<HomeClaimForm />, { wrapper });
    await user.type(screen.getByRole("textbox", { name: /claim/i }), "The sky is blue");
    await user.click(screen.getByRole("button", { name: /start[- ]debate|compiling/i }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    first.unmount();

    // Simulate a reload: brand-new mount (in-memory ref is gone) still
    // inside the 1500ms window. The persisted timestamp must drop this one.
    nowSpy.mockReturnValue(5_000_500);
    render(<HomeClaimForm />, { wrapper });
    await user.type(screen.getByRole("textbox", { name: /claim/i }), "The sky is blue");
    await user.click(screen.getByRole("button", { name: /start[- ]debate|compiling/i }));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });

  it("F2 on mutation error, router.push is NOT called", async () => {
    mockPush.mockClear();
    mockMutateAsync.mockRejectedValueOnce(new Error("fail"));

    render(<HomeClaimForm />, { wrapper });
    const input = screen.getByRole("textbox", { name: /claim/i });
    await userEvent.type(input, "Test claim");
    const button = screen.getByRole("button", { name: /start[- ]debate|compiling/i });
    await userEvent.click(button);

    // Wait a tick for the catch block to run
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    // Should NOT navigate on error
    expect(mockPush).not.toHaveBeenCalled();
  });
});
