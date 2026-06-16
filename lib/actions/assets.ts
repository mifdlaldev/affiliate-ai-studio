"use server";

import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

/**
 * One row from the unified Asset Library feed. The shape is identical
 * regardless of whether the row came from `generations` or
 * `competitor_analyses` — the source is normalised at fetch time so
 * the client can render a single feed.
 */
export interface Asset {
  id: string;
  module: string;
  subtype: string | null;
  result: Json;
  createdAt: string;
  /** First 100 chars of the JSON-serialised result, for list previews. */
  previewText: string;
}

export interface FetchAssetsOptions {
  module?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface FetchCompetitorAnalysesOptions {
  page?: number;
  limit?: number;
}

export interface FetchResult {
  data: Asset[];
  total: number;
  page: number;
}

const PREVIEW_TEXT_MAX = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Stringify a JSON result and clip to a short preview. Safe against
 * non-serialisable values (e.g. circular refs) — we fall back to "".
 */
function buildPreviewText(result: Json | null | undefined): string {
  if (result == null) return "";
  try {
    return JSON.stringify(result).slice(0, PREVIEW_TEXT_MAX);
  } catch {
    return "";
  }
}

function emptyResult(page: number): FetchResult {
  return { data: [], total: 0, page };
}

/**
 * Escape Postgres LIKE/ILIKE metacharacters (`%`, `_`, `\`) in a user
 * search term so they're matched literally instead of as wildcards.
 */
function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, (m) => `\\${m}`);
}

interface GenerationRow {
  id: string;
  module: string;
  subtype: string | null;
  result: Json;
  created_at: string;
}

interface CompetitorRow {
  id: string;
  analysis_result: Json;
  created_at: string;
}

/**
 * Server Action: list the current user's AI generations for the Asset
 * Library, with optional module + search filters and pagination.
 *
 * Behaviour:
 *  - Always scopes by `user_id` from the auth session.
 *  - `module === "all"` (or omitted) returns every module.
 *  - `search` is matched against `input_prompt` and the
 *    `result::text` cast using ILIKE.
 *  - Returns an empty page (not an error) when the user is signed out
 *    or the DB query fails — the Asset Library is read-only and
 *    should degrade silently rather than throw in the client.
 */
export async function fetchAssets(
  options: FetchAssetsOptions = {},
): Promise<FetchResult> {
  const page = options.page ?? DEFAULT_PAGE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return emptyResult(page);
    }

    let query = supabase
      .from("generations")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);

    if (options.module && options.module !== "all") {
      query = query.eq("module", options.module);
    }

    if (options.search && options.search.trim().length > 0) {
      const term = escapeIlike(options.search.trim());
      query = query.or(
        `input_prompt.ilike.%${term}%,result::text.ilike.%${term}%`,
      );
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return emptyResult(page);
    }

    const assets: Asset[] = (data as GenerationRow[]).map((row) => ({
      id: row.id,
      module: row.module,
      subtype: row.subtype,
      result: row.result,
      createdAt: row.created_at,
      previewText: buildPreviewText(row.result),
    }));

    return { data: assets, total: count ?? assets.length, page };
  } catch {
    return emptyResult(page);
  }
}

/**
 * Server Action: list the current user's Competitor Analyses, mapped
 * into the unified `Asset` shape. The `analysis_result` JSONB column
 * becomes `Asset.result`, and `Asset.module` is hard-coded to
 * `"competitor"` so the feed can filter by it consistently.
 */
export async function fetchCompetitorAnalyses(
  options: FetchCompetitorAnalysesOptions = {},
): Promise<FetchResult> {
  const page = options.page ?? DEFAULT_PAGE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return emptyResult(page);
    }

    const { data, count, error } = await supabase
      .from("competitor_analyses")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return emptyResult(page);
    }

    const assets: Asset[] = (data as CompetitorRow[]).map((row) => ({
      id: row.id,
      module: "competitor",
      subtype: null,
      result: row.analysis_result,
      createdAt: row.created_at,
      previewText: buildPreviewText(row.analysis_result),
    }));

    return { data: assets, total: count ?? assets.length, page };
  } catch {
    return emptyResult(page);
  }
}
