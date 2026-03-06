# Riptide Deck

## Project Overview
Operational tools for **Riptide Music Publishing**. A Next.js 14 web app for song registration (Story to Splits), catalog document import with cross-PRO auditing (Document to Splits), dataset comparison, and exception reporting.

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4 + PostCSS
- **Database**: SQLite via better-sqlite3 (local `.data/` directory)
- **i18n**: next-intl (6 locales: en, es, fr, de, ja, pt)
- **Tables**: TanStack React Table v8
- **Icons**: lucide-react
- **Parsing**: papaparse (CSV), exceljs (Excel), native JSON
- **DB Connectors**: pg (PostgreSQL), mysql2 (MySQL/MariaDB)
- **Validation**: zod (available, not yet used)

## Commands
```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build (also type-checks)
npm run lint      # ESLint
npm run format    # Prettier format check
npm run format:fix # Prettier auto-fix
```

## Architecture

### Directory Structure
```
src/
├── app/
│   ├── [locale]/           # i18n-wrapped pages
│   │   ├── layout.tsx      # Root layout (server component)
│   │   ├── page.tsx        # Dashboard
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   ├── components/     # Page-scoped components
│   │   ├── songs/          # Song registry + Story to Splits
│   │   ├── documents/      # Document import + cross-PRO audit
│   │   ├── comparison/     # Comparison wizard + results
│   │   ├── connections/    # DB connection manager
│   │   ├── datasets/       # Dataset upload & management
│   │   └── history/        # Comparison history
│   └── api/                # API routes (all server-side)
│       ├── songs/          # Song CRUD + story parser
│       ├── documents/      # Document import + cross-reference
│       ├── stats/          # Dashboard statistics
│       └── ...             # Comparisons, datasets, etc.
├── components/             # Shared components
├── i18n/                   # Internationalization config
├── lib/
│   ├── comparison/         # Core comparison engine
│   ├── connectors/         # Database connector classes
│   ├── db/                 # SQLite data layer (store.ts)
│   └── parsers/
│       ├── csv.ts, excel.ts, json.ts  # File parsers
│       └── music/          # Music industry parsers (BMI, Curve, PDF)
├── messages/               # Translation JSON files (6 locales)
├── types/                  # Type declarations (speech.d.ts)
└── middleware.ts            # i18n routing middleware
```

### Key Patterns
- Almost all pages are **client components** (`'use client'`) except the root layout
- State management is **component-local** (useState/useEffect) — no global store
- API routes handle all server-side logic; pages fetch from `/api/*`
- The comparison engine produces "exceptions" (matched, modified, added, removed)
- Column mapping supports B→A name resolution for cross-dataset comparison
- Inline cell editing with enrichment values overlay
- Story to Splits: narrate a song's creation story → AI parses into structured registration data
- Document to Splits: upload BMI CSV, Curve Excel, or PDF → parse songs → cross-reference MLC/SongView

### Database Schema (SQLite)
- `datasets` — uploaded/imported data with JSON columns and rows
- `connections` — saved database connection configs
- `comparisons` — comparison runs with config and summary
- `exceptions` — individual row-level comparison results
- `songs` — registered songs (from Story to Splits or document import)
- `contributors` — people attached to songs with roles and split percentages
- `documents` — imported catalog documents (BMI, Curve, PDF)
- `document_songs` — individual songs parsed from documents
- `song_external_refs` — cross-PRO reference data (MLC, SongView lookups)

## Code Conventions
- TypeScript strict mode
- Path alias: `@/*` → `./src/*`
- Use `interface` for component props, `type` for unions/intersections
- Tailwind classes use the project's custom color tokens (surface-*, text-*, border-*, status-*, brand-*)
- Translation keys live in `src/messages/*.json`; access via `useTranslations('namespace')`
- API routes use `NextRequest`/`NextResponse` from `next/server`

## Important Notes
- The `.data/` directory is gitignored — SQLite DB is created at runtime
- External packages (better-sqlite3, pg, mysql2, exceljs) are in `serverComponentsExternalPackages`
- `globals.css` lives at `src/app/globals.css` (imported by locale layout, NOT `app/` root)
