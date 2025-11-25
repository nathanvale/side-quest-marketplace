---
description: Look up Claude Code documentation - ask questions or search by topic
allowed-tools: Read, Grep, Glob
argument-hint: [topic or question]
---

# Claude Code Documentation Lookup

Answer this question about Claude Code: $ARGUMENTS

## Instructions

1. **Find the right doc**: Use the topic-to-doc mapping below to identify which doc(s) to read

2. **Read the doc**: Read the relevant file(s) from the plugin's docs directory

3. **Answer concisely**: Provide a direct answer with:
   - The specific information requested
   - Code examples if applicable
   - The doc filename so the user can read more

## Doc Location

All docs are at: `${CLAUDE_PLUGIN_ROOT}/docs/`

Read the index first if unsure: `${CLAUDE_PLUGIN_ROOT}/docs/INDEX.md`

## Topic to Doc Mapping

| Topic | Doc File |
|-------|----------|
| Getting started | quickstart.md, overview.md |
| Hooks | hooks.md, hooks-guide.md |
| Plugins | plugins.md, plugins-reference.md |
| Skills | skills.md |
| Slash commands | slash-commands.md |
| MCP servers | mcp.md |
| Sub-agents | sub-agents.md |
| Settings/config | settings.md, cli-reference.md |
| Permissions | iam.md |
| Sandboxing | sandboxing.md |
| Memory/CLAUDE.md | memory.md |
| Costs/tokens | costs.md |
| Model selection | model-config.md |
| VS Code | vs-code.md |
| JetBrains | jetbrains.md |
| GitHub Actions | github-actions.md |
| GitLab CI/CD | gitlab-ci-cd.md |
| Headless/CI | headless.md |
| AWS Bedrock | amazon-bedrock.md |
| Google Vertex | google-vertex-ai.md |
| Azure/Foundry | microsoft-foundry.md |
| Security | security.md |
| Troubleshooting | troubleshooting.md |

## If No Arguments Provided

If the user runs `/claude-code-docs:help` with no arguments, read and display the index:
`${CLAUDE_PLUGIN_ROOT}/docs/INDEX.md`

## Response Style

- Be concise and direct
- Include code examples when helpful
- Always cite the doc filename
- If info isn't in docs, say so clearly
