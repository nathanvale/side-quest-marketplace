# Brain Maintenance Playbook

Maps vault symptoms to remediation. The brain consults this during the Step 0 health check when issues are detected.

## Symptom → Remediation Table

| Symptom | Severity | Diagnosis | Possible Causes | Proposed Fix | Auto-fixable? |
|---------|----------|-----------|-----------------|-------------|---------------|
| Large inbox (> 30 items) | Low | Inbox has accumulated unprocessed items | Busy period, skipped triage sessions | Run `/para-obsidian:triage` to batch-process inbox | Yes (via skill) |
| `scan_latency` SLO breached (burn rate > 1) | Medium | Inbox scans taking too long | Large files in inbox, slow LLM, many items | Batch triage to reduce inbox size, check if Ollama is responsive | Partial |
| `execute_success` SLO breached | High | Note creation/execution failing | Git conflicts, corrupted templates, missing directories | Run `/para-obsidian:validate` to check frontmatter, verify git status | No |
| `execute_latency` SLO breached | Medium | Execution operations too slow | Large files, complex templates, slow disk | Check for unusually large inbox items, validate templates | No |
| `llm_availability` SLO breached | High | LLM calls failing | Ollama not running, model not loaded, API key expired | Check Ollama status (`ollama list`), verify model availability | No |
| `llm_latency` SLO breached | Medium | LLM responses too slow | Model too large for hardware, Ollama under load | Consider switching to smaller model, check system resources | No |
| `extraction_latency` SLO breached | Low | Content extraction slow | Large PDFs, complex DOCX files | Process large attachments individually, check file sizes | No |
| `enrichment_latency` SLO breached | Low | Enrichment (YouTube, Firecrawl) slow | Network issues, rate limiting, service downtime | Retry later, check network connectivity | No |
| Orphaned clippings (> 7 days in inbox) | Low | Old clippings sitting unprocessed | Clipped but never triaged | Run `/para-obsidian:triage` or review manually | Yes (via skill) |
| Missing area/project references | Medium | Broken wikilinks in frontmatter | Area/project was renamed or deleted | Run `/para-obsidian:validate` to identify broken references | No |

## Usage

The brain reads this playbook during the healing flow (after Step 0 detects an issue and Nathan says "fix it"). Match the detected symptom to a row, present the diagnosis and proposed fix, then ask Nathan for approval via `AskUserQuestion` before executing anything.

**Rules:**
1. Present ONE fix at a time (ADHD-friendly)
2. NEVER auto-execute — always ask first
3. For "No" auto-fixable items: explain what to check and let Nathan decide
4. For "Yes" auto-fixable items: propose the specific skill invocation
5. For "Partial" items: explain what can be automated and what needs manual attention
