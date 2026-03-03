---
status: complete
priority: p1
issue_id: "023"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

The Review PR workflow requires human approval before posting ("Draft -> Show -> Approve -> Post (never post without user approval)"). A sub-agent caller cannot provide approval since `AskUserQuestion` is incompatible with agent-to-agent contexts. The review gets stuck at step 7, making the workflow unusable in automated pipelines.

## Findings

- File: `plugins/git/skills/workflow/references/workflows.md` lines 107-109
- The workflow mandates user approval before posting a review to GitHub
- `AskUserQuestion` does not work in Codex, headless agents, or sub-agent callers (per skill authoring conventions in MEMORY.md)
- This makes the review-pr command a dead end when invoked by another agent
- The approval gate is important for interactive use but blocks automation entirely

## Proposed Solutions

### Solution A: Conditional approval gate based on caller context

Add a conditional: "When arguments are fully specified and caller is a sub-agent, skip the approval gate and return the review analysis without posting." The sub-agent gets the findings and decides whether to post.

**Pros:**
- Backward compatible -- interactive users still get the approval gate
- Sub-agents get useful output (the analysis) without hanging

**Cons:**
- Detection of sub-agent context is implicit and may be fragile
- The "never post without approval" invariant has an exception

### Solution B: Split into two primitives

Create two separate commands:
1. `analyze-pr` -- Always works, returns structured findings (no posting)
2. `post-review` -- Requires confirmation, posts the review to GitHub

**Pros:**
- Clean separation of concerns
- Each command has a single responsibility
- No ambiguity about when approval is needed
- `analyze-pr` is universally callable by any context

**Cons:**
- Two commands instead of one
- Existing users/docs need to be updated
- Orchestration burden shifts to the caller for the two-step flow

### Solution C: Add a `--dry-run` flag to review-pr

When `--dry-run` is specified, the command runs the full analysis but skips the approval gate and does not post. Returns the review as structured output.

**Pros:**
- Single command with clear opt-in behavior
- Easy for sub-agents to use: just add `--dry-run`
- No breaking changes to existing workflow

**Cons:**
- Sub-agents need to know to pass the flag
- Still one command doing two things (analysis + posting)

## Technical Details

The current workflow in `workflows.md`:

```markdown
### Review PR
1. Parse PR number from arguments
2. Fetch PR metadata via gh
3. Get diff via gh
4. Analyze changes against best practices
5. Draft review comments
6. Format as GitHub review
7. Show draft to user for approval    <-- blocks here in agent context
8. Post review via gh api
```

For Solution B, the split would be:

```markdown
### analyze-pr
1-6. Same as above
7. Return structured findings

### post-review
1. Accept findings (from analyze-pr or inline)
2. Show draft to user for approval (interactive only)
3. Post review via gh api
```

## Acceptance Criteria

- A sub-agent can invoke review-pr (or its equivalent) and get structured review results without hanging on an approval prompt
- Interactive users retain the approval gate before posting reviews
- The solution follows the skill authoring convention: "NEVER use AskUserQuestion inside skills"
- Review findings are returned in a format that callers (human or agent) can act on
