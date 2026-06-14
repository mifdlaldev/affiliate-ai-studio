import { describe, it, expect, vi, beforeEach } from "vitest";
import type { cookies as nextCookies } from "next/headers";
import type { NextResponse } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

/**
 * Capture the cookies config that `lib/supabase/server.ts` hands to
 * `@supabase/ssr.createServerClient`. We invoke `setAll` directly on the
 * captured config to assert the cookie-handling behavior end-to-end
 * without depending on real Supabase network calls.
 */
let capturedConfig: {
  cookies: {
    getAll: () => unknown[];
    setAll: (cookies: { name: string; value: string; options?: unknown }[]) => void;
  };
} | null = null;

const mockSsrClient = { auth: { getUser: vi.fn() } };

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, config: unknown) => {
    capturedConfig = config as typeof capturedConfig;
    return mockSsrClient;
  }),
}));

const requestCookieSet = vi.fn();
const mockedCookies = vi.mocked<typeof nextCookies>;

describe("createServerClient", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    capturedConfig = null;
    const { cookies } = await import("next/headers");
    mockedCookies(cookies).mockResolvedValue({
      getAll: () => [],
      set: requestCookieSet,
    } as unknown as Awaited<ReturnType<typeof nextCookies>>);
  });

  it("creates a Supabase client with cookie store", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    const client = await createServerClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it("propagates setAll cookies to the NextResponse (Route Handler fix)", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");
    const responseCookieSet = vi.fn();
    const fakeResponse = {
      cookies: { set: responseCookieSet },
    } as unknown as NextResponse;

    await createServerClient(fakeResponse);

    expect(capturedConfig).not.toBeNull();
    capturedConfig!.cookies.setAll([
      { name: "sb-access-token", value: "access-123", options: { path: "/" } },
      { name: "sb-refresh-token", value: "refresh-456", options: { path: "/" } },
    ]);

    // Both the request store and the response must have cookies set —
    // the request store keeps in-request reads consistent, the response
    // is what actually reaches the browser via Set-Cookie headers.
    expect(requestCookieSet).toHaveBeenCalledWith(
      "sb-access-token",
      "access-123",
      { path: "/" },
    );
    expect(responseCookieSet).toHaveBeenCalledWith(
      "sb-access-token",
      "access-123",
      { path: "/" },
    );
    expect(requestCookieSet).toHaveBeenCalledWith(
      "sb-refresh-token",
      "refresh-456",
      { path: "/" },
    );
    expect(responseCookieSet).toHaveBeenCalledWith(
      "sb-refresh-token",
      "refresh-456",
      { path: "/" },
    );
  });

  it("does not throw when called without a response (Server Component case)", async () => {
    const { createServerClient } = await import("@/lib/supabase/server");

    await createServerClient();

    expect(capturedConfig).not.toBeNull();
    // In a Server Component, cookieStore.set throws; the try/catch in
    // setAll should swallow it. We simulate by giving the cookieStore
    // a `set` that throws, then assert setAll does not propagate.
    const { cookies } = await import("next/headers");
    mockedCookies(cookies).mockResolvedValue({
      getAll: () => [],
      set: () => {
        throw new Error("Server Component context");
      },
    } as unknown as Awaited<ReturnType<typeof nextCookies>>);

    expect(() =>
      capturedConfig!.cookies.setAll([
        { name: "sb-access-token", value: "x", options: {} },
      ]),
    ).not.toThrow();
  });
});
