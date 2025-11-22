# Documentation Access Fallback Pattern

## Overview

This pattern ensures graceful degradation when the claude-docs-expert skill cannot be invoked.

## Implementation Strategy

### 1. Primary Method

Always attempt to invoke claude-docs-expert first:

```
Invoke claude-docs-expert to [action]
```

### 2. Handle Invocation Failure

If the invocation fails (skill doesn't exist or can't be found):

- Don't check filesystem paths
- Don't validate skill existence
- Simply try to invoke and handle the failure

### 3. Fallback Methods (in order)

#### Internal Context/Knowledge (First Fallback)

Use your built-in knowledge when skill invocation fails:

- Rely on knowledge cutoff information
- Use validated patterns and best practices
- Reference comprehensive files in skills
- Inform user if using cached knowledge

#### WebFetch (Final Fallback)

Direct access to official documentation if context insufficient:

```
WebFetch from https://docs.anthropic.com/en/docs/claude-code/[topic]
```

Common URLs:

- Overview: https://docs.anthropic.com/en/docs/claude-code
- Skills: https://docs.anthropic.com/en/docs/claude-code/skills
- Hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Plugins: https://docs.anthropic.com/en/docs/claude-code/plugins
- Slash Commands: https://docs.anthropic.com/en/docs/claude-code/slash-commands
- Common Workflows: https://docs.anthropic.com/en/docs/claude-code/common-workflows

## Example Implementation

```markdown
**Documentation Strategy:**

1. Try: Invoke claude-docs-expert to get latest documentation
2. If invocation fails: Use internal context/knowledge
3. If context insufficient: Use WebFetch from official docs
```

The key is to **just try** the invocation - don't pre-check or validate. Always prefer internal
context over external calls when possible.

## Benefits

1. **Resilience**: Skills work even without claude-docs-expert
2. **Transparency**: Clear fallback hierarchy
3. **Flexibility**: Multiple fallback options
4. **Performance**: Avoid unnecessary failures

## Usage in Skills

When creating or updating skills that need documentation:

1. Always specify primary method first
2. Document fallback options clearly
3. Include detection logic where appropriate
4. Provide specific URLs for WebFetch fallbacks

## Pattern Template

```markdown
## Documentation Access

Try these methods in order:

1. **Invoke claude-docs-expert** to [specific action]
2. **If invocation fails**, use internal context/knowledge
3. **If context insufficient**, use WebFetch to access
   https://docs.anthropic.com/en/docs/claude-code/[topic]
```

No pre-checking needed - just try to invoke and handle any failure gracefully. Prioritize internal
resources before making external calls.

This ensures all skills can access documentation regardless of environment configuration.
