# DESIGN.md — Design System Reference

> Quick reference untuk design tokens, colors, typography, components. Selalu rujuk file ini saat styling.

## 🎨 Color Palette

### Primary (Indigo)

| Token | Hex | Usage |
|---|---|---|
| `indigo-50` | `#eef2ff` | Subtle backgrounds, hover states |
| `indigo-100` | `#e0e7ff` | Light backgrounds |
| `indigo-200` | `#c7d2fe` | Light accents |
| `indigo-500` | `#6366f1` | Hover states, links |
| **`indigo-600`** | **`#4f46e5`** | **Primary (CTAs, active states, brand)** |
| `indigo-700` | `#4338ca` | Pressed states, focus rings |
| `indigo-900` | `#312e81` | Deep accents |

### Neutral (Slate)

| Token | Hex | Usage |
|---|---|---|
| **`slate-50`** | **`#f8fafc`** | **App background** |
| `slate-100` | `#f1f5f9` | Secondary background, table stripes |
| `slate-200` | `#e2e8f0` | Borders, dividers |
| `slate-300` | `#cbd5e1` | Disabled borders |
| `slate-400` | `#94a3b8` | Placeholder text, icons |
| `slate-500` | `#64748b` | Secondary text, captions |
| `slate-700` | `#334155` | Body text emphasis |
| **`slate-800`** | **`#1e293b`** | **Primary text, headings** |
| `slate-900` | `#0f172a` | Maximum contrast text |

### Semantic

| Token | Hex | Usage |
|---|---|---|
| `emerald-500` | `#10b981` | Success, "Aktif" status, success toasts |
| `amber-500` | `#f59e0b` | Warning, "PRO" badge, Shopee brand |
| `red-500` | `#ef4444` | Error, destructive actions |
| `sky-500` | `#0ea5e9` | Info, links, info toasts |

### Platform Brand Colors

| Platform | Color | Hex |
|---|---|---|
| **Shopee** | Orange | `#f59e0b` |
| **TikTok Shop** | Slate Dark | `#1e293b` |
| **Tokopedia** | Green | `#10b981` |

## 📝 Typography

### Font Families

```css
--font-sans: 'Geist', system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
```

### Font Sizes (Tailwind scale)

| Class | Size | Usage |
|---|---|---|
| `text-xs` | 12px | Captions, table data, badges |
| `text-sm` | 14px | Body small, secondary text, form labels |
| `text-base` | 16px | **Body default** |
| `text-lg` | 18px | Sub-headings, large body |
| `text-xl` | 20px | **Page title** |
| `text-2xl` | 24px | Section heading |
| `text-3xl` | 30px | Page hero |

### Font Weights

| Class | Weight | Usage |
|---|---|---|
| `font-normal` | 400 | Body |
| `font-medium` | 500 | Emphasis, buttons |
| `font-semibold` | 600 | Sub-headings |
| `font-bold` | 700 | **Headings, page title** |
| `font-black` | 900 | Hero, large display |

## 📏 Spacing

### Base Unit: 4px (Tailwind default)

| Class | Size | Usage |
|---|---|---|
| `p-1` / `m-1` | 4px | Tight spacing |
| `p-2` / `m-2` | 8px | Compact |
| `p-3` / `m-3` | 12px | Small |
| **`p-4` / `m-4`** | **16px** | **Default form gap** |
| `p-6` / `m-6` | 24px | **Card padding, section gap** |
| `p-8` / `m-8` | 32px | Large sections |

### Layout Dimensions

- **Sidebar width**: 256px (expanded), 64px (collapsed)
- **Top bar height**: 64px
- **Content max-width**: 1280px
- **Form max-width**: 480px (single column), 768px (two column)
- **Card padding**: 24px (p-6)
- **Section gap**: 24px (gap-6)

## 📐 Border Radius

| Class | Radius | Usage |
|---|---|---|
| `rounded-md` | 6px | Small elements |
| **`rounded-lg`** | **8px** | **Default (inputs, buttons, dropdowns)** |
| `rounded-xl` | 12px | **Cards, large containers** |
| `rounded-2xl` | 16px | Hero sections, large modals |
| `rounded-full` | 9999px | Pills, badges, avatars |

## 🌑 Shadows

| Class | Usage |
|---|---|
| `shadow-sm` | **Default cards, subtle elevation** |
| `shadow-md` | Hover state, dropdowns, popovers |
| `shadow-lg` | Modals, elevated panels |
| `shadow-xl` | Top-level modals, command palette |

## 🧩 Component Library

### Base: shadcn/ui

Components installed:
- Button, Input, Textarea, Select
- Card, Dialog, Sheet (drawer)
- Dropdown Menu, Popover, Tooltip
- Tabs, Accordion, Collapsible
- Table, Data Table
- Toast (Sonner), Alert
- Avatar, Badge, Separator
- Form (with React Hook Form + Zod)
- Command, Calendar

### Custom Components (in `components/shared/`)

| Component | Purpose |
|---|---|
| `Sidebar` | Collapsible navigation |
| `TopBar` | Header dengan search, notifications, user menu |
| `ModuleGeneratorLayout` | Left form + right result pattern |
| `AIResponseViewer` | Display JSON + copy button |
| `AssetCard` | Card untuk asset di library |
| `ProjectCard` | Card untuk project |
| `ProductCard` | Card untuk saved product |
| `StatCard` | Stats untuk Asset Library |
| `AIProgressModal` | Modal dengan streaming text |
| `PromptOutputBox` | Display prompt + copy + regenerate |
| `PlatformTabSwitcher` | Tabs untuk Shopee/TikTok/IG |
| `ExportPanel` | Multi-select format panel |
| `EmptyState` | Icon + heading + CTA |
| `LoadingSkeleton` | Skeleton placeholder |
| `OnboardingModal` | 3-step welcome |

## 🎬 Animations

| Pattern | Duration | Curve |
|---|---|---|
| Page fade-in | 300ms | ease-out |
| Section entrance | 400ms | ease-out |
| Button click (scale 0.97) | 100ms | ease-out |
| Modal open (fade + scale) | 200ms | ease-out |
| Sidebar toggle (width) | 200ms | ease-in-out |
| Toast slide-in | 200ms | ease-out |
| Skeleton pulse | 2000ms | ease-in-out (infinite) |
| AI typing cursor (▍) | 1000ms | linear (infinite) |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 📱 Responsive Breakpoints

| Breakpoint | Min-width | Usage |
|---|---|---|
| (mobile) | 0 | Default styles, mobile-first |
| `sm:` | 640px | Small tablets, large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | **Desktop (sidebar visible)** |
| `xl:` | 1280px | **Large desktop (content max-width)** |
| `2xl:` | 1536px | Very large screens |

## ♿ Accessibility (WCAG 2.2 AA)

- **Color contrast**: ≥ 4.5:1 for body text, ≥ 3:1 for large text
- **Focus visible**: `ring-2 ring-indigo-500 ring-offset-2`
- **Touch target**: ≥ 44x44px (mobile)
- **Form labels**: Every input has visible label or `aria-label`
- **Icon-only buttons**: Must have `aria-label`
- **Skip to main content**: Hidden link visible on focus
- **Keyboard**: All interactive elements accessible via Tab + Enter/Space

## 📐 Common Patterns

### Card with Padding

```tsx
<div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
  <h3 className="text-lg font-bold text-slate-800 mb-4">Title</h3>
  <p className="text-sm text-slate-500">Content</p>
</div>
```

### Primary Button

```tsx
<button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-4 py-2.5 transition-colors active:scale-[0.97]">
  Action
</button>
```

### Input Field

```tsx
<input
  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
  placeholder="Placeholder"
/>
```

### Badge (Status)

```tsx
<span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500 text-white">
  Aktif
</span>
```

## 🎯 Design Principles

1. **Clean Minimal Modern** — Less is more. Whitespace > visual noise
2. **Linear/Vercel-inspired** — Soft shadows, subtle animations, refined details
3. **Information hierarchy** — Clear typography scale, consistent spacing
4. **Accessibility first** — WCAG 2.2 AA minimum, keyboard navigable
5. **Performance** — No bloat, tree-shake, lazy load
6. **Indonesian-first** — Bahasa Indonesia UI, Indonesian platform names
7. **Mobile-first responsive** — Design untuk mobile, enhance untuk desktop
8. **Distinctive, not templated** — Avoid generic "AI-generated" look. Real design taste.

---

**Last updated**: 2026-06-14
**Maintained by**: User (solo developer)
