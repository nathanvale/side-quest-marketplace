# Scan Module

**Purpose:** Reading files from inbox and extracting content

## What Goes Here

- **File reading** - Scanning inbox directory for files
- **Content extraction** - Format-specific extractors (PDF, image, markdown)
- **Text conversion** - Converting binary formats to text for LLM processing

## Current Structure

```
scan/
├── index.ts              # Barrel exports
└── extractors/           # Re-exported from ../extractors/ (pending move)
    ├── pdf.ts           # PDF text extraction
    ├── image.ts         # Image → text via vision models
    ├── markdown.ts      # Frontmatter extraction
    ├── registry.ts      # Extractor registry
    └── types.ts         # Extraction interfaces
```

## Key Exports

- `createInboxFile()` - Create file handle for processing
- `pdfExtractor` - Extract text from PDFs
- `imageExtractor` - Extract text from images
- `markdownExtractor` - Extract frontmatter from markdown
- `ExtractorRegistry` - Manage extractors

## Mental Model

**"I want to read files from the inbox"** → Use scan module

## Future Work

- Move extractors physically into this folder
- Add scanner.ts for directory orchestration
- Split large extractor files if needed
