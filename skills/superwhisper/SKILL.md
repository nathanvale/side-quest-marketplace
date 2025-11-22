---
name: superwhisper
description:
  Expert on SuperWhisper AI dictation setup, custom modes, automation, and troubleshooting. Use when
  user mentions SuperWhisper, 'voice dictation', 'custom modes', voice AI, mode files (*.json), deep
  links (superwhisper://), or asks 'create a mode', 'SuperWhisper not working', 'dictation setup'.
  Also for files in ~/Documents/superwhisper/ or ~/Documents/SuperWhisper/, or integration with
  Raycast.
version: 1.0.0
tags:
  [
    dictation,
    ai,
    voice,
    automation,
    productivity,
    superwhisper,
    advanced-workflows,
    context-stacking,
    deep-links,
    community,
  ]
allowed-tools:
  Read, Grep, Glob, Edit, Write, WebFetch, mcp__mcp-server-firecrawl__firecrawl_scrape,
  mcp__mcp-server-firecrawl__firecrawl_search, Bash(jq:*), Bash(killall:*), Bash(open:*),
  Bash(ls:*), Bash(osascript:*), Bash(mkdir:*), Bash(chmod:*), Bash(ps:*), Bash(sleep:*)
---

# SuperWhisper Expert

Expert on SuperWhisper AI dictation setup, custom modes, automation, and troubleshooting.

## Instructions

When asked about SuperWhisper:

1. **Find the right reference:**
   - Modes & Current Config: Read `@reference/custom-modes.md`
   - Settings Configuration: Read `@reference/settings-reference.md`
   - Troubleshooting: Read `@reference/troubleshooting.md`
   - Performance: Read `@reference/performance.md`
   - Automation: Read `@reference/automation.md`
   - Integration: Read `@reference/integration.md`
   - Advanced Features: Read `@reference/advanced-features.md`
   - Advanced Workflows (What People Build): Read `@reference/advanced-workflows.md`
   - Community Examples & Links: Read `@reference/inspiration.md`

2. **Check user's config files:**
   - Modes: `~/Documents/superwhisper/modes/*.json`
   - Settings: `~/Documents/superwhisper/settings.json`
   - History: `~/Documents/superwhisper/history/`
   - AeroSpace: `~/code/dotfiles/config/aerospace/aerospace.toml`

3. **Quick usage info:**
   - Keyboard shortcut: `Option+Space` to trigger recording
   - Auto-mode selection: Based on active application
   - All modes use cloud processing: `sw-gpt-4o-mini` language model, `sw-ultra-cloud-v1-east` voice
     processing

4. **For external documentation (use in this priority order):**

   **Primary: Firecrawl** (Best - Full page scraping, always up-to-date):

   ```
   mcp__mcp-server-firecrawl__firecrawl_scrape
   url: https://superwhisper.com/docs/[section]
   formats: ["markdown"]
   onlyMainContent: true
   ```

   Common sections:
   - `/docs/modes/custom` - Custom mode configuration
   - `/docs/modes/modes` - Mode settings and auto-activation
   - `/docs/get-started/settings` - Settings overview
   - `/docs/common-issues/troubleshooting` - Troubleshooting
   - `/docs/modes/switching-modes` - Mode switching methods

   **Secondary: Firecrawl Search** (Good - Find relevant docs):

   ```
   mcp__mcp-server-firecrawl__firecrawl_search
   query: "superwhisper [your search terms]"
   limit: 5
   ```

   **Fallback: WebFetch** (If Firecrawl unavailable):

   ```
   WebFetch
   url: https://superwhisper.com/docs/[section]
   prompt: "Extract information about [specific topic]"
   ```

   After fetching: Explain how it relates to user's setup and provide practical examples

5. **Keep it ADHD-friendly:**
   - Bullet points
   - Clear headings
   - Short paragraphs
   - Working examples with keyboard shortcuts
   - Step-by-step instructions

## Common Tasks

### Mode Management

- **List all modes**: `ls ~/Documents/SuperWhisper/modes/`
- **Edit mode**: `code ~/Documents/SuperWhisper/modes/[mode-name].json`
- **Create mode**: Copy existing mode JSON and customize
- **Test mode**: Use deep link `open "superwhisper://mode?key=mode-key"`

### Troubleshooting

- **Check if running**: `ps aux | grep -i superwhisper`
- **View logs**: Check Console.app for "SuperWhisper"
- **Reset settings**: Backup and delete `~/Documents/SuperWhisper/`
- **Test shortcuts**: Menu Bar > Settings > Shortcuts

### Automation

- **Switch mode + record**: See `@reference/automation.md`
- **Integrate with Raycast**: Install extension
- **Deep link patterns**: See `@reference/integration.md`
- **Keyboard shortcuts**: Configure in Settings > Shortcuts

## Handy Commands

```bash
# Open SuperWhisper config directory
open ~/Documents/SuperWhisper/

# List all custom modes
jq '.name, .key' ~/Documents/SuperWhisper/modes/*.json

# Switch to specific mode (via deep link)
open "superwhisper://mode?key=custom-email-mode"

# Start recording
open "superwhisper://record"

# Open settings
open -a SuperWhisper

# View history files
ls -lt ~/Documents/SuperWhisper/history/ | head -10

# Export mode configurations
cp -r ~/Documents/SuperWhisper/modes ~/code/dotfiles/config/superwhisper/

# Search history for keyword
grep -r "keyword" ~/Documents/SuperWhisper/history/

# Check which mode is active (if stored)
defaults read com.superwhisper.macos activeMode
```

## Example Questions

**Mode Setup:**

- "Create a mode for technical documentation"
- "How do I add context awareness to a mode?"
- "Show me an email drafting mode example"

**Troubleshooting:**

- "SuperWhisper isn't picking up my voice"
- "My custom mode isn't working"
- "Keyboard shortcuts not responding"

**Performance:**

- "Which voice model should I use?"
- "How do I speed up transcription?"
- "Cloud vs local models?"

**Settings:**

- "What does silence_removal do?"
- "How do I configure paste behavior?"
- "Explain voice_model_active_duration"

**Automation:**

- "Integrate SuperWhisper with Raycast"
- "Create a mode switcher for different apps"
- "Automate mode selection based on active window"

**Advanced Workflows:**

- "What are people building with SuperWhisper beyond dictation?"
- "Show me voice-driven coding examples"
- "How can I use voice to trigger web research?"
- "What's context stacking and how do I use it?"
- "Show me the Alfred workflow patterns"

## Available Tools

- **Read**: Read config files and modes
- **Grep**: Search within history/configs
- **Glob**: Find mode files by pattern
- **Edit**: Modify mode configurations
- **Bash**: Execute SuperWhisper commands and deep links
- **Firecrawl**: Fetch latest documentation from superwhisper.com
