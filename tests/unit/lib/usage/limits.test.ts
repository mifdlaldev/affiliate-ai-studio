import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    rpc: rpcMock,
  }),
}));

describe("checkAndIncrementUsage", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns allowed when under limit", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: true, remaining: 49 }],
      error: null,
    });
    const { checkAndIncrementUsage } = await import("@/lib/usage/limits");
    const result = await checkAndIncrementUsage("user-id");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(49);
  });

  it("returns not allowed when limit reached", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: false, remaining: 0 }],
      error: null,
    });
    const { checkAndIncrementUsage } = await import("@/lib/usage/limits");
    const result = await checkAndIncrementUsage("user-id");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("throws when RPC returns error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });
    const { checkAndIncrementUsage } = await import("@/lib/usage/limits");
    await expect(checkAndIncrementUsage("user-id")).rejects.toThrow();
  });

  it("calls the increment_user_usage RPC with correct args", async () => {
    rpcMock.mockResolvedValue({
      data: [{ allowed: true, remaining: 49 }],
      error: null,
    });
    const { checkAndIncrementUsage } = await import("@/lib/usage/limits");
    await checkAndIncrementUsage("test-user-123");
    expect(rpcMock).toHaveBeenCalledWith("increment_user_usage", {
      p_user_id: "test-user-123",
    });
  });
});
