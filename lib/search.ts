import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export interface ProductSearchResult {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  image_url: string | null;
}

export interface ProjectSearchResult {
  id: string;
  name: string;
  status: string;
}

export interface AssetSearchResult {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
}

export interface SearchResults {
  products: ProductSearchResult[];
  projects: ProjectSearchResult[];
  assets: AssetSearchResult[];
}

const RESULT_LIMIT = 5;

const EMPTY_RESULTS: SearchResults = {
  products: [],
  projects: [],
  assets: [],
};

export async function globalSearch(
  supabase: SupabaseClient<Database>,
  query: string,
): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return EMPTY_RESULTS;
  }

  const pattern = `%${trimmed}%`;

  const [productsRes, projectsRes, assetsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, brand, image_url")
      .or(
        `name.ilike.${pattern},category.ilike.${pattern},brand.ilike.${pattern}`,
      )
      .limit(RESULT_LIMIT),
    supabase
      .from("projects")
      .select("id, name, status")
      .ilike("name", pattern)
      .limit(RESULT_LIMIT),
    supabase
      .from("assets")
      .select("id, name, type, subtype")
      .or(`name.ilike.${pattern},content.ilike.${pattern}`)
      .limit(RESULT_LIMIT),
  ]);

  return {
    products: (productsRes.data ?? []) as ProductSearchResult[],
    projects: (projectsRes.data ?? []) as ProjectSearchResult[],
    assets: (assetsRes.data ?? []) as AssetSearchResult[],
  };
}
