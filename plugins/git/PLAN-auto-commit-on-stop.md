# Plan: Auto-Commit on Stop Hook

## Current State

- `auto-commit-check.ts` only **checks** for staged changes and blocks stop
- Relies on Claude to manually commit (often forgotten)
- Only triggers if changes are already staged (misses most cases)

## Goal

When Claude naturally stops:
1. **Automatically create fast WIP commits** (never lose work)
2. **Notify user** to clean up with a proper semantic commit later

This gives us the best of both worlds: instant checkpoints + clean git history when ready.

---

## The Two-Phase Approach

```
Claude stops naturally
    ↓
Stop Hook (~100ms):
  1. Stage all changes (git add -A)
  2. Create WIP commit: "chore(wip): <last prompt>"
  3. Print suggestion to user
    ↓
User sees: "✓ Created WIP checkpoint. Run /git:commit to squash into a proper commit."
    ↓
Later, user runs /git:commit (or new /git:squash-wip)
  → Smart-commit skill analyzes ALL the WIP commits
  → Creates one clean semantic commit
  → Squashes the WIP commits
```

### Why This Is Better

| Concern | Solution |
|---------|----------|
| Speed | Deterministic hook is fast (~100ms) |
| Never lose work | Every stop creates a checkpoint |
| Clean history | User squashes WIP commits when ready |
| User control | They decide when to create the "real" commit |
| Flexibility | Can leave as WIP commits if still iterating |

---

## Research Findings

### Key Questions Answered

1. **Deterministic vs LLM?** → **Deterministic for the hook**
   - Stop hooks need to be fast (under 100ms ideally)
   - LLM analysis happens later via `/git:commit` when user is ready
   - GitButler's approach: deterministic commit with transcript-derived message

2. **Spawn separate Claude process?** → **No, not in the hook**
   - Adds complexity and latency to stop
   - The cleanup skill (`/git:commit`) does the smart analysis
   - Hook just needs to be fast and reliable

3. **Can we leverage smart-commit skill?** → **Yes, but indirectly**
   - Hook creates WIP commits (fast, deterministic)
   - User runs `/git:commit` later for semantic analysis
   - Could enhance `/git:commit` to detect and squash WIP commits

### Recommended Approach: Fast WIP + Notify + Later Cleanup

1. **Stop hook**: Fast deterministic WIP commit + user notification
2. **Existing `/git:commit`**: Enhance to detect WIP commits and offer to squash
3. **Optional `/git:squash-wip`**: Dedicated skill for WIP cleanup

---

## Implementation Plan

### Phase 1: Stop Hook (Fast WIP Commit + Notification)

**File**: `hooks/auto-commit-on-stop.ts` (rename from `auto-commit-check.ts`)

```
On Stop:
  1. Check stop_hook_active → exit 0 (prevent loops)
  2. Get git status
  3. If no changes → exit 0
  4. Parse transcript for last user prompt
  5. Stage all changes: git add -A
  6. Create commit: "chore(wip): <truncated prompt>"
  7. Print user notification to stdout
  8. Exit 0 (allow stop)
```

**User notification format:**
```
✓ Created WIP checkpoint: chore(wip): add validation to form

  Run /git:commit to squash WIP commits into a clean commit.
```

**Key changes from current implementation:**
- Trigger on **any** uncommitted changes (not just staged)
- Actually **commit** instead of blocking
- Use transcript for meaningful commit message
- **Notify user** about cleanup option

### Phase 2: Enhance `/git:commit` for WIP Squashing

**File**: `skills/smart-commit/SKILL.md`

Add detection for WIP commits:
```
If WIP commits detected since last non-WIP commit:
  1. Show user the WIP commits found
  2. Offer to squash them into one clean commit
  3. Use LLM to analyze all changes and generate semantic message
  4. Interactive rebase to squash
```

**Detection logic:**
```bash
# Find commits matching chore(wip): pattern
git log --oneline --grep="^chore(wip):" HEAD~20..HEAD
```

### Phase 3: Optional Dedicated Skill (Future)

**File**: `skills/squash-wip/SKILL.md` (new)

Dedicated `/git:squash-wip` command if we want separation from `/git:commit`:
- Lists all WIP commits
- Analyzes changes across all of them
- Creates one clean Conventional Commit
- Squashes via interactive rebase

---

## Transcript Parsing

The Stop hook receives `transcript_path` in stdin:

```json
{
  "transcript_path": "~/.claude/projects/.../session-id.jsonl",
  "cwd": "/path/to/repo",
  "stop_hook_active": false
}
```

Each JSONL line has structure:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "add rick to the readme"
  }
}
```

**Extract last user prompt:**
1. Read JSONL file line by line (efficient for large files)
2. Filter entries where `type === "user"`
3. Take last one's `message.content`
4. Truncate to ~50 chars for commit subject
5. Fallback: "session checkpoint" if no prompt found

---

## Commit Message Format

```
chore(wip): <truncated last prompt>

Auto-committed by Claude Code Stop hook.
Session work in progress - squash/amend as needed.

Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Why `chore(wip):` not `wip:`?**
- Follows Conventional Commits (consistent with other commits)
- `chore` type is correct for session checkpoints
- `wip` scope clearly marks work-in-progress

---

## Files to Change

| File | Change |
|------|--------|
| `hooks/auto-commit-check.ts` | Rename to `auto-commit-on-stop.ts`, rewrite logic |
| `hooks/auto-commit-check.test.ts` | Rename, update tests |
| `hooks/hooks.json` | Update command path |

## New Functions Needed

```typescript
// Parse transcript to get last user prompt
async function getLastUserPrompt(transcriptPath: string): Promise<string | null>

// Create auto-commit with message
async function createAutoCommit(cwd: string, message: string): Promise<boolean>

// Generate commit message from prompt
function generateCommitMessage(prompt: string | null): string

// Truncate prompt to fit commit subject line
function truncateForSubject(text: string, maxLen: number): string
```

---

## Safety Considerations

1. **Loop prevention**: Check `stop_hook_active` FIRST (already implemented)
2. **Not a git repo**: Exit gracefully (exit 0)
3. **Commit fails**: Log warning to stderr but don't block stop (exit 0)
4. **No transcript/empty**: Use fallback "session checkpoint"
5. **Secrets in files**: User's responsibility - same as manual commits
6. **Performance**: Must complete in under 5 seconds (timeout in hooks.json)

---

## Test Plan

### Unit Tests

1. `parseGitStatus` - existing tests (keep)
2. `getLastUserPrompt` - JSONL parsing
   - Valid transcript with user messages
   - Empty transcript
   - Malformed JSONL lines (should skip)
   - Non-existent file
3. `generateCommitMessage` - message formatting
   - Normal prompt
   - Very long prompt (truncation)
   - Empty/null prompt (fallback)
4. `truncateForSubject` - edge cases

### Integration Tests

1. Uncommitted changes → creates commit
2. Modified + untracked files → all get staged and committed
3. Clean working tree → no commit, exit 0
4. Not a git repo → exit 0 gracefully
5. stop_hook_active=true → exit 0 immediately

### Manual Testing

1. Make changes, let Claude naturally stop → verify commit created
2. Check commit message format matches expected
3. Verify no infinite loops when stop_hook_active triggers

---

## Implementation Order

### Phase 1: Stop Hook (MVP) ✅ COMPLETE

1. [x] Add new functions with tests (TDD)
   - `getLastUserPrompt` - Parse transcript JSONL
   - `generateCommitMessage` - Format commit message
   - `truncateForSubject` - Fit in subject line
   - `createAutoCommit` - Stage + commit
   - `printUserNotification` - Stdout message

2. [x] Update main logic
   - Change from "check and block" to "commit and allow"
   - Trigger on any uncommitted changes (not just staged)
   - Add user notification after commit

3. [x] Rename files
   - `auto-commit-check.ts` → `auto-commit-on-stop.ts`
   - `auto-commit-check.test.ts` → `auto-commit-on-stop.test.ts`
   - Update `hooks.json`

4. [ ] Manual testing (ready for user to test)
   - Make changes, let session stop
   - Verify commit appears in git log
   - Verify notification prints

5. [ ] Monitor via `/git:session-log`

### Phase 2: WIP Squashing in `/git:commit`

6. [ ] Research git squash mechanics
   - How to squash commits programmatically
   - Non-interactive rebase options

7. [ ] Update `skills/smart-commit/SKILL.md`
   - Add WIP detection step
   - Add squash flow when WIP commits found

8. [ ] Test squash workflow
   - Multiple WIP commits → one clean commit

### Phase 3: Dedicated Skill (Optional)

9. [ ] Create `/git:squash-wip` skill if needed
   - Only if we want separation from `/git:commit`

---

## Decision Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Deterministic or LLM? | Deterministic for hook | Speed, simplicity; LLM analysis happens later in `/git:commit` |
| Spawn separate Claude? | No, not in hook | Hook needs to be fast; cleanup skill does the smart work |
| Leverage smart-commit? | Yes, indirectly | Hook creates WIP commits, user runs `/git:commit` to squash with LLM |
| Commit prefix | `chore(wip):` | Consistent with Conventional Commits, easy to detect for squashing |
| Auto-stage behavior | `git add -A` | Capture all work; user can git reset if needed |
| Trigger condition | Any uncommitted changes | Don't rely on user to stage first |
| User notification? | Yes, always | Inform user about cleanup option, ADHD-friendly reminder |
| Cleanup approach | Enhance `/git:commit` | Reuse existing skill rather than creating new command |
