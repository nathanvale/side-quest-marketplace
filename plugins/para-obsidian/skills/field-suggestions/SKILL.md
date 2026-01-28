---
name: field-suggestions
description: Generate AI-assisted frontmatter field suggestions using para-obsidian LLM utilities. Demonstrates 3-layer architecture (constraints, prompt-builder, orchestration) for metadata extraction.
user-invocable: false
allowed-tools: []
---

# Field Suggestions Skill

## Purpose

This skill demonstrates how to use the para-obsidian LLM utilities for AI-assisted field suggestions in custom slash commands. It shows how to leverage the 3-layer architecture (constraints, prompt-builder, orchestration) to build intelligent metadata extraction that respects vault context and frontmatter rules.

---

## Architecture Overview

The para-obsidian plugin provides a **3-layer LLM utility architecture** in `src/llm/`:

### Layer 1: Constraints (`constraints.ts`)
Deterministic extraction with enum/wikilink/vault context awareness:
- `buildConstraintSet()`: Converts template + frontmatter rules into LLM constraints
- Handles enums, wikilinks, validation rules, and vault context
- Ensures AI suggestions respect PARA structure and Dataview compatibility

### Layer 2: Prompt Builder (`prompt-builder.ts`)
Declarative, composable prompts:
- `buildStructuredPrompt()`: Assembles system role, task, content, constraints
- Separates concerns: what to extract vs how to format
- Reusable across different templates and use cases

### Layer 3: Orchestration (`orchestration.ts`)
High-level workflows:
- `suggestFieldValues()`: Single-field suggestions
- `convertNoteToTemplate()`: Full note conversion with validation
- `callOllama()`: LLM integration with error handling
- `parseOllamaResponse()`: Structured response parsing

---

## Usage Example

### Basic Field Suggestion (Single Field)

```typescript
import {
  buildConstraintSet,
  buildStructuredPrompt,
  callOllama,
  parseOllamaResponse,
  type VaultContext
} from './llm';
import { getTemplate } from './templates';
import { loadConfig } from './config';

async function suggestProjectMetadata(
  userTitle: string,
  userDescription: string
): Promise<{ args: Record<string, unknown>; title: string }> {
  // 1. Load config and template
  const config = await loadConfig();
  const template = getTemplate(config, 'project');

  // 2. Build vault context (for wikilink validation)
  const vaultContext: VaultContext = {
    areas: ['Health', 'Career', 'Family'], // from Dataview or cache
    resources: ['TypeScript', 'React'],
    projects: ['Website Redesign'],
    tags: ['#development', '#planning']
  };

  // 3. Build constraints from template + vault context
  const constraints = buildConstraintSet(
    template,
    config.frontmatterRules,
    vaultContext
  );

  // 4. Build structured prompt
  const prompt = buildStructuredPrompt({
    systemRole: 'Extract project metadata from user input following PARA method',
    task: 'Suggest frontmatter field values based on title and description. Return ONLY valid JSON.',
    sourceContent: `Title: ${userTitle}\nDescription: ${userDescription}`,
    constraints
  });

  // 5. Call Ollama and parse response
  const response = await callOllama(prompt, 'qwen2.5:7b');
  const { args, title } = parseOllamaResponse(response);

  return { args, title };
}

// In a slash command handler:
const suggestions = await suggestProjectMetadata(
  'Build AI Assistant',
  'Create a voice-controlled AI assistant using Whisper and Claude'
);

console.log('Suggested frontmatter:', suggestions.args);
// {
//   area: '[[Career]]',  // Wikilink format (Dataview compatible)
//   status: 'active',    // Enum value
//   tags: ['#development', '#ai']
// }

// Present to user for confirmation before creating note
const confirmed = await promptUserConfirmation(suggestions);
if (confirmed) {
  await createNote(suggestions.title, suggestions.args);
}
```

### Full Note Conversion (Multiple Fields)

```typescript
import { convertNoteToTemplate } from './llm';
import { loadConfig } from './config';

async function convertExistingNote(
  noteContent: string,
  targetTemplate: 'project' | 'area' | 'resource' | 'task'
): Promise<{ title: string; args: Record<string, unknown> }> {
  const config = await loadConfig();

  // Vault context for wikilink validation
  const vaultContext = {
    areas: await getExistingAreas(),
    resources: await getExistingResources(),
    projects: await getExistingProjects(),
    tags: await getExistingTags()
  };

  // One-line conversion with full validation
  const result = await convertNoteToTemplate(
    noteContent,
    targetTemplate,
    config,
    vaultContext,
    'qwen2.5:7b'
  );

  return result;
}

// Example: Convert plain note to PARA project
const noteContent = `
# AI Voice Assistant

Working on a voice-controlled assistant using Whisper for transcription
and Claude for responses. This is part of my career development.

Status: Just started planning
Due: End of Q1
`;

const converted = await convertExistingNote(noteContent, 'project');
console.log(converted);
// {
//   title: 'AI Voice Assistant',
//   args: {
//     area: '[[Career]]',
//     status: 'planning',
//     due_date: '2025-03-31',
//     tags: ['#development', '#ai', '#voice']
//   }
// }
```

### Using suggestFieldValues() Helper

```typescript
import { suggestFieldValues } from './llm';
import { loadConfig } from './config';

// Suggest single field value (e.g., for interactive prompts)
async function suggestArea(projectTitle: string, projectDescription: string): Promise<string> {
  const config = await loadConfig();
  const vaultContext = {
    areas: ['Health', 'Career', 'Family', 'Personal Growth']
  };

  const suggestion = await suggestFieldValues(
    `Title: ${projectTitle}\nDescription: ${projectDescription}`,
    'project',
    config,
    vaultContext,
    'qwen2.5:7b'
  );

  return suggestion.args.area as string; // Returns '[[Career]]' in wikilink format
}

// Use in interactive command
const suggestedArea = await suggestArea(
  'Learn TypeScript',
  'Master TypeScript for career advancement'
);

console.log(`AI suggests area: ${suggestedArea}`);
// AI suggests area: [[Career]]
```

---

## Benefits

### Why This Architecture Beats Monolithic Prompts

**Before (Monolithic):**
```typescript
// Hard to maintain, error-prone, inconsistent
const prompt = `Extract metadata from this note. Use wikilinks for areas.
Available areas: Health, Career, Family.
Return JSON with area, status, tags.
Note: ${content}`;
```

**After (Layered):**
```typescript
// Declarative, testable, reusable
const constraints = buildConstraintSet(template, rules, vaultContext);
const prompt = buildStructuredPrompt({ systemRole, task, content, constraints });
```

**Advantages:**
1. **Separation of Concerns**: Constraints ≠ Prompts ≠ Orchestration
2. **Testability**: Each layer tested independently (see `src/llm/*.test.ts`)
3. **Reusability**: Same constraints across different prompts
4. **Maintainability**: Change validation rules without touching prompts
5. **Vault Awareness**: Automatically respects existing areas/projects/tags
6. **Dataview Compatibility**: Enforces wikilink format for relationship fields

---

## Use Cases

### When to Use `suggestFieldValues()`

**Best for:**
- Single-field suggestions in interactive commands
- Quick metadata extraction without full validation
- Progressive disclosure (suggest one field at a time)
- User-guided workflows with confirmations

**Example:**
```typescript
// Interactive project creation
const area = await suggestFieldValues(userInput, 'project', config, vault);
const confirmed = await prompt(`Use area: ${area.args.area}?`);
if (!confirmed) {
  area.args.area = await manualAreaSelection();
}
```

### When to Use `convertNoteToTemplate()`

**Best for:**
- Batch note conversion
- Full frontmatter extraction with validation
- Automated workflows
- Migration scripts

**Example:**
```typescript
// Batch convert all notes in a folder
for (const note of plainNotes) {
  const converted = await convertNoteToTemplate(note.content, 'project', config, vault);
  await updateNoteFrontmatter(note.path, converted.args);
}
```

---

## Advanced Patterns

### Custom Validation Post-Processing

```typescript
import { parseOllamaResponse, callOllama } from './llm';

const response = await callOllama(prompt, model);
const { args, title } = parseOllamaResponse(response);

// Add custom validation
if (args.area && !vaultContext.areas.includes(args.area)) {
  console.warn(`AI suggested non-existent area: ${args.area}`);
  args.area = await promptUserForArea(); // Fallback to manual selection
}

// Add computed fields
args.created_date = new Date().toISOString().split('T')[0];
args.file_path = generateFilePath(title, args.area);
```

### Retry with Refinement

```typescript
import { callOllama, parseOllamaResponse } from './llm';

let attempts = 0;
let result;

while (attempts < 3) {
  try {
    const response = await callOllama(prompt, model);
    result = parseOllamaResponse(response);

    // Validate critical fields
    if (!result.args.area || !result.title) {
      throw new Error('Missing required fields');
    }

    break; // Success
  } catch (error) {
    attempts++;
    console.warn(`Attempt ${attempts} failed:`, error);

    // Refine prompt for retry
    prompt += '\nIMPORTANT: You must include both "title" and "area" fields.';
  }
}

if (!result) {
  throw new Error('Failed to extract metadata after 3 attempts');
}
```

---

## Integration with Slash Commands

### Example: `/para-brain:ai-convert` Command

```typescript
// commands/ai-convert.md
import { convertNoteToTemplate } from '../src/llm';
import { loadConfig } from '../src/config';
import { getVaultContext } from '../src/vault';

export async function aiConvertCommand(
  notePath: string,
  targetTemplate: 'project' | 'area' | 'resource' | 'task'
) {
  const config = await loadConfig();
  const vaultContext = await getVaultContext(config.vault_path);
  const noteContent = await fs.readFile(notePath, 'utf-8');

  const result = await convertNoteToTemplate(
    noteContent,
    targetTemplate,
    config,
    vaultContext,
    'qwen2.5:7b'
  );

  console.log('\nAI Suggestions:');
  console.log(`Title: ${result.title}`);
  console.log(`Frontmatter:`, JSON.stringify(result.args, null, 2));

  const confirmed = await promptConfirmation('Apply these changes?');
  if (confirmed) {
    await updateNoteFrontmatter(notePath, result.args);
    console.log('✓ Note converted successfully');
  }
}
```

---

## Testing Your AI Integrations

```typescript
import { describe, test, expect } from 'bun:test';
import { buildConstraintSet, buildStructuredPrompt } from './llm';

describe('AI Field Suggestions', () => {
  test('builds constraints with vault context', () => {
    const template = getTemplate(config, 'project');
    const vaultContext = { areas: ['Career'], resources: [], projects: [], tags: [] };

    const constraints = buildConstraintSet(template, config.frontmatterRules, vaultContext);

    expect(constraints).toContain('area must be a wikilink from: [[Career]]');
    expect(constraints).toContain('status must be one of: active, planning, on-hold, completed, archived');
  });

  test('assembles structured prompt correctly', () => {
    const prompt = buildStructuredPrompt({
      systemRole: 'Extract metadata',
      task: 'Suggest frontmatter',
      sourceContent: 'Title: Test Project',
      constraints: ['area must be wikilink']
    });

    expect(prompt).toContain('Extract metadata');
    expect(prompt).toContain('Title: Test Project');
    expect(prompt).toContain('area must be wikilink');
  });
});
```

---

## Tips for Best Results

1. **Always provide vault context** - Helps AI suggest existing areas/projects instead of creating new ones
2. **Use specific system roles** - "Extract project metadata following PARA method" > "Extract metadata"
3. **Test with different models** - `qwen2.5:7b` is fast, `qwen2.5:32b` is more accurate
4. **Validate AI output** - Always check for required fields before creating notes
5. **Provide examples in prompts** - Include 1-2 examples of desired output format
6. **Handle errors gracefully** - LLM calls can fail; always have fallback to manual input

---

## Reference

**Source Files:**
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/llm/constraints.ts`
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/llm/prompt-builder.ts`
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/llm/orchestration.ts`

**Tests:**
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/llm/constraints.test.ts`
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/llm/prompt-builder.test.ts`
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/llm/orchestration.test.ts`

**Config:**
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/defaults.ts` - Default frontmatter rules
- `/Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian/src/config.ts` - Config loading

---

## Next Steps

1. **Try the examples** - Run code snippets in a test file
2. **Build a custom command** - Create a slash command using `suggestFieldValues()`
3. **Experiment with prompts** - Refine system roles and constraints for your use case
4. **Add vault caching** - Cache vault context to avoid repeated Dataview queries
5. **Contribute patterns** - Share successful AI integration patterns with the community
