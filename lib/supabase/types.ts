/**
 * Supabase Database type — generated from supabase/migrations/*.sql
 * by scripts/generate-types.ts (mirrors `supabase gen types typescript`).
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
      assets: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          product_id: string | null
          type: string
          subtype: string | null
          name: string
          file_url: string | null
          content: string | null
          thumbnail_url: string | null
          metadata: Json
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          project_id?: string | null
          product_id?: string | null
          type?: string | null
          subtype?: string | null
          name?: string | null
          file_url?: string | null
          content?: string | null
          thumbnail_url?: string | null
          metadata?: Json | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          project_id?: string | null
          product_id?: string | null
          type?: string | null
          subtype?: string | null
          name?: string | null
          file_url?: string | null
          content?: string | null
          thumbnail_url?: string | null
          metadata?: Json | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      competitor_analyses: {
        Row: {
          id: string
          user_id: string
          tiktok_url: string | null
          shopee_url: string | null
          analysis_result: Json
          tokens_used: number | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          tiktok_url?: string | null
          shopee_url?: string | null
          analysis_result?: Json | null
          tokens_used?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          tiktok_url?: string | null
          shopee_url?: string | null
          analysis_result?: Json | null
          tokens_used?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      generations: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          product_id: string | null
          module: string
          subtype: string | null
          input_prompt: string | null
          result: Json | null
          tokens_used: number | null
          duration_ms: number | null
          model: string
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          project_id?: string | null
          product_id?: string | null
          module?: string | null
          subtype?: string | null
          input_prompt?: string | null
          result?: Json | null
          tokens_used?: number | null
          duration_ms?: number | null
          model?: string | null
          status?: string | null
          error_message?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          project_id?: string | null
          product_id?: string | null
          module?: string | null
          subtype?: string | null
          input_prompt?: string | null
          result?: Json | null
          tokens_used?: number | null
          duration_ms?: number | null
          model?: string | null
          status?: string | null
          error_message?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      product_analyses: {
        Row: {
          id: string
          user_id: string
          product_id: string | null
          source_type: string
          source_url: string | null
          analysis_result: Json
          tokens_used: number | null
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          product_id?: string | null
          source_type?: string | null
          source_url?: string | null
          analysis_result?: Json | null
          tokens_used?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          product_id?: string | null
          source_type?: string | null
          source_url?: string | null
          analysis_result?: Json | null
          tokens_used?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string | null
          brand: string | null
          price: string | null
          target_market: string | null
          usp: string | null
          benefits: string | null
          image_url: string | null
          reference_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          name?: string | null
          category?: string | null
          brand?: string | null
          price?: string | null
          target_market?: string | null
          usp?: string | null
          benefits?: string | null
          image_url?: string | null
          reference_link?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          name?: string | null
          category?: string | null
          brand?: string | null
          price?: string | null
          target_market?: string | null
          usp?: string | null
          benefits?: string | null
          image_url?: string | null
          reference_link?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          status: string
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          name?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          archived_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          name?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          archived_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          onboarding_completed: boolean
          monthly_generation_count: number
          monthly_reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean | null
          monthly_generation_count?: number | null
          monthly_reset_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean | null
          monthly_generation_count?: number | null
          monthly_reset_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_user_usage: {
        Args: { p_user_id: string }
        Returns: { allowed: boolean; remaining: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
