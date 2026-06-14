import { describe, it, expect, vi, beforeEach } from "vitest";
import type { cookies as nextCookies } from "next/headers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockedCookies = vi.mocked<typeof nextCookies>;

describe("createServerClient", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    mockedCookies(cookies).mockResolvedValue({
      getAll: () => [],
      set: () => undefined,
    } as unknown as Awaited<ReturnType<typeof nextCookies>>);
  });

  it("creates a Supabase client with cookie store", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    const client = await createServerClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
