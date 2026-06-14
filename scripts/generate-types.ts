/**
 * Generate lib/supabase/types.ts from the migrations, by introspecting
 * the schema in an in-process pglite instance.
 *
 * Output format mirrors `supabase gen types typescript` so the file can
 * be replaced verbatim by `supabase gen types --local` once a real
 * Supabase instance is available.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const OUTPUT_PATH = "lib/supabase/types.ts";

function pgTypeToTs(pgType: string, udtName: string): string {
  // Prefer udt_name (always short) over data_type (varies by version/locale).
  switch (udtName) {
    case "uuid":
      return "string";
    case "text":
    case "varchar":
    case "char":
    case "bpchar":
    case "citext":
      return "string";
    case "bool":
      return "boolean";
    case "int2":
    case "int4":
    case "int8":
      return "number";
    case "numeric":
    case "float4":
    case "float8":
      return "number";
    case "json":
    case "jsonb":
      return "Json";
    case "timestamp":
    case "timestamptz":
    case "date":
    case "time":
    case "timetz":
      return "string";
    case "bytea":
      return "string";
    case "_int4":
    case "_int8":
    case "_text":
    case "_uuid":
    case "_bool":
    case "int4[]":
    case "int8[]":
    case "text[]":
    case "uuid[]":
      return pgTypeToTs("", udtName.replace(/^_/, "").replace(/\[\]$/, "")) + "[]";
  }
  switch (pgType) {
    case "boolean":
      return "boolean";
    case "integer":
    case "bigint":
    case "smallint":
      return "number";
    case "timestamp with time zone":
    case "timestamp without time zone":
    case "date":
    case "time without time zone":
    case "time with time zone":
      return "string";
  }
  return "unknown";
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
}

async function main() {
  const db = new PGlite();

  // Mock the Supabase auth bits so the migrations apply cleanly.
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      raw_user_meta_data JSONB
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULL::UUID
    $$;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT 'authenticated'::text
    $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN CREATE ROLE service_role NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN CREATE ROLE anon NOLOGIN; END IF;
    END $$;
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await db.exec(await readFile(join(MIGRATIONS_DIR, f), "utf8"));
  }

  const tables = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name;`
  );

  const functions = await db.query<{
    routine_name: string;
    data_type: string;
    arg_name: string | null;
    arg_type: string | null;
    arg_udt: string | null;
    parameter_mode: string | null;
  }>(
    `SELECT r.routine_name, r.data_type,
            p.parameter_name AS arg_name,
            p.data_type AS arg_type,
            p.udt_name AS arg_udt,
            p.parameter_mode
       FROM information_schema.routines r
       LEFT JOIN information_schema.parameters p
         ON p.specific_schema = r.specific_schema
        AND p.specific_name = r.specific_name
      WHERE r.specific_schema = 'public'
        AND r.routine_name NOT IN ('update_updated_at_column', 'handle_new_user')
      ORDER BY r.routine_name, p.ordinal_position;`
  );

  function fieldForTable(c: ColumnInfo, optional: boolean) {
    const ts = pgTypeToTs(c.data_type, c.udt_name);
    const nullable = c.is_nullable === "YES" || optional;
    return `          ${c.column_name}: ${ts}${nullable ? " | null" : ""}`;
  }

  let out = `/**
 * Supabase Database type — generated from supabase/migrations/*.sql
 * by scripts/generate-types.ts (mirrors \`supabase gen types typescript\`).
 *
 * REGENERATE after schema changes:
 *   pnpm db:generate-types
 *
 * If you have a real Supabase project, you can also run:
 *   pnpm dlx supabase gen types typescript --local > lib/supabase/types.ts
 *   pnpm dlx supabase gen types typescript --project-id=<id> > lib/supabase/types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
`;

  for (const { table_name } of tables.rows) {
    const cols = await db.query<ColumnInfo>(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;`,
      [table_name]
    );

    const rowFields = cols.rows.map((c) => fieldForTable(c, false)).join("\n");
    const insertFields = cols.rows
      .map((c) => `          ${c.column_name}?: ${pgTypeToTs(c.data_type, c.udt_name)} | null`)
      .join("\n");
    const updateFields = cols.rows
      .map((c) => `          ${c.column_name}?: ${pgTypeToTs(c.data_type, c.udt_name)} | null`)
      .join("\n");

    out += `      ${table_name}: {
        Row: {
${rowFields}
        }
        Insert: {
${insertFields}
        }
        Update: {
${updateFields}
        }
        Relationships: []
      }
`;
  }

  out += `    }
    Views: Record<string, never>
    Functions: {
`;

  // Group functions by name. Filter to IN parameters only — RETURNS TABLE
  // adds OUT parameters which we don't want in Args.
  const fnGroups = new Map<string, { args: { name: string; type: string }[]; returnType: string }>();
  for (const row of functions.rows) {
    // pglite may report parameter_mode as 'IN' for inputs, 'OUT' for
    // RETURNS TABLE columns, or NULL in some configurations. Treat NULL
    // as IN (most common case in fresh pglite).
    if (row.parameter_mode && row.parameter_mode !== "IN") continue;
    if (!fnGroups.has(row.routine_name)) {
      fnGroups.set(row.routine_name, { args: [], returnType: row.data_type });
    }
    if (row.arg_name) {
      fnGroups.get(row.routine_name)!.args.push({
        name: row.arg_name,
        type: row.arg_udt ?? row.arg_type ?? "unknown",
      });
    }
  }

  for (const [name, info] of fnGroups) {
    const argsType = `{ ${info.args
      .map((a) => `${a.name}: ${pgTypeToTs(a.type, a.type)}`)
      .join("; ")} }`;
    let returnTs = "unknown";
    if (info.returnType === "boolean") returnTs = "boolean";
    else if (info.returnType === "integer" || info.returnType === "bigint")
      returnTs = "number";
    else if (info.returnType === "text" || info.returnType === "uuid")
      returnTs = "string";
    else if (info.returnType.startsWith("record"))
      returnTs = "{ allowed: boolean; remaining: number }[]";
    out += `      ${name}: {
        Args: ${argsType}
        Returns: ${returnTs}
      }
`;
  }

  out += `    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
`;

  await writeFile(OUTPUT_PATH, out, "utf8");
  console.log(`✓ Wrote ${OUTPUT_PATH} (${out.length} bytes, ${out.split("\n").length} lines)`);
  console.log(`  Tables: ${tables.rows.map((r) => r.table_name).join(", ")}`);
  console.log(`  Functions: ${Array.from(fnGroups.keys()).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
