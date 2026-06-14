import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Integration test for supabase/migrations/*.sql.
 *
 * Uses pglite (in-process Postgres via WASM) to apply every migration in
 * order and assert the resulting schema matches the design spec. Docker is
 * not required — this is the same approach used in `pnpm db:validate`.
 *
 * Mock the auth schema and platform roles so migrations can be applied
 * without a real Supabase instance.
 */

async function bootstrap(db: PGlite) {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      raw_user_meta_data JSONB
    );
    CREATE TABLE IF NOT EXISTS auth.session (uid UUID);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE sql STABLE AS $$ SELECT uid FROM auth.session LIMIT 1 $$;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
      LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN CREATE ROLE service_role NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN CREATE ROLE anon NOLOGIN; END IF;
    END $$;
  `);
}

async function applyMigrations(db: PGlite) {
  const dir = "supabase/migrations";
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await db.exec(await readFile(join(dir, f), "utf8"));
  }
  return files;
}

describe("Supabase migrations", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await bootstrap(db);
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("apply cleanly without errors", async () => {
    const files = await applyMigrations(db);
    expect(files).toHaveLength(8);
  });

  it("create all 7 expected tables in public schema", async () => {
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name;`
    );
    const expected = [
      "assets",
      "competitor_analyses",
      "generations",
      "product_analyses",
      "products",
      "projects",
      "user_profiles",
    ];
    const actual = result.rows.map((r) => r.table_name);
    expect(actual).toEqual(expected);
  });

  it("enable RLS on all 7 tables", async () => {
    const result = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables
       WHERE schemaname = 'public';`
    );
    expect(result.rows).toHaveLength(7);
    for (const row of result.rows) {
      expect(row.rowsecurity).toBe(true);
    }
  });

  it("create at least one policy per table", async () => {
    const result = await db.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public' ORDER BY tablename;`
    );
    const byTable = new Map<string, string[]>();
    for (const row of result.rows) {
      if (!byTable.has(row.tablename)) byTable.set(row.tablename, []);
      byTable.get(row.tablename)!.push(row.policyname);
    }
    const tables = [
      "assets",
      "competitor_analyses",
      "generations",
      "product_analyses",
      "products",
      "projects",
      "user_profiles",
    ];
    for (const t of tables) {
      expect(byTable.get(t)?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("auto-create a user_profiles row on auth.users insert (handle_new_user trigger)", async () => {
    // Trigger is per-insert AFTER, so insert directly into auth.users.
    const id = "11111111-1111-1111-1111-111111111111";
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb);`,
      [id, "auto@example.com", JSON.stringify({ full_name: "Auto User" })]
    );
    const profile = await db.query<{ id: string; full_name: string }>(
      `SELECT id, full_name FROM public.user_profiles WHERE id = $1;`,
      [id]
    );
    expect(profile.rows).toHaveLength(1);
    expect(profile.rows[0].full_name).toBe("Auto User");
  });

  it("increment_user_usage(): first call allows and decrements remaining", async () => {
    const id = "22222222-2222-2222-2222-222222222222";
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{}'::jsonb);`,
      [id, "counter1@example.com"]
    );
    const r = await db.query<{ allowed: boolean; remaining: number }>(
      `SELECT * FROM public.increment_user_usage($1);`,
      [id]
    );
    expect(r.rows[0].allowed).toBe(true);
    expect(r.rows[0].remaining).toBe(49);
  });

  it("increment_user_usage(): denies after 50 generations in the same month", async () => {
    const id = "33333333-3333-3333-3333-333333333333";
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{}'::jsonb);`,
      [id, "counter2@example.com"]
    );
    // 50 successful calls, then 51st should be denied.
    for (let i = 0; i < 50; i++) {
      await db.query(`SELECT public.increment_user_usage($1);`, [id]);
    }
    const denied = await db.query<{ allowed: boolean; remaining: number }>(
      `SELECT * FROM public.increment_user_usage($1);`,
      [id]
    );
    expect(denied.rows[0].allowed).toBe(false);
    expect(denied.rows[0].remaining).toBe(0);
  });

  it("updated_at triggers bump the column on UPDATE", async () => {
    const id = "44444444-4444-4444-4444-444444444444";
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{}'::jsonb);`,
      [id, "upd@example.com"]
    );
    const before = await db.query<{ updated_at: string }>(
      `SELECT updated_at FROM public.user_profiles WHERE id = $1;`,
      [id]
    );
    // Sleep 10ms to ensure now() advances.
    await new Promise((r) => setTimeout(r, 15));
    await db.query(`UPDATE public.user_profiles SET full_name = 'X' WHERE id = $1;`, [id]);
    const after = await db.query<{ updated_at: string }>(
      `SELECT updated_at FROM public.user_profiles WHERE id = $1;`,
      [id]
    );
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0].updated_at).getTime()
    );
  });
});
