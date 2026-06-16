import { describe, it, expect } from "vitest";
import {
  projectNameSchema,
  projectIdSchema,
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/validation/projects";

/**
 * Unit tests for the project Zod schemas. Validation sits in front of
 * every Server Action in `lib/actions/projects.ts`; if a rule is wrong,
 * the action never reaches the database, so this layer is the cheapest
 * place to fail loudly.
 *
 * The numeric limits (200 char name, uuid) mirror the column shape of
 * the `projects` table in `lib/supabase/types.ts` and the comment in
 * `supabase/migrations/20260614000003_projects.sql`.
 */

describe("projectNameSchema", () => {
  it("accepts a normal trimmed name", () => {
    const result = projectNameSchema.safeParse("Campaign Ramadan 2026");
    expect(result.success).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = projectNameSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects names longer than 200 characters", () => {
    const result = projectNameSchema.safeParse("x".repeat(201));
    expect(result.success).toBe(false);
  });

  it("accepts names of exactly 200 characters", () => {
    const result = projectNameSchema.safeParse("x".repeat(200));
    expect(result.success).toBe(true);
  });

  it("rejects non-string values", () => {
    const result = projectNameSchema.safeParse(42);
    expect(result.success).toBe(false);
  });
});

describe("projectIdSchema", () => {
  it("accepts a valid uuid", () => {
    const result = projectIdSchema.safeParse(
      "11111111-1111-1111-1111-111111111111"
    );
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid string", () => {
    const result = projectIdSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("parses a valid create payload", () => {
    const payload: CreateProjectInput = { name: "Launch Kopi Nusantara" };
    const result = createProjectSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("parses a valid update payload with id + name", () => {
    const payload: UpdateProjectInput = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Renamed project",
    };
    const result = updateProjectSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects an update with an invalid uuid", () => {
    const result = updateProjectSchema.safeParse({
      id: "nope",
      name: "ok",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an update with an empty name", () => {
    const result = updateProjectSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      name: "",
    });
    expect(result.success).toBe(false);
  });
});
