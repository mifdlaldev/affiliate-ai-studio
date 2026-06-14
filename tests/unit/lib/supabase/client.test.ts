import { describe, it, expect } from "vitest";
import { createBrowserClient } from "@/lib/supabase/client";

describe("createBrowserClient", () => {
  it("creates a Supabase client", () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
