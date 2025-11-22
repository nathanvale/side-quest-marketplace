# SuperWhisper Advanced Workflows

**What power users are building beyond basic dictation.**

## Core Patterns

### 1. Context Stacking

Combine multiple context sources for intelligent processing:

- **Selected text** (what you highlighted)
- **Clipboard** (what you copied)
- **Active app** (where you are)
- **Voice input** (what you said)

**Example**: Select email thread → Voice: "Draft professional response" → AI uses thread context +
app tone

### 2. Voice as Workflow Trigger

Voice commands that initiate multi-step automations:

- Fetch web data
- Process with AI
- Format for destination app
- Auto-paste result

**Example**: "Research LangGraph updates" → Searches web → Summarizes → Creates Obsidian note

### 3. Mode Automation

Auto-switch modes based on context:

- App-specific modes (VS Code = coding, Mail = email)
- Time-based modes (work hours = formal, evening = casual)
- Keyboard layer triggers (F+G = quick note)

### 4. Smart Reprocessing

Take one recording, process multiple ways:

- Original transcription
- Formatted for email
- Summarized for notes
- Extracted action items

## Real-World Integrations

### Coding Workflows

**Pattern**: Voice-driven code editing

- Select function → Voice: "Add JSDoc with examples"
- Dictate: "Define function create_username..." → Full implementation
- Auto-activate coding mode when IDE is active

**Key**: Custom modes with technical vocabulary, code formatting instructions

### Research & Note-Taking

**Pattern**: Voice-triggered web research

- Voice: "Research topic X" → Searches → Summarizes → Saves to Obsidian
- "Smart bookmark" current page → Scrapes → AI digest → Tagged note
- Meeting prep automation (company lookup → briefing)

**Key**: External API calls, structured note formatting

### Communication

**Pattern**: Context-aware responses

- Select message → Voice reply → AI matches tone to app
- Email vs Slack detection → Adjusts formality
- Thread context for relevant responses

**Key**: Active app detection, clipboard context

### Automation Hubs

**Pattern**: SuperWhisper as command center

- Voice commands trigger Keyboard Maestro macros
- Alfred workflows for instant mode switching
- Custom hotkeys for frequent modes (6+ custom hotkeys common)
- External triggers: `superwhisper://mode?key=X&record=true`

**Key**: Deep links, external trigger integration

## Technical Capabilities

### Deep Links

```bash
# Switch mode and start recording
superwhisper://mode?key=custom-email&record=true

# Just switch mode
superwhisper://mode?key=meeting-notes

# Start recording (current mode)
superwhisper://record
```

### Custom Mode Features

- **XML-structured prompts** for complex AI instructions
- **Example-based training** (input/output pairs)
- **Multi-context modes** (clipboard + selection + app)
- **Context naming conventions**:
  - `User Message` = your dictation
  - `Application Context` = active app data
  - `Selected Text` = highlighted text
  - `Clipboard Context` = copied content

### Advanced Automations

**Common tools used**:

- Alfred workflows (most popular)
- Keyboard Maestro macros
- Raycast extensions
- Karabiner-Elements (keyboard remapping)
- Hammerspoon (window automation)

**Automation patterns**:

- Auto-copy selected text before recording
- Filter recording history by date/app
- Reprocess old recordings with new modes
- Mode indicators in menu bar
- Keyboard layers for voice commands

## Power User Tips

### Mode Organization

- **Favorite modes**: Quick access via hotkeys
- **App-specific modes**: Auto-activate per application
- **Context-aware modes**: Different processing based on context
- **Action modes**: Trigger workflows, not just formatting

### Context Strategy

- Enable clipboard context for reference material
- Use selected text for quote responses
- Combine app context for intelligent defaults
- Stack multiple contexts for rich processing

### Keyboard Optimization

- Map recording to ergonomic keys (F+G combo)
- Create keyboard layer for mode switching
- Use modifier + tap to cycle modes
- Separate hotkeys for top 6 modes

### Integration Patterns

- Use deep links in automation tools
- External triggers for complex workflows
- Menu bar integrations for status
- File-based mode sharing across machines

## Advanced Use Cases

### Voice-Driven Development

- Hands-free coding sessions
- Code documentation via voice
- Accessibility for RSI/carpal tunnel
- Pair programming dictation

### Knowledge Management

- Voice-to-Obsidian with auto-linking
- Smart bookmarking with AI digest
- Meeting notes with auto-formatting
- Research compilation workflows

### Professional Communication

- Context-aware email drafting
- Slack message formatting
- Meeting preparation automation
- Follow-up message generation

### Productivity Automation

- Voice commands as workflow triggers
- App-switching mode automation
- Time-based mode selection
- Multi-step processing pipelines

## Integration Inspiration

### Alfred-SuperWhisper Workflow

Advanced mode control via Alfred:

- Fuzzy search modes
- Custom hotkeys (6+ configurable)
- History filtering by date/result/voice
- Reprocess recordings with different modes
- Auto-copy selected text for context

### Macrowhisper

Voice automation helper:

- Menu bar mode indicators
- Action modes (not just transcription)
- Web search integration
- Custom automation triggers

### Cursor AI Integration

Voice-driven coding:

- Auto-activate on IDE focus
- Iterative code refinement by voice
- Context-aware code generation
- Technical vocabulary handling

## Reference Architecture

```
Voice Input
    ↓
Context Gathering (selected text, clipboard, active app)
    ↓
Mode Selection (auto or manual)
    ↓
AI Processing (custom instructions + context)
    ↓
Optional: External API calls (web search, data lookup)
    ↓
Format for Destination
    ↓
Output (paste, clipboard, file)
```

This enables workflows like:

1. Speak → Research web → Format note → Save
2. Select → Dictate → Match tone → Paste reply
3. Trigger → Fetch data → Process → Create document
4. Voice command → Multi-step automation → Result

---

**For inspiration and examples, see `@inspiration.md`**
