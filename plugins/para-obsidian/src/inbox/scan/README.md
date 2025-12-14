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
└── extractors/           # File type handlers
    ├── index.ts          # Barrel exports + createInboxFile
    ├── index.test.ts     # Integration tests
    ├── pdf.ts            # PDF text extraction
    ├── image.ts          # Image vision extraction (placeholder)
    ├── image.test.ts     # Image extractor tests
    ├── markdown.ts       # Frontmatter + content extraction
    ├── markdown.test.ts  # Markdown extractor tests
    ├── registry.ts       # Extractor registry pattern
    ├── registry.test.ts  # Registry tests
    └── types.ts          # Extraction interfaces
```

## Key Exports

- `createInboxFile()` - Create file handle with extracted content
- `getDefaultRegistry()` - Get registry with all built-in extractors
- `InboxFile` - File representation with metadata and content
- `ExtractorRegistry` - Manage extractors by extension

## Mental Model

**"I want to read files from the inbox"** → Use scan module

## Supported File Types

- `.pdf` - PDF text extraction via pdftotext
- `.md` - Markdown frontmatter + body extraction
- `.png`, `.jpg`, `.jpeg` - Image vision extraction (placeholder)
