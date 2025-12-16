# Troubleshooting Guide

Common issues and solutions for the para-obsidian plugin.

---

## Quick Reference

| Issue Type | Jump To |
|------------|---------|
| Classifier Creation | [Classifier Issues](#classifier-creation-issues) |
| Template Creation | [Template Issues](#template-creation-issues) |
| Inbox Processing | [Inbox Issues](#inbox-processing-issues) |
| Atomic Operations | [Atomic Issues](#atomic-operation-failures) |
| File Locking | [Lock Issues](#file-locking-issues) |
| LLM/Ollama | [LLM Issues](#llm-issues) |
| Git Integration | [Git Issues](#git-integration-issues) |

---

## Classifier Creation Issues

### 1. "Classifier ID already exists"

**Symptom:**
```
Error: Classifier ID 'invoice' already exists. Choose a different ID.
```

**Cause:**
- Another classifier with the same `id` is already registered
- Registry at `~/.config/para-obsidian/classifier-registry.json` contains duplicate

**Solution:**
```bash
# Check existing classifier IDs
bun run src/cli.ts list-classifiers

# View registry directly
cat ~/.config/para-obsidian/classifier-registry.json | jq '.classifiers[].id'

# Choose a unique ID (e.g., 'invoice-medical' instead of 'invoice')
```

**Prevention:**
- Run `list-classifiers` before creating new classifiers
- Use descriptive, specific IDs (e.g., `medical-invoice` vs `invoice`)

---

### 2. "Priority conflict"

**Symptom:**
```
Warning: Multiple classifiers with priority 100
```

**Cause:**
- Classifiers with identical priorities may compete for matching
- Priority determines classification order (higher = checked first)

**Solution:**
```typescript
// Adjust priorities in classifier definition
export const myClassifier: InboxConverter = {
  // ...
  priority: 85,  // Lower than competing classifier
};
```

**Priority Guidelines:**
- **100:** Highly specific types (tax invoices, medical statements)
- **90:** Specific types (travel bookings, receipts)
- **80:** Broad types (research papers, articles)
- **70:** Generic types (notes, documents)
- Leave gaps (5-10) between priorities for future additions

**Prevention:**
- Check existing priorities: `bun run src/cli.ts list-classifiers`
- Use the priority range strategically

---

### 3. "Template name collision"

**Symptom:**
```
Error: Template 'invoice.md' already exists
```

**Cause:**
- Template creation automatically appends classifier ID to avoid collisions
- Multiple classifiers trying to use the same base template name

**How Suffix System Works:**
```
Base template: "invoice.md"
Classifier ID: "medical-invoice"
Generated: "invoice-medical-invoice.md"  ← Automatic suffix
```

**Solution:**
1. **Accept the suffix** (recommended):
   ```typescript
   template: {
     name: "invoice",  // Will become "invoice-my-classifier.md"
     folder: "Templates"
   }
   ```

2. **Use a different base name**:
   ```typescript
   template: {
     name: "medical-statement",  // Unique base name
     folder: "Templates"
   }
   ```

**Prevention:**
- Understand that suffix = classifier ID by design
- Use descriptive base names that match your classifier

---

### 4. "Registry corruption detected"

**Symptom:**
```
Error: Registry file is corrupted
Fatal: Could not load classifier registry
```

**Cause:**
- Interrupted write during registry save
- Manual JSON editing with syntax errors
- Concurrent access without file locking

**Recovery Steps:**

1. **Check for backup:**
   ```bash
   ls -la ~/.config/para-obsidian/classifier-registry.json*
   # Look for .backup file
   ```

2. **Restore from backup:**
   ```bash
   cp ~/.config/para-obsidian/classifier-registry.json.backup \
      ~/.config/para-obsidian/classifier-registry.json
   ```

3. **If no backup, reset registry:**
   ```bash
   # Backup corrupted file first
   mv ~/.config/para-obsidian/classifier-registry.json \
      ~/.config/para-obsidian/classifier-registry.json.CORRUPTED

   # Registry will auto-regenerate from classifier definitions
   bun run src/cli.ts list-classifiers
   ```

4. **Validate JSON manually:**
   ```bash
   # Check JSON syntax
   cat ~/.config/para-obsidian/classifier-registry.json | jq .

   # If jq shows errors, fix manually or reset
   ```

**Prevention:**
- Never manually edit registry while plugin is running
- Let atomic writes complete (don't force-quit processes)
- Use `/para-obsidian:create-classifier` instead of manual edits

---

### 5. "TypeScript compilation failed"

**Symptom:**
```
Error: Cannot compile classifier definition
src/inbox/classify/classifiers/definitions/my-type.ts:15:3
  Type 'string' is not assignable to type 'number'
```

**Common Causes:**

**A. Invalid field type:**
```typescript
// ❌ Wrong
fields: [
  { name: "amount", type: "currency", ... }  // Not a valid type
]

// ✅ Correct
fields: [
  { name: "amount", type: "number", ... }
]
```

**B. Missing required properties:**
```typescript
// ❌ Wrong
fields: [
  { name: "title" }  // Missing type, description, requirement
]

// ✅ Correct
fields: [
  {
    name: "title",
    type: "string",
    description: "Document title",
    requirement: "required"
  }
]
```

**C. Invalid pattern weights:**
```typescript
// ❌ Wrong
heuristics: {
  filenamePatterns: [
    { pattern: "invoice", weight: 2.0 }  // > 1.0
  ]
}

// ✅ Correct
heuristics: {
  filenamePatterns: [
    { pattern: "invoice", weight: 0.9 }  // 0.0-1.0
  ]
}
```

**Solution:**
```bash
# Run TypeScript check
bun typecheck

# Check specific file
bun run tsc --noEmit src/inbox/classify/classifiers/definitions/my-type.ts
```

**Prevention:**
- Use the template at `src/inbox/classify/classifiers/definitions/_template.ts`
- Run typecheck before committing
- Use `/create-classifier` command for validation

---

### 6. "Lock timeout"

**Symptom:**
```
Error: Failed to acquire lock for classifier-registry
Timeout after 30000ms
```

**Causes:**
- Another process is modifying the registry
- Stale lock from crashed process
- Concurrent classifier creation attempts

**Solution:**

1. **Check for stale locks:**
   ```bash
   # View lock directory
   ls -la /tmp/para-obsidian-locks/

   # Check lock file
   cat /tmp/para-obsidian-locks/classifier-registry.lock
   # Shows PID of locking process
   ```

2. **Verify process is running:**
   ```bash
   # Check if PID from lock file exists
   ps -p <PID>
   ```

3. **Remove stale lock:**
   ```bash
   # If process is dead, remove lock
   rm /tmp/para-obsidian-locks/classifier-registry.lock
   ```

4. **Wait for other process:**
   ```
   # If process is alive, wait for it to finish
   # Locks auto-release after operation completes
   ```

**Prevention:**
- Don't run multiple classifier creations simultaneously
- Let operations complete (don't Ctrl+C mid-operation)
- Stale locks auto-cleanup on next operation

---

## Template Creation Issues

### 1. "Invalid Templater syntax"

**Symptom:**
```
Error: Unclosed Templater tags (<% without matching %>)
```

**Common Syntax Errors:**

**A. Unclosed tags:**
```markdown
❌ title: <% tp.system.prompt("Title")
✅ title: <% tp.system.prompt("Title") %>
```

**B. Unbalanced parentheses:**
```markdown
❌ date: <% tp.date.now("YYYY-MM-DD" %>
✅ date: <% tp.date.now("YYYY-MM-DD") %>
```

**C. Invalid function names:**
```markdown
❌ created: <% tp.datetime.now() %>
✅ created: <% tp.date.now() %>
```

**Solution:**
```bash
# Validate template
bun run src/cli.ts validate-template Templates/my-template.md

# Check for common issues
grep -n '<% ' Templates/my-template.md  # Find all Templater tags
```

**Valid Templater Functions:**
- `tp.system.prompt("Label")` - User prompt
- `tp.date.now("YYYY-MM-DD")` - Current date
- `tp.file.title` - File title
- `tp.file.folder()` - Parent folder

**Prevention:**
- Use `/create-note-template` command for validated scaffolding
- Copy from existing templates
- Validate before committing

---

### 2. "Template validation failed"

**Symptom:**
```
Error: Template must have YAML frontmatter (--- ... ---)
```

**Cause:**
- Missing frontmatter delimiters
- Frontmatter not at start of file

**Solution:**
```markdown
❌ Wrong (no frontmatter):
# My Note
Content here

❌ Wrong (not at start):
Some text
---
title: Note
---

✅ Correct:
---
title: <% tp.system.prompt("Title") %>
created: <% tp.date.now("YYYY-MM-DD") %>
---

# Content
```

**Required Structure:**
1. Frontmatter starts at line 1 with `---`
2. YAML fields (one per line)
3. Frontmatter ends with `---`
4. Content follows

**Prevention:**
- Start all templates with frontmatter block
- Use template scaffolding: `/create-note-template`

---

### 3. "Wikilinks not working"

**Symptom:**
```
Template renders literal [[link]] instead of clickable wikilink
```

**Cause:**
- Wikilinks inside Templater quotes get escaped
- Missing quotes around wikilink fields

**Solution:**

**A. In frontmatter (use quotes):**
```yaml
❌ Wrong:
project: [[Projects/My Project]]

✅ Correct:
project: "[[Projects/My Project]]"
```

**B. In content (no quotes needed):**
```markdown
✅ Correct:
See [[Related Note]] for details
```

**C. Dynamic wikilinks:**
```markdown
✅ Use tp.system.prompt WITHOUT quotes:
---
project: <% tp.system.prompt("Project") %>
---

Then user enters: [[Projects/My Project]]
```

**Prevention:**
- Quote wikilinks in YAML frontmatter
- Don't quote in markdown content
- Test template rendering in Obsidian

---

### 4. "Frontmatter YAML errors"

**Symptom:**
```
Error: Unbalanced quotes on line 3: title: "My Title
YAML parse failed
```

**Common YAML Mistakes:**

**A. Unbalanced quotes:**
```yaml
❌ Wrong:
title: "My Title
description: "A note

✅ Correct:
title: "My Title"
description: "A note"
```

**B. Special characters without quotes:**
```yaml
❌ Wrong:
title: My Title: A Subtitle

✅ Correct:
title: "My Title: A Subtitle"
```

**C. List syntax errors:**
```yaml
❌ Wrong:
tags: [tag1 tag2 tag3]

✅ Correct:
tags: [tag1, tag2, tag3]
```

**D. Multiline strings:**
```yaml
❌ Wrong:
description: This is a
long description

✅ Correct:
description: |
  This is a
  long description
```

**Solution:**
```bash
# Validate YAML syntax
bun run src/cli.ts frontmatter validate path/to/note.md

# Test parsing
cat Templates/my-template.md | head -20 | grep -A 20 '^---'
```

**Prevention:**
- Use quotes for values with: `:`, `#`, `[`, `]`, `{`, `}`
- Validate templates before deploying
- Test in Obsidian to catch rendering issues

---

## Inbox Processing Issues

### 1. "Classifier not detecting files"

**Symptom:**
```
Scanned 10 files, 0 suggestions
Files are being skipped despite matching patterns
```

**Causes & Solutions:**

**A. Heuristic threshold too high:**
```typescript
// Classifier definition
heuristics: {
  filenamePatterns: [
    { pattern: "invoice", weight: 0.3 }  // Low match score
  ],
  threshold: 0.8  // ❌ Too high - needs 80% match
}

// Solution: Lower threshold or increase weights
heuristics: {
  filenamePatterns: [
    { pattern: "invoice", weight: 1.0 }
  ],
  threshold: 0.5  // ✅ More lenient
}
```

**B. Pattern doesn't match:**
```bash
# Debug heuristic matching
bun run src/debug-llm.ts

# Check what patterns would match
grep -i "invoice" ~/Vault/00\ Inbox/*
```

**C. File already processed:**
```bash
# Check processed registry
cat ~/.config/para-obsidian/processed-registry.json | jq .

# Clear registry to reprocess
rm ~/.config/para-obsidian/processed-registry.json
```

**D. Classifier disabled:**
```typescript
export const myClassifier: InboxConverter = {
  enabled: false,  // ❌ Disabled
  // ...
}

// Solution: Enable it
enabled: true,  // ✅
```

**Debugging Steps:**
```bash
# 1. Verify classifier is loaded
bun run src/cli.ts list-classifiers

# 2. Test heuristic matching
bun run src/debug-llm.ts

# 3. Check file content
cat "00 Inbox/my-file.pdf" | head -100

# 4. Verify patterns
echo "filename: my-invoice-2024.pdf" | grep -E "invoice"
```

**Prevention:**
- Start with low thresholds (0.3-0.5) and tune upward
- Add multiple patterns (filename + content)
- Test with real files before deploying

---

### 2. "LLM extraction failing"

**Symptom:**
```
Error: LLM provider not available
All suggestions have low confidence
```

**Causes & Solutions:**

**A. Ollama not running:**
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# If not running:
ollama serve
```

**B. Model not available:**
```bash
# Check available models
ollama list

# Pull required model (default: llama3.1)
ollama pull llama3.1
```

**C. Connection timeout:**
```bash
# Test Ollama connectivity
curl http://localhost:11434/api/generate \
  -d '{"model": "llama3.1", "prompt": "test"}'

# Check Ollama logs
journalctl -u ollama -f  # Linux
tail -f /var/log/ollama.log  # macOS
```

**D. Model override not found:**
```bash
# If using custom model
export PARA_OBSIDIAN_LLM_MODEL=mistral

# Verify model exists
ollama list | grep mistral
```

**Solution:**
```bash
# 1. Start Ollama
ollama serve &

# 2. Pull default model
ollama pull llama3.1

# 3. Test manually
bun run src/debug-llm.ts

# 4. Check logs
tail -f ~/.config/para-obsidian/logs/llm.log
```

**Fallback to Heuristics:**
- If LLM fails, plugin uses heuristic-only extraction
- Suggestions marked with ⚠️ warning icon
- Check `llmFallback` field in suggestion metadata

**Prevention:**
- Ensure Ollama runs on system startup
- Monitor Ollama health: `curl localhost:11434`
- Set reasonable timeout: 30s default

---

### 3. "Template execution failed"

**Symptom:**
```
Error: Failed to execute note creation
Template rendering produced invalid frontmatter
```

**Cause:**
- Templater plugin not installed in Obsidian
- Template has syntax errors (see [Template Issues](#template-creation-issues))
- File permissions on Templates folder

**Solution:**

1. **Verify Templater plugin:**
   - Open Obsidian → Settings → Community Plugins
   - Enable "Templater"
   - Configure template folder: `Templates`

2. **Check template syntax:**
   ```bash
   bun run src/cli.ts validate-template Templates/invoice.md
   ```

3. **Verify file permissions:**
   ```bash
   ls -la ~/Vault/Templates/
   # Should show rwx permissions
   ```

4. **Test template manually:**
   - Create new note in Obsidian
   - Insert template via Templater
   - Check for errors

**Prevention:**
- Validate templates before using in classifiers
- Test template rendering in Obsidian first
- Keep Templater plugin updated

---

### 4. "Git guard preventing scan"

**Symptom:**
```
Error: Uncommitted changes in vault
Scan aborted - commit changes first
```

**Cause:**
- Git integration enabled (default)
- Vault has uncommitted changes
- Prevents accidental LLM calls on WIP files

**Solution:**

**A. Commit changes:**
```bash
cd ~/Vault
git add .
git commit -m "feat: add new notes"
```

**B. Temporarily disable git guard:**
```bash
# Set environment variable
export PARA_OBSIDIAN_GIT_GUARD=false

# Run scan
bun run src/cli.ts process-inbox scan
```

**C. Exclude attachments from check:**
```bash
# Attachments folder auto-excluded
# But verify in config:
cat ~/.config/para-obsidian/config.json | jq .attachmentsFolder
```

**Prevention:**
- Commit regularly before processing inbox
- Use auto-commit feature: `autoCommit: true` in config
- Add large files to `.gitignore` if needed

---

## Atomic Operation Failures

### 1. "Rollback failed"

**Symptom:**
```
Error: Failed to execute suggestion 'suggestion-abc123'
Warning: Rollback incomplete - manual cleanup required

Artifacts left behind:
  - /tmp/staging/note-xyz.md
  - /vault/Attachments/file-partial.pdf
```

**What This Means:**
- Transaction started but couldn't complete
- Automatic rollback attempted but failed
- Some files may be in inconsistent state

**Recovery Steps:**

1. **Check staging directory:**
   ```bash
   ls -la /tmp/para-obsidian-staging/
   # Shows partial writes
   ```

2. **Verify vault state:**
   ```bash
   cd ~/Vault
   git status
   # Check for partial changes
   ```

3. **Manual cleanup:**
   ```bash
   # Remove staging files
   rm -rf /tmp/para-obsidian-staging/*

   # Restore from git (if tracked)
   git restore Attachments/
   ```

4. **Check registry:**
   ```bash
   # Verify suggestion wasn't marked as processed
   cat ~/.config/para-obsidian/processed-registry.json | \
     jq '.items[] | select(.suggestionId == "suggestion-abc123")'
   ```

**Causes:**
- Disk full during operation
- Permissions error mid-transaction
- Process killed during execution

**Prevention:**
- Ensure sufficient disk space
- Check permissions: `ls -la ~/Vault/`
- Let operations complete (don't force-quit)

---

### 2. "Backup restoration"

**Symptom:**
```
Warning: Restored registry from backup
Previous state was corrupted
```

**When This Happens:**
- Registry read detected corruption
- Automatic restoration from `.backup` file
- Operation succeeded but using older data

**What to Check:**

1. **Verify restoration worked:**
   ```bash
   cat ~/.config/para-obsidian/classifier-registry.json | jq .
   # Should parse successfully
   ```

2. **Check data loss:**
   ```bash
   # Compare backup timestamp
   ls -la ~/.config/para-obsidian/classifier-registry.json*

   # See what classifiers are present
   bun run src/cli.ts list-classifiers
   ```

3. **Re-create missing data:**
   - If recent classifier is missing, re-run `/create-classifier`
   - Backup is typically < 1 hour old

**Not Critical:**
- This is normal recovery behavior
- Backup is created before each write
- Data loss is minimal (last 1-2 operations max)

**Prevention:**
- Don't manually edit registry files
- Let atomic writes complete
- Regular backups: `cp registry.json registry.json.manual-backup`

---

## File Locking Issues

### 1. "Lock acquisition failed"

**Symptom:**
```
Error: Failed to acquire lock for classifier-registry
Another process is modifying the resource
```

**Cause:**
- Two processes trying to modify registry simultaneously
- Normal when running multiple operations at once

**Solution:**
```bash
# Wait for other operation to complete (locks auto-release)
# Or check what's holding the lock:

cat /tmp/para-obsidian-locks/classifier-registry.lock
# Shows: PID of locking process

ps -p <PID>
# Check if process is still running
```

**Prevention:**
- Run one classifier creation at a time
- Wait for operations to complete
- Locks timeout after 30s automatically

---

### 2. "Stale lock detected"

**Symptom:**
```
Warning: Removed stale lock (process 12345 not running)
```

**What This Means:**
- Previous process crashed without releasing lock
- Automatic cleanup detected and removed it
- Operation continued normally

**Not an Error:**
- This is expected recovery behavior
- No action needed
- Lock cleanup is automatic

**When to Investigate:**
```bash
# If you see this frequently, check for crashes:
dmesg | grep -i para-obsidian  # Linux
Console.app                     # macOS

# Check system logs for OOM kills or crashes
```

---

## LLM Issues

### 1. "Ollama connection refused"

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

**Solution:**
```bash
# Start Ollama
ollama serve

# Or as background service
ollama serve &
```

---

### 2. "Model not found"

**Symptom:**
```
Error: model 'llama3.1' not found
```

**Solution:**
```bash
# Pull default model
ollama pull llama3.1

# Or custom model
ollama pull mistral
```

---

### 3. "LLM response parse failed"

**Symptom:**
```
Error: LLM response could not be parsed
Expected JSON, got: "Here is my response..."
```

**Cause:**
- LLM didn't follow structured output format
- Model doesn't support JSON mode
- Prompt too complex

**Solution:**
```bash
# Try different model
export PARA_OBSIDIAN_LLM_MODEL=llama3.1

# Or use fallback (heuristics only)
export PARA_OBSIDIAN_DISABLE_LLM=true
```

---

## Git Integration Issues

### 1. "Git command failed"

**Symptom:**
```
Error: git command failed: fatal: not a git repository
```

**Solution:**
```bash
# Initialize git in vault
cd ~/Vault
git init
git add .
git commit -m "Initial commit"
```

---

### 2. "Auto-commit disabled"

**Symptom:**
```
Changes not being committed automatically
```

**Check Config:**
```bash
cat ~/.config/para-obsidian/config.json | jq .autoCommit
# Should be: true

# Or set via environment
export PARA_OBSIDIAN_AUTO_COMMIT=true
```

---

## Diagnostic Commands

### General Health Check
```bash
# 1. Verify vault path
echo $PARA_VAULT

# 2. Check config
bun run src/cli.ts config info

# 3. List classifiers
bun run src/cli.ts list-classifiers

# 4. Test LLM
curl http://localhost:11434/api/tags

# 5. Check permissions
ls -la $PARA_VAULT/00\ Inbox/
```

### Cleanup Commands
```bash
# Clear processed registry (reprocess all files)
rm ~/.config/para-obsidian/processed-registry.json

# Clear stale locks
rm -rf /tmp/para-obsidian-locks/*.lock

# Clear staging directory
rm -rf /tmp/para-obsidian-staging/*

# Reset classifier registry (regenerates from definitions)
rm ~/.config/para-obsidian/classifier-registry.json
```

### Debug LLM Classification
```bash
# Interactive debug tool
bun run src/debug-llm.ts

# Shows:
# - Content extraction
# - Heuristic matching scores
# - LLM prompt and response
# - Final suggestion
```

---

## Log Locations

```bash
# Plugin logs
~/.config/para-obsidian/logs/

# LLM interaction logs
~/.config/para-obsidian/logs/llm.log

# Registry files
~/.config/para-obsidian/classifier-registry.json
~/.config/para-obsidian/processed-registry.json

# Lock files
/tmp/para-obsidian-locks/

# Staging directory
/tmp/para-obsidian-staging/
```

---

## Getting Help

If issues persist after trying these solutions:

1. **Check existing issues:**
   - Search GitHub issues for similar problems

2. **Collect debug info:**
   ```bash
   # System info
   bun --version
   echo $PARA_VAULT
   cat ~/.config/para-obsidian/config.json

   # Plugin info
   bun run src/cli.ts config info
   bun run src/cli.ts list-classifiers

   # Recent logs
   tail -50 ~/.config/para-obsidian/logs/llm.log
   ```

3. **Create minimal reproduction:**
   - Isolate the specific operation that fails
   - Note exact error messages
   - Include steps to reproduce

4. **Report issue:**
   - Include debug info above
   - Describe expected vs actual behavior
   - Attach relevant log snippets

---

## Quick Fixes Summary

| Problem | Quick Fix |
|---------|-----------|
| Classifier not loading | `bun run src/cli.ts list-classifiers` |
| Template validation error | `bun run src/cli.ts validate-template <path>` |
| LLM not responding | `ollama serve && ollama pull llama3.1` |
| Lock timeout | `rm /tmp/para-obsidian-locks/*.lock` |
| Registry corrupted | `cp registry.json.backup registry.json` |
| Git guard blocking | `cd $PARA_VAULT && git commit -am "wip"` |
| Staging artifacts | `rm -rf /tmp/para-obsidian-staging/*` |
| Stale processed items | `rm ~/.config/para-obsidian/processed-registry.json` |
