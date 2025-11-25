This quickstart guide will have you using AI-powered coding assistance in just a few minutes. By the end, you’ll understand how to use Claude Code for common development tasks.

[​

](#before-you-begin)

## Before you begin

Make sure you have:

- A terminal or command prompt open
- A code project to work with
- A [Claude.ai](https://claude.ai) (recommended) or [Claude Console](https://console.anthropic.com/) account

[​

](#step-1:-install-claude-code)

## Step 1: Install Claude Code

To install Claude Code, use one of the following methods:

- Native Install (Recommended)

- NPM

**Homebrew (macOS, Linux):**

Copy

Ask AI

```
brew install --cask claude-code
```

**macOS, Linux, WSL:**

Copy

Ask AI

```
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**

Copy

Ask AI

```
irm https://claude.ai/install.ps1 | iex
```

**Windows CMD:**

Copy

Ask AI

```
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

[​

](#step-2:-log-in-to-your-account)

## Step 2: Log in to your account

Claude Code requires an account to use. When you start an interactive session with the `claude` command, you’ll need to log in:

Copy

Ask AI

```
claude
# You'll be prompted to log in on first use
```

Copy

Ask AI

```
/login
# Follow the prompts to log in with your account
```

You can log in using either account type:

- [Claude.ai](https://claude.ai) (subscription plans - recommended)
- [Claude Console](https://console.anthropic.com/) (API access with pre-paid credits)

Once logged in, your credentials are stored and you won’t need to log in again.

When you first authenticate Claude Code with your Claude Console account, a workspace called “Claude Code” is automatically created for you. This workspace provides centralized cost tracking and management for all Claude Code usage in your organization.

You can have both account types under the same email address. If you need to log in again or switch accounts, use the `/login` command within Claude Code.

[​

](#step-3:-start-your-first-session)

## Step 3: Start your first session

Open your terminal in any project directory and start Claude Code:

Copy

Ask AI

```
cd /path/to/your/project
claude
```

You’ll see the Claude Code welcome screen with your session information, recent conversations, and latest updates. Type `/help` for available commands or `/resume` to continue a previous conversation.

After logging in (Step 2), your credentials are stored on your system. Learn more in [Credential Management](iam.md#credential-management).

[​

](#step-4:-ask-your-first-question)

## Step 4: Ask your first question

Let’s start with understanding your codebase. Try one of these commands:

Copy

Ask AI

```
> what does this project do?
```

Claude will analyze your files and provide a summary. You can also ask more specific questions:

Copy

Ask AI

```
> what technologies does this project use?
```

Copy

Ask AI

```
> where is the main entry point?
```

Copy

Ask AI

```
> explain the folder structure
```

You can also ask Claude about its own capabilities:

Copy

Ask AI

```
> what can Claude Code do?
```

Copy

Ask AI

```
> how do I use slash commands in Claude Code?
```

Copy

Ask AI

```
> can Claude Code work with Docker?
```

Claude Code reads your files as needed - you don’t have to manually add context. Claude also has access to its own documentation and can answer questions about its features and capabilities.

[​

](#step-5:-make-your-first-code-change)

## Step 5: Make your first code change

Now let’s make Claude Code do some actual coding. Try a simple task:

Copy

Ask AI

```
> add a hello world function to the main file
```

Claude Code will:

1. Find the appropriate file
2. Show you the proposed changes
3. Ask for your approval
4. Make the edit

Claude Code always asks for permission before modifying files. You can approve individual changes or enable “Accept all” mode for a session.

[​

](#step-6:-use-git-with-claude-code)

## Step 6: Use Git with Claude Code

Claude Code makes Git operations conversational:

Copy

Ask AI

```
> what files have I changed?
```

Copy

Ask AI

```
> commit my changes with a descriptive message
```

You can also prompt for more complex Git operations:

Copy

Ask AI

```
> create a new branch called feature/quickstart
```

Copy

Ask AI

```
> show me the last 5 commits
```

Copy

Ask AI

```
> help me resolve merge conflicts
```

[​

](#step-7:-fix-a-bug-or-add-a-feature)

## Step 7: Fix a bug or add a feature

Claude is proficient at debugging and feature implementation. Describe what you want in natural language:

Copy

Ask AI

```
> add input validation to the user registration form
```

Or fix existing issues:

Copy

Ask AI

```
> there's a bug where users can submit empty forms - fix it
```

Claude Code will:

- Locate the relevant code
- Understand the context
- Implement a solution
- Run tests if available

[​

](#step-8:-test-out-other-common-workflows)

## Step 8: Test out other common workflows

There are a number of ways to work with Claude: **Refactor code**

Copy

Ask AI

```
> refactor the authentication module to use async/await instead of callbacks
```

**Write tests**

Copy

Ask AI

```
> write unit tests for the calculator functions
```

**Update documentation**

Copy

Ask AI

```
> update the README with installation instructions
```

**Code review**

Copy

Ask AI

```
> review my changes and suggest improvements
```

**Remember**: Claude Code is your AI pair programmer. Talk to it like you would a helpful colleague - describe what you want to achieve, and it will help you get there.

[​

](#essential-commands)

## Essential commands

Here are the most important commands for daily use:

| Command | What it does | Example |
| --- | --- | --- |
| `claude` | Start interactive mode | `claude` |
| `claude "task"` | Run a one-time task | `claude "fix the build error"` |
| `claude -p "query"` | Run one-off query, then exit | `claude -p "explain this function"` |
| `claude -c` | Continue most recent conversation | `claude -c` |
| `claude -r` | Resume a previous conversation | `claude -r` |
| `claude commit` | Create a Git commit | `claude commit` |
| `/clear` | Clear conversation history | `> /clear` |
| `/help` | Show available commands | `> /help` |
| `exit` or Ctrl+C | Exit Claude Code | `> exit` |

See the [CLI reference](cli-reference.md) for a complete list of commands.

[​

](#pro-tips-for-beginners)

## Pro tips for beginners

Be specific with your requests

Instead of: “fix the bug”Try: “fix the login bug where users see a blank screen after entering wrong credentials”

Use step-by-step instructions

Break complex tasks into steps:

Copy

Ask AI

```
> 1. create a new database table for user profiles
```

Copy

Ask AI

```
> 2. create an API endpoint to get and update user profiles
```

Copy

Ask AI

```
> 3. build a webpage that allows users to see and edit their information
```
Let Claude explore first

Before making changes, let Claude understand your code:

Copy

Ask AI

```
> analyze the database schema
```

Copy

Ask AI

```
> build a dashboard showing products that are most frequently returned by our UK customers
```

Save time with shortcuts

- Press `?` to see all available keyboard shortcuts
- Use Tab for command completion
- Press ↑ for command history
- Type `/` to see all slash commands

[​

](#what’s-next)

## What’s next?

Now that you’ve learned the basics, explore more advanced features:

[

## Common workflows

Step-by-step guides for common tasks

](common-workflows.md)[

## CLI reference

Master all commands and options

](cli-reference.md)[

## Configuration

Customize Claude Code for your workflow

](settings.md)[

## Claude Code on the web

Run tasks asynchronously in the cloud

](claude-code-on-the-web.md)

[​

](#getting-help)

## Getting help

- **In Claude Code**: Type `/help` or ask “how do I…”
- **Documentation**: You’re here! Browse other guides
- **Community**: Join our [Discord](https://www.anthropic.com/discord) for tips and support

[Overview](overview.md)[Common workflows](common-workflows.md)

⌘I