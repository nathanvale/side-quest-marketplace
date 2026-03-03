---
created: 2026-03-02
title: Git Plugin V2 - Advanced Safety (Shell Tokenization)
type: brainstorm
tags: [git, safety, shell-tokenization, safety-net, hooks, PreToolUse, defense-in-depth]
project: git-plugin
status: draft
builds-on:
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md
  - docs/research/2026-03-02-safety-hook-architecture.md
---

# Git Plugin V2 - Advanced Safety (Shell Tokenization)

The V2 plan includes low-complexity safety fixes (stash drop, reset --merge, find -delete, flag parsing). But the HIGH-risk shell wrapper bypass and medium-risk interpreter/xargs gaps require an architectural decision: build our own shell tokenization or recommend `claude-code-safety-net` as companion.

---

## The Problem

Our `git-safety.ts` hook does regex on raw command strings. This means:

```bash
# We catch this:
git reset --hard

# We DON'T catch this:
bash -c "git reset --hard"
python -c 'import os; os.system("git reset --hard")'
xargs bash -c 'git reset --hard'
sudo git reset --hard
```

`claude-code-safety-net` catches all of these via proper shell tokenization (using the `shell-quote` library), recursive unwrapping (10 levels deep), and interpreter scanning.

---

## The Architectural Decision

### Option A: Build shell tokenization into our hook

Add `shell-quote` as a dependency. Parse commands into tokens. Strip wrappers. Recursively unwrap `bash -c` / `sh -c`. Scan interpreter one-liners.

**Pro:** Single hook does everything, no external dependency recommendation
**Con:** Reimplements what safety-net already does well. 500-1000 lines of additional code. Ongoing maintenance burden. Testing surface area balloons.

### Option B: Recommend safety-net as companion

Document that our hook handles git-specific safety (branch policy, --no-verify, Write/Edit to credentials, event bus reporting) and recommend `claude-code-safety-net` for deep Bash analysis. Both run as PreToolUse hooks simultaneously -- they don't conflict.

**Pro:** Best-of-breed for each concern. Safety-net has 1,099 stars and active maintenance. Zero additional code.
**Con:** Requires users to install a second plugin. Two hooks to debug if something goes wrong.

### Option C: Minimal tokenization (hybrid)

Add basic `bash -c` / `sh -c` unwrapping (1 level deep, not recursive) to our hook. This catches the most common bypass without the full shell tokenization engine. Recommend safety-net for deeper analysis.

**Pro:** Catches the 80% case (Claude rarely nests beyond 1 level). Small code change.
**Con:** Still doesn't catch interpreter bypass, xargs, sudo. Incomplete solution.

---

## Key Questions

1. **How often does Claude actually wrap commands?** If `bash -c "git reset --hard"` never happens in practice, the risk is theoretical. Need data from production logs (event bus).

2. **What's the maintenance burden?** Safety-net's shell tokenization code is non-trivial. If we build it, we own it forever.

3. **User friction of recommending a companion** -- How many users will actually install safety-net? If the answer is "few," Option B doesn't actually improve safety.

4. **Plugin dependency mechanism** -- Can a plugin declare another plugin as a recommended companion? Does the marketplace support this?

---

## What V2 Already Covers

The low-complexity fixes in Plan 3 close the easy gaps without any architectural change:
- `git stash drop` / `git stash clear`
- `git reset --merge`
- `git checkout <ref> -- <path>`
- `find ... -delete` / `find ... -exec rm`
- Independent `-r` and `-f` flag detection

These are concrete and plannable. This brainstorm is about what comes after.

---

## Research Available

- `docs/research/2026-03-02-safety-hook-architecture.md` (Section 3: claude-code-safety-net, Section 6: Architectural Principles)
- `docs/research/2026-03-02-git-plugin-landscape-update.md` (Section 1: Git Safety)
