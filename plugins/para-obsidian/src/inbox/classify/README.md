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
├── llm-classifier.ts     # Re-exported from ../llm-detection.ts (pending move)
├── pdf-classifier.ts     # Re-exported from ../detection/ (pending move)
└── converters/           # Re-exported from ../converters/ (pending move)
    ├── defaults.ts      # Default document type configs
    ├── loader.ts        # Load custom converters
    ├── suggestion-builder.ts  # Build suggestions from classification
    └── types.ts         # Converter interfaces
```

## Key Exports

- `createLLMDetector()` - Create LLM-based classifier
- `processPdfDocument()` - Classify PDF documents
- `loadConverters()` - Load document type configs
- `createConverterSuggestion()` - Build suggestions from classification
- `DEFAULT_CONVERTERS` - Built-in document types

## Mental Model

**"I want to figure out what a file is"** → Use classify module

## Future Work

- Move llm-detection.ts → llm-classifier.ts
- Move detection/ → classify/
- Move converters/ → classify/converters/
- Add heuristics.ts for pattern matching
