/**
 * Validate Supabase migrations against a real (in-process) PostgreSQL.
 *
 * Why pglite? Docker isn't available in this sandbox, so we can't run
 * `supabase start`. pglite is a WASM build of PostgreSQL 16 that runs
 * in-process via Node — perfect for syntax + DDL validation.
 *
 * What it catches:
 *   - SQL syntax errors
 *   - Missing references (e.g. a column that doesn't exist)
 *   - Trigger / function compilation errors
 *   - RLS policy syntax errors
 *
 * What it does NOT catch:
 *   - PostgREST-specific behavior
 *   - Supabase Storage RLS (separate schema)
 *   - Real auth.users internals (we mock the schema)
 *
 * Usage: pnpm tsx scripts/validate-migrations.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";

async function main() {
  console.log("→ Initialising pglite (in-process PostgreSQL)...");
  const db = new PGlite();

  // Mock the Supabase-managed auth schema so our trigger on auth.users
  // can be created. We don't need the real auth internals — only the
  // table the trigger references, plus auth.uid() / auth.role() helpers
  // that Supabase wires in via the auth schema in production.
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      raw_user_meta_data JSONB
    );

    -- Per-test "current user" — set via SET LOCAL before each scenario.
    CREATE TABLE IF NOT EXISTS auth.session (
      uid UUID
    );

    -- auth.uid(): returns the current session's user id, or NULL.
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    AS $$
      SELECT uid FROM auth.session LIMIT 1
    $$;

    -- auth.role(): always 'authenticated' in tests (simplification).
    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS TEXT
    LANGUAGE sql
    STABLE
    AS $$
      SELECT 'authenticated'::text
    $$;

    -- Supabase's reserved database roles. In production these are created
    -- by the platform; in a vanilla Postgres (or pglite) they don't exist,
    -- so the GRANT in migration 8 would fail. Create as NOLOGIN roles.
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN CREATE ROLE service_role NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN CREATE ROLE anon NOLOGIN;
      END IF;
    END $$;
  `);
  console.log("  ✓ auth.users mock + auth.uid()/auth.role() helpers created");

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`→ Found ${files.length} migration files`);

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = await readFile(path, "utf8");
    process.stdout.write(`  • ${file} ... `);
    try {
      await db.exec(sql);
      console.log("OK");
    } catch (err) {
      console.error("FAILED");
      console.error("---");
      console.error(err instanceof Error ? err.message : String(err));
      console.error("---");
      console.error("SQL was:\n" + sql);
      process.exit(1);
    }
  }

  console.log("→ Verifying final schema...");

  const tables = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name;`
  );
  console.log(
    "  Tables in public:",
    tables.rows.map((r) => r.table_name).join(", ")
  );

  const expectedTables = [
    "user_profiles",
    "products",
    "projects",
    "assets",
    "generations",
    "product_analyses",
    "competitor_analyses",
  ];
  for (const t of expectedTables) {
    if (!tables.rows.some((r) => r.table_name === t)) {
      console.error(`  ✗ Missing table: ${t}`);
      process.exit(1);
    }
  }
  console.log("  ✓ All 7 expected tables present");

  const rlsRows = await db.query<{ tablename: string; rowsecurity: boolean }>(
    `SELECT tablename, rowsecurity FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename;`
  );
  console.log("  RLS status:");
  for (const r of rlsRows.rows) {
    console.log(`    ${r.tablename}: rls=${r.rowsecurity}`);
    if (!r.rowsecurity) {
      console.error(`  ✗ RLS not enabled on ${r.tablename}`);
      process.exit(1);
    }
  }

  const policies = await db.query<{ tablename: string; policyname: string }>(
    `SELECT tablename, policyname FROM pg_policies
     WHERE schemaname = 'public'
     ORDER BY tablename, policyname;`
  );
  console.log("  Policies:");
  for (const p of policies.rows) {
    console.log(`    ${p.tablename}: ${p.policyname}`);
  }

  // Test the trigger: inserting into auth.users should create a user_profiles row.
  const testUserId = "00000000-0000-0000-0000-000000000001";
  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES ($1, $2, $3::jsonb);`,
    [
      testUserId,
      "test@example.com",
      JSON.stringify({ full_name: "Tester" }),
    ]
  );
  const profile = await db.query<{ id: string; email: string; full_name: string }>(
    `SELECT id, email, full_name FROM public.user_profiles WHERE id = $1;`,
    [testUserId]
  );
  if (profile.rows.length !== 1) {
    console.error("  ✗ handle_new_user trigger did not create a profile");
    process.exit(1);
  }
  console.log("  ✓ handle_new_user trigger created profile:", profile.rows[0]);

  // Test increment_user_usage: first call should be allowed, returning remaining=49.
  const r1 = await db.query<{ allowed: boolean; remaining: number }>(
    `SELECT * FROM public.increment_user_usage($1);`,
    [testUserId]
  );
  console.log("  increment_user_usage() #1:", r1.rows[0]);
  if (r1.rows[0].allowed !== true || r1.rows[0].remaining !== 49) {
    console.error("  ✗ increment_user_usage() returned unexpected result");
    process.exit(1);
  }

  // Run it 49 more times to exhaust the limit (50 total).
  for (let i = 0; i < 49; i++) {
    await db.query(`SELECT * FROM public.increment_user_usage($1);`, [testUserId]);
  }
  const r50 = await db.query<{ allowed: boolean; remaining: number }>(
    `SELECT * FROM public.increment_user_usage($1);`,
    [testUserId]
  );
  console.log("  increment_user_usage() #51 (should be denied):", r50.rows[0]);
  if (r50.rows[0].allowed !== false) {
    console.error("  ✗ increment_user_usage() did not enforce the limit");
    process.exit(1);
  }
  console.log("  ✓ Monthly limit enforced at 50");

  console.log("\n✅ All migrations validated successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
