# Implementation Plan: Asset Library

## Route: `/assets`

## What it does
Browse all generated content from all modules in one place. Filter by module type (hook/caption/script/photo/model/calendar/competitor), search by text, click to view details.

## Data sources (existing tables)
- `generations` — all AI-generated content (hooks, captions, scripts, photos, models, calendars)
- `competitor_analyses` — competitor analyses

## UI
- Top bar: search input + module filter tabs (Semua/Hook/Caption/Script/Photo/Model/Kalender/Kompetitor)
- Content grid: cards showing: module icon + title/subtitle (first 100 chars of result), date, copy/view button
- Click card → expand/lightbox showing full content + copy all
- Empty state: "Belum ada konten yang di-generate"

## Data fetching
- Fetch `generations` from Supabase filtered by user_id AND module
- Performance: paginate with 20 items per page, infinite scroll or "Load More"
