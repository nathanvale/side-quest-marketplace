---
created: 2026-02-27
title: "Claude Code Advanced Tips: 6 Months of Hardcore Engineering Use [2026]"
type: research
tags: [claude-code, skills, hooks, agents, memory]
project: my-agent-dojo
status: final
source_url: "https://www.iwoszapar.com/p/claude-code-advanced-tips-engineers-2026"
author: "Iwo Szapar"
published_date: 2026-01-30
---

## Summary

Practical systems from 6 months and 300k+ lines of code of daily Claude Code use. Covers four core systems: skills auto-activation via hooks, a dev docs workflow that survives context compaction, a hooks pipeline for zero-errors-left-behind, and PM2 integration for multi-service debugging. The key thesis is that consistent, production-quality code from AI requires building systems around Claude Code, not just prompting it.

## Key Findings

### The Skills Auto-Activation System

**Problem:** You write comprehensive Skills (best practices docs). Claude ignores them. Even using exact keywords from skill descriptions doesn't trigger loading.

**Solution: Hooks that force skill loading via a multi-layered architecture.**

**Hook 1: UserPromptSubmit** (runs BEFORE Claude sees your message)
- Analyzes prompt for keywords and intent patterns
- Checks which skills might be relevant
- Injects a formatted reminder into Claude's context

**Hook 2: Stop Event** (runs AFTER Claude finishes responding)
- Analyzes which files were edited
- Checks for risky patterns (try-catch, database operations, async)
- Displays gentle self-check reminder (non-blocking)

**skill-rules.json configuration:**

```json
{
  "backend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "promptTriggers": {
      "keywords": ["backend", "controller", "service", "API"],
      "intentPatterns": [
        "(create|add).*?(route|endpoint|controller)",
        "(how to|best practice).*?(backend|API)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": ["backend/src/**/*.ts"],
      "contentPatterns": ["router\\.", "export.*Controller"]
    }
  }
}
```

**Results:** Consistent patterns automatically enforced. Claude self-corrects before you see the code. Way less time on reviews and fixes.

### The Dev Docs System (Context Management)

**Problem:** Claude is like an extremely confident junior dev with extreme amnesia. Loses track, goes off on tangents, forgets the plan.

**Solution: Three-file system for every large task:**

```
/dev/active/[task-name]/
  [task-name]-plan.md      # The approved plan
  [task-name]-context.md   # Key files, decisions, gotchas
  [task-name]-tasks.md     # Checklist of work
```

**Workflow:**
1. Use planning mode to research and create plan
2. Review plan thoroughly (catch mistakes here)
3. Run `/dev-docs` to create the three files
4. Claude now has persistent task memory

**During implementation:** Remind Claude to update tasks as completed. Add relevant context to context.md. When low on context: `/update-dev-docs` then compact.

**Continuing after compaction:** Just say "continue" -- Claude reads all three files and picks up exactly where it left off.

**Why it matters:** Survives any context reset. Always knows the plan. Implementation stays on track.

### The Hooks System (#NoMessLeftBehind)

**Hook 1: File Edit Tracker** (Post-tool-use after every Edit/Write/MultiEdit)
- Logs which files were edited, what repo they belong to, and timestamps

**Hook 2: Build Checker** (Stop hook when Claude finishes responding)
1. Reads edit logs to find modified repos
2. Runs build scripts on each affected repo
3. Checks for TypeScript errors
4. If < 5 errors: Shows to Claude
5. If >= 5 errors: Recommends auto-error-resolver agent

**Result:** Not a single instance of Claude leaving errors for you to find later.

**Hook 3: Error Handling Reminder** (non-blocking awareness)

```
ERROR HANDLING SELF-CHECK

Backend Changes Detected
   2 file(s) edited

   Did you add Sentry.captureException() in catch blocks?
   Are Prisma operations wrapped in error handling?

   Backend Best Practice:
      - All errors should be captured to Sentry
      - Controllers should extend BaseController
```

### PM2 for Backend Services

**Problem:** Multiple microservices running. Claude can't see logs. You become a human log-fetching service.

**Solution:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'form-service',
      script: 'npm',
      args: 'start',
      cwd: './form',
      error_file: './form/logs/error.log',
      out_file: './form/logs/out.log',
    },
    // ... more services
  ]
};
```

**Before PM2:** You manually find logs, paste into chat, wait for analysis.
**After PM2:** Claude runs `pm2 logs email --lines 200`, reads the logs, diagnoses the issue, and restarts the service. Autonomous debugging.

### Specialized Agents

**Quality Control:**
- code-architecture-reviewer
- build-error-resolver
- refactor-planner

**Testing & Debugging:**
- auth-route-tester
- auth-route-debugger
- frontend-error-fixer

**Planning & Strategy:**
- strategic-plan-architect
- plan-reviewer
- documentation-architect

Key: Give agents specific roles and clear instructions on what to return.

### CLAUDE.md Structure

**What moved to Skills** (previously in BEST_PRACTICES.md at 1,400+ lines):
- TypeScript standards
- React patterns
- Backend API patterns
- Error handling
- Database patterns

**What stays in CLAUDE.md (~200 lines):**
- Quick commands (pnpm pm2:start, pnpm build)
- Service-specific configuration
- Task management workflow
- Testing authenticated routes

**Principle:** Skills handle "how to write code." CLAUDE.md handles "how this project works."

### The Complete Pipeline

```
Claude finishes responding
  |
Hook 1: Build checker runs -> TypeScript errors caught
  |
Hook 2: Error reminder runs -> Gentle self-check
  |
If errors found -> Claude sees them and fixes
  |
If too many -> Auto-error-resolver agent recommended
  |
Result: Clean, error-free code
```

Plus UserPromptSubmit hook loads relevant skills BEFORE starting.

### Key Statistics

- **300k+ LOC** rewritten in 6 months (solo)
- **40-60% token efficiency improvement** with proper skill structure
- **Zero errors left behind** with hook system
- **Survives any context reset** with dev docs

## Sources

- [Claude Code Advanced Tips (Original Article)](https://www.iwoszapar.com/p/claude-code-advanced-tips-engineers-2026)

## Open Questions

- The skill-rules.json approach uses custom hooks for auto-activation. Has Anthropic built any native skill auto-activation since January 2026?
- The dev docs three-file system could potentially be automated with hooks (auto-create on planning mode exit, auto-update on compaction). Is this worth building?
- The build checker hook with a threshold (< 5 errors = show, >= 5 = agent) -- what's the rationale for 5 as the cutoff? Is it empirical?
- How does the file edit tracker handle cross-repo changes in a monorepo setup?
