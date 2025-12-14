# Classify Module

**Purpose:** Determining what files are and extracting structured information

## What Goes Here

- **Document classification** - Determining document type (receipt, invoice, article, etc.)
- **Field extraction** - Extracting structured data (title, date, amount, etc.)
- **LLM processing** - Using AI to understand document content
- **Heuristic matching** - Pattern-based classification

## Current Structure

```
classify/
├── index.ts              # Barrel exports
├── llm-classifier.ts     # LLM-based document classification
├── llm-classifier.test.ts
├── detection/            # Content processors
│   ├── pdf-processor.ts  # PDF extraction + heuristics
│   └── pdf-processor.test.ts
└── converters/           # Type-specific conversion logic
    ├── index.ts          # Barrel exports
    ├── defaults.ts       # Built-in document type configs
    ├── loader.ts         # Converter matching logic
    ├── suggestion-builder.ts  # Build suggestions from classification
    ├── types.ts          # Converter interfaces
    └── *.test.ts         # Tests
```

## Key Exports

- `buildInboxPrompt()` - Build LLM prompt with vault context
- `parseDetectionResponse()` - Parse LLM classification response
- `extractPdfText()` - Extract text from PDF files
- `combineHeuristics()` - Apply pattern-based classification
- `buildSuggestion()` - Create suggestion from classification result
- `DEFAULT_CONVERTERS` - Built-in document types

## Mental Model

**"I want to figure out what a file is"** → Use classify module
