# SuperWhisper Integration Inspiration

**Real-world examples and references from the community.**

## Featured Community Projects

### 🏆 Alfred-SuperWhisper Workflow

**Most Popular Integration** (112 GitHub stars)

**Repository**: https://github.com/ognistik/alfred-superwhisper

**What it does**:

- Control SuperWhisper entirely from Alfred
- Switch modes with fuzzy search
- Set up 6+ custom hotkeys for instant mode+record
- Filter recording history by date, result, or voice
- Reprocess old recordings with different modes
- View parsed JSON history in Alfred's text view
- Copy mode deep links for automation
- Auto-copy selected text before recording

**Power user features**:

- External trigger support for complex automations
- Keyboard shortcuts color-coded by function
- Integration with copySelect CLI tool
- Snippet expansion for last result/voice/both

**Video overview**: https://youtu.be/mUcijTpWYAQ

**Why it matters**: Shows how to build comprehensive control layer on top of SuperWhisper

---

### 💻 Voice-Driven Coding (Cursor AI)

**Hands-Free Development**

**Tutorial**:
https://rolloutit.net/code-without-typing-integration-between-cursor-ai-and-superwhisper/

**What it demonstrates**:

- Creating custom "Python Coding" mode
- Auto-activation when Cursor is focused
- Voice commands for code generation: "Write code to input a CSV file"
- Iterative refinement: "Ensure names are lowercase"
- Complex function dictation: "Define a function named get_state_code that extracts..."

**Real workflow example**:

```
1. Open Cursor AI
2. Custom mode auto-activates
3. Speak: "Write code to input a CSV file"
4. AI generates pandas implementation
5. Speak: "Load customers.csv and print name and email"
6. Code updates with iteration logic
7. Speak: "Add function to generate usernames"
8. Function added with proper format
```

**Key insight**: Voice works for structured technical content with proper mode configuration

**Use cases**:

- Accessibility for developers with physical limitations
- Reducing RSI from excessive typing
- Pair programming dictation
- Focus during coding sessions

---

### 🎬 Video Tutorials

#### "The True Value of Superwhisper: Unlimited AI & Powerful Possibilities"

**URL**: https://www.youtube.com/watch?v=V5a4pmNLEKE

**Covers**:

- Going beyond basic dictation
- Understanding JSON mode files
- Practical workflow tips
- Alfred workflow integration
- Custom mode creation

---

#### "Pro AI Dictation Tips: Mastering Context Awareness"

**URL**: https://www.youtube.com/watch?v=py3szwKAZYU

**Topics**:

- Context awareness deep dive
- Selected text vs clipboard
- Application context usage
- Prompting tips for custom modes

**Resources mentioned**:

- Workflow: https://github.com/ognistik/alfred-superwhisper
- Reprocessing script: https://pastebin.com/DAkbTHgC
- Prompting tips guide

---

#### "Voice Automation with Context: ChatGPT, Superwhisper, & Alter"

**URL**: https://www.youtube.com/watch?v=283-z29TXeM

**Demonstrates**:

- Macrowhisper context features
- Routing dictation based on context
- Advanced automation patterns

---

#### "Macrowhisper: Voice Automation for Superwhisper"

**URL**: https://www.youtube.com/watch?v=R4yQoMnEjOk

**About Macrowhisper**:

- Voice automation helper tool
- Menu bar mode indicators
- Action modes
- Custom automation integration

**Get Macrowhisper**: https://by.afadingthought.com/macrowhisper

---

#### "Automate Superwhisper Dictation with Keyboard Maestro"

**URL**: https://www.youtube.com/watch?v=AFzWd_MAa4o

**Shows**:

- Keyboard Maestro macro collection
- Automating mode switching
- Custom workflow triggers

---

## Official Documentation

### Custom Mode Deep Dive

**URL**: https://superwhisper.com/docs/modes/custom

**Key concepts**:

- AI instruction customization
- Context awareness (app, clipboard, selected text)
- XML-structured prompts for complex instructions
- Example-based AI training

**Context naming conventions**:

- `User Message` - Your dictated text
- `Application Context` - Active app data
- `Selected Text` - Highlighted text
- `Clipboard Context` - Copied content

---

### Mode Switching Methods

**URL**: https://superwhisper.com/docs/modes/switching-modes

**Four ways to switch**:

1. Keyboard shortcut (cycle through modes)
2. Menu bar selection
3. Auto-activation rules (per app/website)
4. Deep links for automation

**Deep link patterns**:

```bash
# Switch mode
superwhisper://mode?key=YOUR_MODE_KEY

# Start recording
superwhisper://record

# Combine in automation
superwhisper://mode?key=email-mode&record=true
```

**Sample shortcut**: https://www.icloud.com/shortcuts/a925e259d5e84806a700c2a58d4853a4

---

### Settings & Shortcuts

**URL**: https://superwhisper.com/docs/get-started/settings

**Deep links reference**:

- Quick access to features
- Automation integration
- Workflow enhancement

---

### Customizing Built-In Modes

**URL**: https://superwhisper.com/docs/modes/customizing-modes

**Learn**:

- Accessing AI instructions
- Making adjustments to existing modes
- Creating customized versions

---

## Third-Party Integrations

### Raycast Extension

**URL**: https://www.raycast.com/nchudleigh/superwhisper

**Features**:

- Quick mode switching
- Recording triggers
- Mode management

---

### Alfred Workflow (Detailed)

**URL**: https://github.com/ognistik/alfred-superwhisper

**Documentation highlights**:

- Custom hotkey setup
- External trigger usage
- copySelect CLI integration
- History filtering patterns
- JSON file management

**Advanced patterns**:

```
# External trigger: sw
Arguments:
- openModeRecord,deepLink
- openMode,deepLink,modeName
- activateSuperM
- selectMode
- selectHistoryResult
- copyLast
- processLast
```

---

## Community Discussions

### Reddit: Voice Automation Helper

**URL**: https://www.reddit.com/r/macapps/comments/1lsct7i/voice_automation_helper_for_superwhisper/

**Topics**:

- Macrowhisper announcement
- Real-time API integration
- Cost considerations

---

### Reddit: SuperWhisper vs BetterDictation

**URL**:
https://www.reddit.com/r/ProductivityApps/comments/18oatu3/whats_better_superwhisper_or_betterdictation/

**Insights**:

- AI-powered writing styles
- Different modes for different occasions
- Productivity comparisons

---

## Blog Posts & Articles

### "Choosing the Right AI Dictation App for Mac"

**URL**: https://afadingthought.substack.com/p/best-ai-dictation-tools-for-mac

**Covers**:

- Data handling comparison
- Deep links implementation
- Alfred workflow creation
- Automation possibilities

---

### "How I use Superwhisper to send emails and messages"

**URL**:
https://www.linkedin.com/posts/sampcrockett_ever-wish-your-thoughts-could-just-become-activity-7333945242552881152-C5w_

**Real-world usage**:

- Email composition
- Slack messages
- Meeting notes
- Practical workflows

---

## Technical References

### Deep Links Documentation

**Official**: https://superwhisper.com/docs/modes/switching-modes#deep-links

**Patterns**:

```bash
# Mode switching
superwhisper://mode?key=MODE_KEY

# Recording
superwhisper://record

# Combined
superwhisper://mode?key=custom-email&record=true
```

**Finding mode keys**:

- Location: `~/Documents/superwhisper/modes/`
- Quick Look JSON files
- Check "key" field in JSON

---

### Mode Files Location

**Path**: `~/Documents/superwhisper/modes/*.json`

**Structure**:

```json
{
  "context": {
    "activeApp": true,
    "clipboard": true,
    "selection": true
  },
  "instructions": "AI processing instructions...",
  "key": "custom-mode-key",
  "name": "Custom Mode Name"
}
```

---

## Automation Tool Compatibility

### Keyboard Maestro

- Macro triggers for mode switching
- Integration with voice commands
- Workflow automation

### Karabiner-Elements

**URL**: https://karabiner-elements.pqrs.org/

**Uses**:

- Custom keyboard shortcuts
- Complex key combinations
- Key layer creation
- F+G for recording example

### Hammerspoon

**Use case**: Window automation + mode switching

- Auto-detect apps
- Trigger mode changes
- Meeting detection (Zoom/Teams)

### Alfred

**Most mature integration**

- Complete mode control
- History management
- External trigger support

### Raycast

**Official extension available**

- Quick mode access
- Simple integration

---

## Advanced Workflow Patterns

### 1. Context-Stacking Pattern

**Sources**: Alfred workflow, Custom mode docs

**Technique**:

- Combine clipboard + selected text + active app
- Rich context for AI processing
- Intelligent output formatting

**Example**: Email reply using thread context

---

### 2. Voice as Trigger Pattern

**Sources**: Macrowhisper, Keyboard Maestro videos

**Technique**:

- Voice commands launch workflows
- Multi-step automation
- External API calls

**Example**: "Research topic" → Web search → Summary → Note

---

### 3. Auto-Activation Pattern

**Sources**: Official docs, Video tutorials

**Technique**:

- Per-app mode switching
- Website-specific modes
- Time-based rules

**Example**: Cursor = coding mode, Mail = email mode

---

### 4. Reprocessing Pattern

**Sources**: Alfred workflow, Reprocessing script

**Technique**:

- Take one recording
- Apply multiple modes
- Generate different outputs

**Example**: Dictation → Email version + Note version + Summary

---

## Power User Keyboard Setups

### Common Patterns (from Alfred workflow docs)

- **F+G**: Start recording (ergonomic combo)
- **Keyboard layers**: Press 'A' for mode layer
  - A+E = Email mode
  - A+N = Note mode
  - A+M = Meeting mode
- **6+ custom hotkeys**: Top modes instantly accessible
- **Modifier cycling**: Hold modifier, tap to cycle modes

### Karabiner Integration

- No loss of common shortcuts
- Complex combinations without conflicts
- Press-and-hold for quick dictation
- Layer-based mode switching

---

## Real-World Use Cases

### Accessibility

**Source**: Cursor AI integration article

**Applications**:

- RSI/carpal tunnel relief
- Physical limitation accommodation
- Fatigue reduction
- Ergonomic workflow

---

### Knowledge Work

**Sources**: Video tutorials, Blog posts

**Applications**:

- Research compilation
- Note-taking
- Documentation
- Content creation

---

### Communication

**Sources**: LinkedIn post, Custom mode docs

**Applications**:

- Email drafting
- Slack messages
- Meeting notes
- Professional writing

---

### Development

**Sources**: Cursor AI tutorial, GitHub discussions

**Applications**:

- Code documentation
- Function generation
- Pair programming
- Hands-free coding

---

## Getting Started with Advanced Features

### Recommended Learning Path

1. **Start with built-in modes** (understand basics)
2. **Watch "True Value" video** (see possibilities)
3. **Create first custom mode** (official docs)
4. **Install Alfred workflow** (power user control)
5. **Explore context awareness** (Pro Tips video)
6. **Experiment with deep links** (automation)
7. **Build workflow patterns** (from inspiration)

### Essential Resources

**Must-read**:

- Custom mode documentation
- Mode switching guide
- Alfred workflow README

**Must-watch**:

- "True Value of Superwhisper" overview
- "Pro AI Dictation Tips" for context mastery

**Must-try**:

- Alfred workflow for instant productivity boost
- Custom mode with context awareness
- Deep link automation example

---

## Community & Support

### Official Channels

- **Discord**: https://discord.gg/gSmWdAkdwd (mentioned in videos)
- **Documentation**: https://superwhisper.com/docs

### Community Projects

- **Alfred Workflow**: GitHub issues and discussions
- **Macrowhisper**: https://by.afadingthought.com/macrowhisper
- **Video tutorials**: YouTube comments for Q&A

---

## Key Takeaways

From analyzing community usage:

1. **Most powerful**: Context stacking (clipboard + selection + app + voice)
2. **Most popular**: Alfred workflow (112 stars, active development)
3. **Most requested**: External API integration (web search, data lookup)
4. **Most ergonomic**: Custom keyboard layers with Karabiner
5. **Most versatile**: Deep links for automation
6. **Most underused**: Reprocessing old recordings with new modes

---

**Last Updated**: Based on 2025 community research using Firecrawl **Sources Checked**: GitHub,
YouTube, SuperWhisper docs, Reddit, LinkedIn, blogs
