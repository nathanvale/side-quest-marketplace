[​

](#built-in-slash-commands)

## Built-in slash commands

| Command | Purpose |
| --- | --- |
| `/add-dir` | Add additional working directories |
| `/agents` | Manage custom AI subagents for specialized tasks |
| `/bashes` | List and manage background tasks |
| `/bug` | Report bugs (sends conversation to Anthropic) |
| `/clear` | Clear conversation history |
| `/compact [instructions]` | Compact conversation with optional focus instructions |
| `/config` | Open the Settings interface (Config tab) |
| `/context` | Visualize current context usage as a colored grid |
| `/cost` | Show token usage statistics (see cost tracking guide for subscription-specific details) |
| `/doctor` | Checks the health of your Claude Code installation |
| `/exit` | Exit the REPL |
| `/export [filename]` | Export the current conversation to a file or clipboard |
| `/help` | Get usage help |
| `/hooks` | Manage hook configurations for tool events |
| `/ide` | Manage IDE integrations and show status |
| `/init` | Initialize project with CLAUDE.md guide |
| `/install-github-app` | Set up Claude GitHub Actions for a repository |
| `/login` | Switch Anthropic accounts |
| `/logout` | Sign out from your Anthropic account |
| `/mcp` | Manage MCP server connections and OAuth authentication |
| `/memory` | Edit CLAUDE.md memory files |
| `/model` | Select or change the AI model |
| `/output-style [style]` | Set the output style directly or from a selection menu |
| `/permissions` | View or update permissions |
| `/plugin` | Manage Claude Code plugins |
| `/pr-comments` | View pull request comments |
| `/privacy-settings` | View and update your privacy settings |
| `/release-notes` | View release notes |
| `/resume` | Resume a conversation |
| `/review` | Request code review |
| `/rewind` | Rewind the conversation and/or code |
| `/sandbox` | Enable sandboxed bash tool with filesystem and network isolation for safer, more autonomous execution |
| `/security-review` | Complete a security review of pending changes on the current branch |
| `/status` | Open the Settings interface (Status tab) showing version, model, account, and connectivity |
| `/statusline` | Set up Claude Code’s status line UI |
| `/terminal-setup` | Install Shift+Enter key binding for newlines (iTerm2 and VSCode only) |
| `/todos` | List current todo items |
| `/usage` | Show plan usage limits and rate limit status (subscription plans only) |
| `/vim` | Enter vim mode for alternating insert and command modes |

[​

](#custom-slash-commands)

## Custom slash commands

Custom slash commands allow you to define frequently-used prompts as Markdown files that Claude Code can execute. Commands are organized by scope (project-specific or personal) and support namespacing through directory structures.

###

[​

](#syntax)

Syntax

Copy

Ask AI

```
/<command-name> [arguments]
```

####

[​

](#parameters)

Parameters

| Parameter | Description |
| --- | --- |
| `<command-name>` | Name derived from the Markdown filename (without `.md` extension) |
| `[arguments]` | Optional arguments passed to the command |

###

[​

](#command-types)

Command types

####

[​

](#project-commands)

Project commands

Commands stored in your repository and shared with your team. When listed in `/help`, these commands show “(project)” after their description. **Location**: `.claude/commands/` In the following example, we create the `/optimize` command:

Copy

Ask AI

```
# Create a project command
mkdir -p .claude/commands
echo "Analyze this code for performance issues and suggest optimizations:" > .claude/commands/optimize.md
```

####

[​

](#personal-commands)

Personal commands

Commands available across all your projects. When listed in `/help`, these commands show “(user)” after their description. **Location**: `~/.claude/commands/` In the following example, we create the `/security-review` command:

Copy

Ask AI

```
# Create a personal command
mkdir -p ~/.claude/commands
echo "Review this code for security vulnerabilities:" > ~/.claude/commands/security-review.md
```

###

[​

](#features)

Features

####

[​

](#namespacing)

Namespacing

Organize commands in subdirectories. The subdirectories are used for organization and appear in the command description, but they do not affect the command name itself. The description will show whether the command comes from the project directory (`.claude/commands`) or the user-level directory (`~/.claude/commands`), along with the subdirectory name. Conflicts between user and project level commands are not supported. Otherwise, multiple commands with the same base file name can coexist. For example, a file at `.claude/commands/frontend/component.md` creates the command `/component` with description showing “(project:frontend)”. Meanwhile, a file at `~/.claude/commands/component.md` creates the command `/component` with description showing “(user)”.

####

[​

](#arguments)

Arguments

Pass dynamic values to commands using argument placeholders:

##### All arguments with `$ARGUMENTS`

The `$ARGUMENTS` placeholder captures all arguments passed to the command:

Copy

Ask AI

```
# Command definition
echo 'Fix issue #$ARGUMENTS following our coding standards' > .claude/commands/fix-issue.md

# Usage
> /fix-issue 123 high-priority
# $ARGUMENTS becomes: "123 high-priority"
```

##### Individual arguments with `$1`, `$2`, etc.

Access specific arguments individually using positional parameters (similar to shell scripts):

Copy

Ask AI

```
# Command definition  
echo 'Review PR #$1 with priority $2 and assign to $3' > .claude/commands/review-pr.md

# Usage
> /review-pr 456 high alice
# $1 becomes "456", $2 becomes "high", $3 becomes "alice"
```

Use positional arguments when you need to:

- Access arguments individually in different parts of your command
- Provide defaults for missing arguments
- Build more structured commands with specific parameter roles

####

[​

](#bash-command-execution)

Bash command execution

Execute bash commands before the slash command runs using the `!` prefix. The output is included in the command context. You *must* include `allowed-tools` with the `Bash` tool, but you can choose the specific bash commands to allow. For example:

Copy

Ask AI

## ```
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
## description: Create a git commit

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Based on the above changes, create a single git commit.
```

####

[​

](#file-references)

File references

Include file contents in commands using the `@` prefix to [reference files](common-workflows.md#reference-files-and-directories). For example:

Copy

Ask AI

```
# Reference a specific file

Review the implementation in @src/utils/helpers.js

# Reference multiple files

Compare @src/old-version.js with @src/new-version.js
```

####

[​

](#thinking-mode)

Thinking mode

Slash commands can trigger extended thinking by including [extended thinking keywords](common-workflows.md#use-extended-thinking).

###

[​

](#frontmatter)

Frontmatter

Command files support frontmatter, useful for specifying metadata about the command:

| Frontmatter | Purpose | Default |
| --- | --- | --- |
| `allowed-tools` | List of tools the command can use | Inherits from the conversation |
| `argument-hint` | The arguments expected for the slash command. Example: `argument-hint: add [tagId] | remove [tagId] | list`. This hint is shown to the user when auto-completing the slash command. | None |
| `description` | Brief description of the command | Uses the first line from the prompt |
| `model` | Specific model string (see Models overview) | Inherits from the conversation |
| `disable-model-invocation` | Whether to prevent `SlashCommand` tool from calling this command | false |

For example:

Copy

Ask AI

## ```
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
argument-hint: [message]
description: Create a git commit
## model: claude-3-5-haiku-20241022

Create a git commit with message: $ARGUMENTS
```

Example using positional arguments:

Copy

Ask AI

## ```
argument-hint: [pr-number] [priority] [assignee]
## description: Review pull request

Review PR #$1 with priority $2 and assign to $3.
Focus on security, performance, and code style.
```

[​

](#plugin-commands)

## Plugin commands

[Plugins](plugins.md) can provide custom slash commands that integrate seamlessly with Claude Code. Plugin commands work exactly like user-defined commands but are distributed through [plugin marketplaces](plugin-marketplaces.md).

###

[​

](#how-plugin-commands-work)

How plugin commands work

Plugin commands are:

- **Namespaced**: Commands can use the format `/plugin-name:command-name` to avoid conflicts (plugin prefix is optional unless there are name collisions)
- **Automatically available**: Once a plugin is installed and enabled, its commands appear in `/help`
- **Fully integrated**: Support all command features (arguments, frontmatter, bash execution, file references)

###

[​

](#plugin-command-structure)

Plugin command structure

**Location**: `commands/` directory in plugin root **File format**: Markdown files with frontmatter **Basic command structure**:

Copy

Ask AI

## ```
## description: Brief description of what the command does

# Command Name

Detailed instructions for Claude on how to execute this command.
Include specific guidance on parameters, expected outcomes, and any special considerations.
```

**Advanced command features**:

- **Arguments**: Use placeholders like `{arg1}` in command descriptions
- **Subdirectories**: Organize commands in subdirectories for namespacing
- **Bash integration**: Commands can execute shell scripts and programs
- **File references**: Commands can reference and modify project files

###

[​

](#invocation-patterns)

Invocation patterns

Direct command (when no conflicts)

Copy

Ask AI

```
/command-name
```

Plugin-prefixed (when needed for disambiguation)

Copy

Ask AI

```
/plugin-name:command-name
```

With arguments (if command supports them)

Copy

Ask AI

```
/command-name arg1 arg2
```

[​

](#mcp-slash-commands)

## MCP slash commands

MCP servers can expose prompts as slash commands that become available in Claude Code. These commands are dynamically discovered from connected MCP servers.

###

[​

](#command-format)

Command format

MCP commands follow the pattern:

Copy

Ask AI

```
/mcp__<server-name>__<prompt-name> [arguments]
```

###

[​

](#features-2)

Features

####

[​

](#dynamic-discovery)

Dynamic discovery

MCP commands are automatically available when:

- An MCP server is connected and active
- The server exposes prompts through the MCP protocol
- The prompts are successfully retrieved during connection

####

[​

](#arguments-2)

Arguments

MCP prompts can accept arguments defined by the server:

Copy

Ask AI

```
# Without arguments
> /mcp__github__list_prs

# With arguments
> /mcp__github__pr_review 456
> /mcp__jira__create_issue "Bug title" high
```

####

[​

](#naming-conventions)

Naming conventions

- Server and prompt names are normalized
- Spaces and special characters become underscores
- Names are lowercased for consistency

###

[​

](#managing-mcp-connections)

Managing MCP connections

Use the `/mcp` command to:

- View all configured MCP servers
- Check connection status
- Authenticate with OAuth-enabled servers
- Clear authentication tokens
- View available tools and prompts from each server

###

[​

](#mcp-permissions-and-wildcards)

MCP permissions and wildcards

When configuring [permissions for MCP tools](iam.md#tool-specific-permission-rules), note that **wildcards are not supported**:

- ✅ **Correct**: `mcp__github` (approves ALL tools from the github server)
- ✅ **Correct**: `mcp__github__get_issue` (approves specific tool)
- ❌ **Incorrect**: `mcp__github__*` (wildcards not supported)

To approve all tools from an MCP server, use just the server name: `mcp__servername`. To approve specific tools only, list each tool individually.

[​

](#slashcommand-tool)

## `SlashCommand` tool

The `SlashCommand` tool allows Claude to execute [custom slash commands](slash-commands.md#custom-slash-commands) programmatically during a conversation. This gives Claude the ability to invoke custom commands on your behalf when appropriate. To encourage Claude to trigger `SlashCommand` tool, your instructions (prompts, CLAUDE.md, etc.) generally need to reference the command by name with its slash. Example:

Copy

Ask AI

```
> Run /write-unit-test when you are about to start writing tests.
```

This tool puts each available custom slash command’s metadata into context up to the character budget limit. You can use `/context` to monitor token usage and follow the operations below to manage context.

###

[​

](#slashcommand-tool-supported-commands)

`SlashCommand` tool supported commands

`SlashCommand` tool only supports custom slash commands that:

- Are user-defined. Built-in commands like `/compact` and `/init` are *not* supported.
- Have the `description` frontmatter field populated. We use the `description` in the context.

For Claude Code versions >= 1.0.124, you can see which custom slash commands `SlashCommand` tool can invoke by running `claude --debug` and triggering a query.

###

[​

](#disable-slashcommand-tool)

Disable `SlashCommand` tool

To prevent Claude from executing any slash commands via the tool:

Copy

Ask AI

```
/permissions
# Add to deny rules: SlashCommand
```

This will also remove SlashCommand tool (and the slash command descriptions) from context.

###

[​

](#disable-specific-commands-only)

Disable specific commands only

To prevent a specific slash command from becoming available, add `disable-model-invocation: true` to the slash command’s frontmatter. This will also remove the command’s metadata from context.

###

[​

](#slashcommand-permission-rules)

`SlashCommand` permission rules

The permission rules support:

- **Exact match**: `SlashCommand:/commit` (allows only `/commit` with no arguments)
- **Prefix match**: `SlashCommand:/review-pr:*` (allows `/review-pr` with any arguments)

###

[​

](#character-budget-limit)

Character budget limit

The `SlashCommand` tool includes a character budget to limit the size of command descriptions shown to Claude. This prevents token overflow when many commands are available. The budget includes each custom slash command’s name, args, and description.

- **Default limit**: 15,000 characters
- **Custom limit**: Set via `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable

When the character budget is exceeded, Claude will see only a subset of the available commands. In `/context`, a warning will show with “M of N commands”.

[​

](#skills-vs-slash-commands)

## Skills vs slash commands

**Slash commands** and **Agent Skills** serve different purposes in Claude Code:

###

[​

](#use-slash-commands-for)

Use slash commands for

**Quick, frequently-used prompts**:

- Simple prompt snippets you use often
- Quick reminders or templates
- Frequently-used instructions that fit in one file

**Examples**:

- `/review` → “Review this code for bugs and suggest improvements”
- `/explain` → “Explain this code in simple terms”
- `/optimize` → “Analyze this code for performance issues”

###

[​

](#use-skills-for)

Use Skills for

**Comprehensive capabilities with structure**:

- Complex workflows with multiple steps
- Capabilities requiring scripts or utilities
- Knowledge organized across multiple files
- Team workflows you want to standardize

**Examples**:

- PDF processing Skill with form-filling scripts and validation
- Data analysis Skill with reference docs for different data types
- Documentation Skill with style guides and templates

###

[​

](#key-differences)

Key differences

| Aspect | Slash Commands | Agent Skills |
| --- | --- | --- |
| **Complexity** | Simple prompts | Complex capabilities |
| **Structure** | Single .md file | Directory with SKILL.md + resources |
| **Discovery** | Explicit invocation (`/command`) | Automatic (based on context) |
| **Files** | One file only | Multiple files, scripts, templates |
| **Scope** | Project or personal | Project or personal |
| **Sharing** | Via git | Via git |

###

[​

](#example-comparison)

Example comparison

**As a slash command**:

Copy

Ask AI

```
# .claude/commands/review.md
Review this code for:
- Security vulnerabilities
- Performance issues
- Code style violations
```

Usage: `/review` (manual invocation) **As a Skill**:

Copy

Ask AI

```
.claude/skills/code-review/
├── SKILL.md (overview and workflows)
├── SECURITY.md (security checklist)
├── PERFORMANCE.md (performance patterns)
├── STYLE.md (style guide reference)
└── scripts/
    └── run-linters.sh
```

Usage: “Can you review this code?” (automatic discovery) The Skill provides richer context, validation scripts, and organized reference material.

###

[​

](#when-to-use-each)

When to use each

**Use slash commands**:

- You invoke the same prompt repeatedly
- The prompt fits in a single file
- You want explicit control over when it runs

**Use Skills**:

- Claude should discover the capability automatically
- Multiple files or scripts are needed
- Complex workflows with validation steps
- Team needs standardized, detailed guidance

Both slash commands and Skills can coexist. Use the approach that fits your needs. Learn more about [Agent Skills](skills.md).

[​

](#see-also)

## See also

- [Plugins](plugins.md) - Extend Claude Code with custom commands through plugins
- [Identity and Access Management](iam.md) - Complete guide to permissions, including MCP tool permissions
- [Interactive mode](interactive-mode.md) - Shortcuts, input modes, and interactive features
- [CLI reference](cli-reference.md) - Command-line flags and options
- [Settings](settings.md) - Configuration options
- [Memory management](memory.md) - Managing Claude’s memory across sessions

[Interactive mode](interactive-mode.md)[Checkpointing](checkpointing.md)

⌘I