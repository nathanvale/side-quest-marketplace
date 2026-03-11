---
name: nlm
description: NotebookLM operations -- sync sources, query notebooks, generate audio/infographic/slides/reports with presets
---

# NotebookLM Skill

Manage NotebookLM notebooks, sync sources, run RAG queries, and generate artifacts with pre-baked presets.

## Router

If `$ARGUMENTS` is empty or doesn't match a subcommand, present this menu and ask the user to pick a number:

```
What would you like to do?

 1. sync         Sync new files to notebook
 2. query        RAG query against sources
 3. audio        Generate audio overview
 4. infographic  Generate infographic
 5. slides       Generate slide deck
 6. report       Generate report
 7. mindmap      Generate mind map
 8. status       Check artifact status
 9. create       Create new notebook
10. add          Add a source to notebook

Pick a number (1-10) or type a subcommand:
```

If `$ARGUMENTS` matches a subcommand name (e.g. `sync`, `audio --expert`), skip the router and execute that subcommand directly.

## Configuration

Read `.nlm.yml` from the repo root. It defines:
- **notebooks**: named notebook entries with `id`, `name`, and `watch` dirs
- **presets**: named presets for `audio` and `infographic` generation with focus prompts

If no `.nlm.yml` exists, ask the user which notebook to target and what to generate.

### Example `.nlm.yml`

```yaml
notebooks:
  meetings:
    id: "a1438fa4-f1f8-4741-bd56-e604de047940"
    name: "My Notebook"
    watch:
      - docs/meetings/
      - docs/research/

presets:
  audio:
    expert:
      format: brief
      length: short
      focus: "This briefing is for two senior engineers. Assume expert-level background. Skip foundational definitions. Focus on methodology gaps and open questions."
    stakeholder:
      format: deep_dive
      length: default
      focus: "Summarize for a program director. Focus on decisions made, blockers, and action items."

  infographic:
    executive-one-pager:
      orientation: landscape
      detail_level: detailed
      style: professional
      focus: "Executive one-pager: slide-ready layout, heavy hierarchy, professional palette."
```

## Subcommands

### `/productivity:nlm sync [notebook]`

Sync new files from watch directories to a NotebookLM notebook.

1. Read `.nlm.yml` to get the notebook config
2. If `[notebook]` not specified and only one notebook exists, use it. Otherwise ask.
3. List existing sources in the notebook using `mcp__notebooklm-mcp__source_list` (if available) or ask the user what's already uploaded
4. Glob the `watch` directories for `.md` files
5. Compare filenames to existing sources -- identify new files not yet uploaded
6. Show the user what's new and confirm before uploading
7. Upload each new file using `mcp__notebooklm-mcp__source_add` with `source_type: "file"` and `wait: true`
8. Report results

### `/productivity:nlm query "question" [notebook]`

RAG query against notebook sources.

1. Read `.nlm.yml` for notebook ID
2. Call `mcp__notebooklm-mcp__notebook_query` with the question
3. Display the answer with source citations
4. Save the `conversation_id` for follow-up queries in the same session

### `/productivity:nlm audio [--preset] [notebook]`

Generate an Audio Overview.

1. Read `.nlm.yml` for notebook ID and audio presets
2. If `--preset` provided (e.g. `--expert`, `--stakeholder`, `--onboarding`), load preset config:
   - `format` maps to `audio_format` parameter
   - `length` maps to `audio_length` parameter
   - `focus` maps to `focus_prompt` parameter
3. If no preset, ask the user for a focus prompt or use defaults
4. Call `mcp__notebooklm-mcp__studio_create` with `artifact_type: "audio"` and `confirm: true`
5. Poll `mcp__notebooklm-mcp__studio_status` until complete (wait 30s between polls)
6. Report the audio URL when ready

### `/productivity:nlm infographic [--preset] [notebook]`

Generate an infographic.

1. Read `.nlm.yml` for notebook ID and infographic presets
2. If `--preset` provided (e.g. `--executive-one-pager`, `--systems-diagram`, `--by-the-numbers`, `--timeline`, `--process-flow`, `--comparison-matrix`, `--bold-minimal`), load preset config:
   - `orientation` maps to `orientation` parameter
   - `detail_level` maps to `detail_level` parameter
   - `style` maps to `infographic_style` parameter
   - `focus` maps to `focus_prompt` parameter
3. If no preset, show available presets and ask the user to pick one or provide custom instructions
4. Call `mcp__notebooklm-mcp__studio_create` with `artifact_type: "infographic"` and `confirm: true`
5. Poll `mcp__notebooklm-mcp__studio_status` until complete
6. Report the infographic URL when ready

### `/productivity:nlm slides [notebook]`

Generate a slide deck.

1. Read `.nlm.yml` for notebook ID
2. Ask for focus prompt or use a sensible default based on notebook name
3. Call `mcp__notebooklm-mcp__studio_create` with `artifact_type: "slide_deck"` and `confirm: true`
4. Poll status and report URL

### `/productivity:nlm report [--format] [notebook]`

Generate a report.

1. Read `.nlm.yml` for notebook ID
2. `--format` options: `briefing` (default), `study-guide`, `blog-post`, `custom`
3. Map format to `report_format` parameter: "Briefing Doc", "Study Guide", "Blog Post", "Create Your Own"
4. If `custom`, ask for a `custom_prompt`
5. Call `mcp__notebooklm-mcp__studio_create` with `artifact_type: "report"` and `confirm: true`
6. Report content when ready

### `/productivity:nlm mindmap [notebook]`

Generate a mind map.

1. Read `.nlm.yml` for notebook ID
2. Ask for a title or focus prompt
3. Call `mcp__notebooklm-mcp__studio_create` with `artifact_type: "mind_map"` and `confirm: true`
4. Poll status and report URL

### `/productivity:nlm status [notebook]`

Check artifact generation status.

1. Read `.nlm.yml` for notebook ID
2. Call `mcp__notebooklm-mcp__studio_status`
3. Display all artifacts with their status, type, and URLs (if complete)

### `/productivity:nlm create "name"`

Create a new notebook.

1. Call `mcp__notebooklm-mcp__notebook_create` with the provided title
2. Display the new notebook ID and URL
3. Suggest adding it to `.nlm.yml`

### `/productivity:nlm add [file|url|text] [notebook]`

Add a single source to a notebook.

1. Read `.nlm.yml` for notebook ID
2. Detect source type:
   - File path (`.md`, `.pdf`, `.txt`) -- use `source_type: "file"`
   - URL (starts with `http`) -- use `source_type: "url"`
   - Otherwise treat as text -- use `source_type: "text"`, ask for a title
3. Call `mcp__notebooklm-mcp__source_add` with `wait: true`
4. Report success

## Preset Reference

When the user asks "what presets are available?", show this:

### Audio Presets
| Preset | Format | Length | Focus |
|--------|--------|--------|-------|
| `expert` | brief | short | Senior engineers, skip basics, methodology gaps |
| `stakeholder` | deep_dive | default | Program director, decisions/blockers/actions |
| `podcast` | deep_dive | long | Deep-dive discussion, trade-offs, non-obvious insights |
| `onboarding` | deep_dive | long | New team member, thorough coverage |

### Infographic Presets
| Preset | Orientation | Detail | Best For |
|--------|------------|--------|----------|
| `executive-one-pager` | landscape | detailed | Senior decision-makers |
| `systems-diagram` | landscape | detailed | Architecture overviews |
| `by-the-numbers` | portrait | detailed | Stakeholder updates |
| `timeline` | landscape | standard | Program roadmaps |
| `process-flow` | landscape | standard | Onboarding flows |
| `comparison-matrix` | landscape | detailed | Framework/tech comparisons |
| `bold-minimal` | portrait | standard | Single hero insight |

## Error Handling

- If MCP tools return auth errors, tell the user to run `nlm login` in their terminal, then call `mcp__notebooklm-mcp__refresh_auth`
- If `.nlm.yml` is missing, guide the user to create one or ask for notebook ID directly
- If artifact generation fails, check `studio_status` for error details

## Important

- Always read `.nlm.yml` before any operation
- Always confirm with the user before generating artifacts (they consume NotebookLM quota)
- Poll status with 30-second intervals -- audio takes 2-5 minutes, infographics 1-3 minutes
- The skill uses NotebookLM MCP tools exclusively -- never shell out to `nlm` CLI
