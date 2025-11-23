# Analyze Last Agent Run

You are an expert at analyzing Claude Code agent execution logs and debugging failures.

## Your Mission

Analyze the most recent Claude Code agent execution from JSONL logs and help debug any issues that
occurred.

## Step 1: Find Most Recent Agent Log

First, find the most recent agent log file:

```bash
# Convert current working directory to Claude Code project path format
PROJECT_PATH=$(pwd | sed 's|/|-|g')

# Get the most recent agent log file for this project
LATEST_LOG=$(stat -f "%m %N" ~/.claude/projects/${PROJECT_PATH}/agent-*.jsonl 2>/dev/null | sort -rn | head -1 | awk '{print $2}')

# If no logs found for this project, find the most recent log across ALL projects
if [ -z "$LATEST_LOG" ]; then
  LATEST_LOG=$(stat -f "%m %N" ~/.claude/projects/*/agent-*.jsonl 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
fi

echo "📋 Analyzing: $LATEST_LOG"
```

## Step 2: Use file-analyzer Agent

Launch the `file-analyzer` agent with a task to analyze the JSONL log:

```
Task: Analyze this Claude Code agent execution log to understand what happened

File: $LATEST_LOG

Extract and summarize:

1. **Original Request**: What did the user ask for?
2. **Tools Executed**: List all tool calls (Read, Write, Bash, etc.)
3. **Errors**: Any failed tool calls or error messages
4. **Files Modified**: Which files were read/written
5. **Final Outcome**: Success, partial, or failed?
6. **Key Issues**: Main problems encountered

Focus especially on:
- Tool execution failures (is_error: true)
- Error messages in tool results
- Bash commands that failed
- Type errors (TS####)
- Test failures
- Permission denied errors
```

## Step 3: Present Structured Analysis

After the file-analyzer completes, present findings in this format:

```markdown
## Agent Execution Analysis

**Log File**: `agent-[hash].jsonl` **Project**: [project name] **Timestamp**: [when it ran]
**Status**: ✅ Success / ⚠️ Partial / ❌ Failed

---

### Original Request

> [Quote the user's original request]

### Execution Timeline

1. [First action taken]
2. [Second action taken]
3. ...

### Tools Used

| Tool  | Count | Failures |
| ----- | ----- | -------- |
| Read  | X     | 0        |
| Write | Y     | 0        |
| Bash  | Z     | 2 ❌     |

### Errors Encountered

#### Error 1: [Error type]
```

[Full error message]

```
**Context**: [What was being attempted]
**Root Cause**: [Why it failed]

#### Error 2: [Error type]
...

### Files Modified
- `file1.ts` - [What changed]
- `file2.ts` - [What changed]

### Root Cause Analysis
[Deep explanation of why things failed]

### Impact
- [What works]
- [What doesn't work]
- [What's incomplete]

---

## What Next?

Would you like me to:

1. **Debug specific errors** - Deep dive into [error X]
2. **Review code changes** - Analyze modifications made
3. **Continue the work** - Pick up where agent left off
4. **Fix and retry** - Apply fixes and rerun
5. **Rollback changes** - Undo what was done

Or ask me a specific question about the execution.
```

## Handling Follow-Up Questions

When user asks for deeper analysis like:

> "You had trouble running a script and it came back with some errors. Can you dig into that more?"

You should:

1. **Re-analyze the log** focusing on script execution:

   ```bash
   # Extract all Bash tool calls
   cat $LATEST_LOG | jq 'select(.type=="tool_use" and .name=="Bash")'

   # Extract their results
   cat $LATEST_LOG | jq 'select(.type=="tool_result" and .name=="Bash")'
   ```

2. **Find the specific script** that failed:
   - Extract the command from the log
   - Read the script file
   - Identify the exact line that failed

3. **Diagnose root cause**:
   - Syntax errors
   - Missing dependencies
   - Path problems
   - Permission issues
   - Logic bugs
   - Environment issues

4. **Propose concrete fixes**:

   ```typescript
   // Example fix
   // Before (broken):
   const result = await runScript();

   // After (fixed):
   const result = await runScript().catch((err) => {
     console.error("Script failed:", err);
     return defaultValue;
   });
   ```

5. **Offer to implement** the fixes

## Advanced Analysis Techniques

### Extract Failed Bash Commands

```bash
cat $LATEST_LOG | jq -r '
  select(.type=="tool_result" and .name=="Bash" and .is_error==true) |
  "Command: " + (.tool_use_id // "unknown") + "\nError: " + .content
'
```

### Find Type Errors

```bash
cat $LATEST_LOG | jq -r '
  select(.content | type=="string" and (contains("TS") or contains("Type"))) |
  .content
' | grep -E "TS[0-9]+"
```

### Extract File Modifications

```bash
cat $LATEST_LOG | jq -r '
  select(.type=="tool_use" and (.name=="Write" or .name=="Edit")) |
  .input.file_path
' | sort -u
```

### Timeline View

```bash
cat $LATEST_LOG | jq -r '
  select(.type=="tool_use") |
  (.timestamp // "N/A") + " | " + .name + " | " + (.input.file_path // .input.command // "")
'
```

## Example Complete Workflow

```
User: /analyze-last-run
```
