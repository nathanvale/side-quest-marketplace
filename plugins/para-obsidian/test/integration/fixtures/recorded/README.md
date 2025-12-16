# Recorded Real LLM Responses

This directory contains real responses captured from Ollama API calls.

## Purpose

- Provide realistic fixture data for integration tests
- Document actual LLM behavior and response times
- Enable fixture drift detection

## Recording New Fixtures

```bash
# Start Ollama
ollama serve

# Run the recorder script
bun run test/integration/scripts/record-fixtures.ts
```

## File Format

Each recorded fixture is stored as JSON with metadata:

```json
{
  "recordedAt": "2024-12-17T12:00:00Z",
  "model": "qwen2.5:14b",
  "input": {
    "filename": "example.md",
    "content": "..."
  },
  "response": {
    "documentType": "bookmark",
    "confidence": 0.85,
    "reasoning": "...",
    "extractedFields": {...}
  },
  "metadata": {
    "responseTimeMs": 1234,
    "tokensUsed": 456
  }
}
```

## Current Recordings

- None yet (run `bun run test/integration/scripts/record-fixtures.ts`)
