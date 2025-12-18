# Enrichment Pipeline Architecture

## Overview

The enrichment pipeline uses the **Strategy Pattern** to apply type-specific enrichments to inbox files **before** classification. This ensures the LLM has better content for suggesting destinations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INBOX PROCESSING PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐  │
│   │  SCAN  │───▶│ ENRICH  │───▶│ CLASSIFY │───▶│ SUGGEST │───▶│ REVIEW  │  │
│   └────────┘    └────┬────┘    └──────────┘    └─────────┘    └────┬────┘  │
│        │             │              │               │               │       │
│        ▼             ▼              ▼               ▼               ▼       │
│   Find files    Strategy      LLM detects      Build           User        │
│   in inbox      Pattern       doc type &       suggestions     approves    │
│                               destination                                   │
│                                                                             │
│                      │                                              │       │
│                      ▼                                              ▼       │
│               ┌─────────────┐                                 ┌─────────┐   │
│               │   EXECUTE   │◀────────────────────────────────│ EXECUTE │   │
│               └─────────────┘                                 └─────────┘   │
│                      │                                                      │
│                      ▼                                                      │
│               Create notes                                                  │
│               Move files                                                    │
│               Git commit                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Enrichment Stage Detail

```
                              ENRICHMENT PIPELINE
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Input: InboxFile                                                           │
│  ┌──────────────────────────────────────┐                                   │
│  │ path: "00 Inbox/my-bookmark.md"      │                                   │
│  │ frontmatter:                         │                                   │
│  │   type: bookmark                     │                                   │
│  │   url: https://example.com           │                                   │
│  │   title: "Some Page"                 │                                   │
│  └──────────────────────────────────────┘                                   │
│                     │                                                       │
│                     ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    STRATEGY SELECTION                                │    │
│  │                    (checked in priority order)                       │    │
│  │                                                                      │    │
│  │   ┌─────────────────────────┐                                       │    │
│  │   │ BookmarkStrategy        │ priority: 100                         │    │
│  │   │ canEnrich() ──────────▶ │ type === "bookmark" && url exists?    │    │
│  │   │                         │ not already enriched?                  │    │
│  │   └───────────┬─────────────┘                                       │    │
│  │               │ ✓ eligible                                          │    │
│  │               ▼                                                      │    │
│  │   ┌─────────────────────────┐                                       │    │
│  │   │ [Future: PDFStrategy]   │ priority: 90                          │    │
│  │   │ canEnrich() ──────────▶ │ extension === ".pdf"?                 │    │
│  │   └─────────────────────────┘                                       │    │
│  │                                                                      │    │
│  │   ┌─────────────────────────┐                                       │    │
│  │   │ [Future: ImageStrategy] │ priority: 80                          │    │
│  │   │ canEnrich() ──────────▶ │ extension in [".png", ".jpg"]?        │    │
│  │   └─────────────────────────┘                                       │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                     │                                                       │
│                     │ First matching strategy                               │
│                     ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    BOOKMARK ENRICHMENT                               │    │
│  │                                                                      │    │
│  │   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │    │
│  │   │  Firecrawl  │─────▶│     LLM     │─────▶│   Update    │         │    │
│  │   │   Scrape    │      │  Improve    │      │ Frontmatter │         │    │
│  │   └─────────────┘      └─────────────┘      └─────────────┘         │    │
│  │         │                    │                    │                  │    │
│  │         ▼                    ▼                    ▼                  │    │
│  │   Fetch page           Generate:            Write back:              │    │
│  │   content as           - Better title       - title                  │    │
│  │   markdown             - Summary            - originalTitle          │    │
│  │                        - Domain             - summary                │    │
│  │                                             - domain                 │    │
│  │                                             - enrichedAt             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                     │                                                       │
│                     ▼                                                       │
│  Output: EnrichmentPipelineResult                                           │
│  ┌──────────────────────────────────────┐                                   │
│  │ enriched: true                       │                                   │
│  │ strategyId: "bookmark"               │                                   │
│  │ frontmatter:                         │                                   │
│  │   type: bookmark                     │                                   │
│  │   url: https://example.com           │                                   │
│  │   title: "Bookmark Example Guide"    │  ◀── improved!                    │
│  │   originalTitle: "Some Page"         │  ◀── preserved                    │
│  │   summary: "Comprehensive guide..."  │  ◀── generated!                   │
│  │   domain: "example.com"              │  ◀── extracted                    │
│  │   enrichedAt: "2024-12-18T..."       │  ◀── timestamped                  │
│  └──────────────────────────────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Before vs After Enrichment

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│         BEFORE ENRICHMENT       │     │         AFTER ENRICHMENT        │
├─────────────────────────────────┤     ├─────────────────────────────────┤
│                                 │     │                                 │
│ ---                             │     │ ---                             │
│ type: bookmark                  │     │ type: bookmark                  │
│ url: https://vercel.com/docs/   │     │ url: https://vercel.com/docs/   │
│      functions/runtimes         │     │      functions/runtimes         │
│ title: Vercel Docs Page    ◀────┼─────┼─▶ title: Bookmark Vercel        │
│ clipped: 2024-12-18             │     │        Functions Runtimes       │
│ ---                             │     │ clipped: 2024-12-18             │
│                                 │     │ originalTitle: Vercel Docs Page │
│ # Clipped from web              │     │ summary: Complete reference for │
│                                 │     │   Vercel's supported function   │
│ Some Vercel documentation.      │     │   runtimes including Node.js,   │
│                                 │     │   Bun, Python, Rust, Go, Ruby,  │
│                                 │     │   Wasm, and Edge...             │
│                                 │     │ domain: vercel.com              │
│                                 │     │ enrichedAt: 2024-12-18T12:00:00Z│
│                                 │     │ ---                             │
│                                 │     │                                 │
│                                 │     │ # Clipped from web              │
│                                 │     │                                 │
│                                 │     │ Some Vercel documentation.      │
│                                 │     │                                 │
└─────────────────────────────────┘     └─────────────────────────────────┘

         Generic title                         Descriptive title
         No summary                            LLM-generated summary
         No metadata                           Domain + timestamp
```

## Strategy Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STRATEGY PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   interface EnrichmentStrategy {                                            │
│     id: string;           // "bookmark", "pdf", "image"                     │
│     name: string;         // Human-readable name                            │
│     priority: number;     // Higher = checked first                         │
│                                                                             │
│     canEnrich(ctx): EnrichmentEligibility;   // Fast check                  │
│     enrich(ctx, options): Promise<EnrichmentResult>;  // Do the work        │
│   }                                                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CURRENT STRATEGIES:                                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   ┌───────────────────────┐                                         │   │
│   │   │  BookmarkStrategy     │  priority: 100                          │   │
│   │   │  ─────────────────    │                                         │   │
│   │   │  Checks:              │                                         │   │
│   │   │  • type === "bookmark"│                                         │   │
│   │   │  • url exists         │                                         │   │
│   │   │  • not enrichedAt     │                                         │   │
│   │   │                       │                                         │   │
│   │   │  Actions:             │                                         │   │
│   │   │  • Firecrawl scrape   │                                         │   │
│   │   │  • LLM improve title  │                                         │   │
│   │   │  • LLM gen summary    │                                         │   │
│   │   └───────────────────────┘                                         │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   FUTURE STRATEGIES (extensible):                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   ┌───────────────────────┐   ┌───────────────────────┐             │   │
│   │   │  PDFStrategy          │   │  ImageStrategy        │             │   │
│   │   │  ─────────────        │   │  ─────────────        │             │   │
│   │   │  • Extract metadata   │   │  • Vision API         │             │   │
│   │   │  • OCR text           │   │  • Generate caption   │             │   │
│   │   │  • Detect doc type    │   │  • Extract text       │             │   │
│   │   └───────────────────────┘   └───────────────────────┘             │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling (Blocking)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Enrichment errors are BLOCKING - the file is skipped                      │
│                                                                             │
│   ┌─────────────┐                                                           │
│   │ File needs  │                                                           │
│   │ enrichment  │                                                           │
│   └──────┬──────┘                                                           │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────┐     ┌─────────────────────────────────────┐               │
│   │  Enrich     │────▶│ Success                             │               │
│   │  attempt    │     │ • Continue to classification        │               │
│   └──────┬──────┘     │ • File has enriched frontmatter     │               │
│          │            └─────────────────────────────────────┘               │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Failure (e.g., Firecrawl rate limit, LLM timeout)                   │   │
│   │                                                                     │   │
│   │  • Log warning with error details                                   │   │
│   │  • Report error via progress callback                               │   │
│   │  • SKIP this file (return null)                                     │   │
│   │  • User can retry later with: para enrich-bookmark <file>           │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Error types:                                                              │
│   • FIRECRAWL_RATE_LIMITED - retryable, wait 60s                           │
│   • FIRECRAWL_TIMEOUT - retryable                                          │
│   • FIRECRAWL_BLOCKED - site blocks scraping, not retryable                │
│   • LLM_FAILED - LLM call failed                                           │
│   • API_KEY_MISSING - FIRECRAWL_API_KEY not set                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/inbox/enrich/
├── index.ts                    # Barrel exports
├── types.ts                    # All type definitions
│   ├── BookmarkEnrichment      # Result data
│   ├── EnrichmentStrategy      # Strategy interface
│   ├── EnrichmentContext       # Context passed to strategies
│   ├── EnrichmentPipeline*     # Pipeline types
│   └── BookmarkEnrichmentError # Error class
│
├── pipeline.ts                 # Pipeline orchestrator
│   ├── createEnrichmentPipeline()
│   ├── createDefaultEnrichmentPipeline()
│   └── DEFAULT_ENRICHMENT_STRATEGIES
│
├── bookmark-enricher.ts        # Core Firecrawl + LLM logic
│   ├── enrichBookmarkWithFirecrawl()
│   ├── buildImprovementPrompt()
│   └── parseImprovementResponse()
│
└── strategies/
    ├── index.ts                # Strategy exports
    └── bookmark-strategy.ts    # BookmarkEnrichmentStrategy
        ├── canEnrich()
        ├── enrich()
        └── applyBookmarkEnrichment()
```

## Usage

### In Engine (automatic)
```typescript
// engine.ts - happens automatically during scan
const enrichmentPipeline = createDefaultEnrichmentPipeline(vaultPath);

if (await enrichmentPipeline.needsEnrichment(file)) {
  const result = await enrichmentPipeline.processFile(file);
  if (result.error) {
    // Skip file, user can retry later
    return null;
  }
  // Continue with enriched frontmatter
  enrichedFrontmatter = result.frontmatter;
}
```

### Manual CLI
```bash
# Enrich single file
para enrich-bookmark "00 Inbox/my-bookmark.md"

# Enrich all bookmarks in inbox
para enrich-bookmark "00 Inbox/**/*.md"

# Enrich by URL (outputs to stdout)
para enrich-bookmark --url https://example.com
```

### Adding New Strategy
```typescript
// strategies/pdf-strategy.ts
export const pdfEnrichmentStrategy: EnrichmentStrategy = {
  id: "pdf",
  name: "PDF Metadata Extractor",
  priority: 90,

  canEnrich(ctx) {
    return {
      eligible: ctx.file.extension === ".pdf",
    };
  },

  async enrich(ctx, options) {
    const metadata = await extractPdfMetadata(ctx.file.path);
    return {
      type: "pdf",
      data: metadata,
    };
  },
};

// Register in pipeline.ts
export const DEFAULT_ENRICHMENT_STRATEGIES = [
  bookmarkEnrichmentStrategy,
  pdfEnrichmentStrategy,  // Add here
];
```
