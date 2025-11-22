# SuperWhisper Custom Modes

**⚠️ Important Note**: SuperWhisper's JSON configuration format is **not officially documented**.
The JSON structure and field names in this guide are based on reverse-engineering actual working
mode files. The official SuperWhisper docs focus on UI-based configuration. Always test changes and
keep backups.

## What Are Modes?

Modes are **customizable AI personalities** for different tasks. Each mode has:

- **Name**: How it appears in menu
- **Key**: Unique identifier for deep links
- **Voice Model**: "pro" (accurate) or "fast" (quick)
- **AI Model**: Which LLM to use (e.g., "gpt-4", "claude-3-5-sonnet")
- **AI Instructions**: How AI should process and format the transcription
- **Context Options**: What info AI can access (clipboard, selection, active app)
- **Output**: Where transcription goes (paste, clipboard, notification)

## Your Current Mode Configuration

### Auto-Activated Modes

- **Tech Notes** (`tech-notes.json`) - Terminal apps (Ghostty, iTerm2, Terminal, Alacritty)
  - Formats as technical notes with bullet points and code snippets
- **Code Comments** (`code-comments.json`) - Code editors (VS Code, Code, Cursor, Zed)
  - Formats as code comments or documentation
- **Obsidian Quick** (`obsidian-quick.json`) - Obsidian note-taking
  - Formats for Obsidian with markdown formatting
- **Slack Message** (`slack-message.json`) - Slack app
  - Professional but friendly Slack messages
- **Email** (`email.json`) - Mail app
  - Professional email formatting with proper greeting and closing
- **Text - Casual** (`text-casual.json`) - Messages app
  - Casual, friendly text messages

### Manual Modes

- **Text - Melanie** (`text-melanie.json`) - Personal messages for Melanie
- **Text - Mum** (`text-mum.json`) - Personal messages for Mum
- **Default** (`default.json`) - Pure transcription fallback (no AI formatting)

### Activation Matrix

| Mode           | Apps                                 | Auto-Activate |
| -------------- | ------------------------------------ | ------------- |
| Tech Notes     | Ghostty, iTerm2, Terminal, Alacritty | ✅            |
| Code Comments  | VS Code, Code, Cursor, Zed           | ✅            |
| Obsidian Quick | Obsidian                             | ✅            |
| Slack Message  | Slack                                | ✅            |
| Email          | Mail                                 | ✅            |
| Text - Casual  | Messages                             | ✅            |
| Text - Melanie | (none)                               | ❌ Manual     |
| Text - Mum     | (none)                               | ❌ Manual     |
| Default        | (fallback)                           | ✅            |

## Creating Custom Modes

### Location

`~/Documents/superwhisper/modes/` (note: **lowercase** "superwhisper")

### Important: Making Modes Appear in SuperWhisper

After creating or modifying mode JSON files, restart SuperWhisper:

```bash
# Hard restart SuperWhisper
killall -9 superwhisper
sleep 2
open -a SuperWhisper
sleep 3

# Your new modes should now appear in the Modes menu
```

**Note**: A hard restart is usually sufficient. Only clear the cache/preferences if modes genuinely
don't appear after restart, as it's destructive and nukes all your other SuperWhisper settings.

### Mode JSON Structure

```json
{
  "activationApps": ["Xcode", "Visual Studio Code", "Code"],
  "activationSites": [],
  "contextFromApplication": true,
  "contextFromClipboard": true,
  "contextFromSelection": false,
  "diarize": false,
  "key": "tech-docs",
  "language": "en",
  "languageModelEnabled": true,
  "languageModelID": "sw-gpt-4o-mini",
  "name": "Technical Documentation",
  "prompt": "Format as technical documentation with clear headings, bullet points, and code blocks where appropriate. Use markdown syntax.",
  "promptExamples": [
    {
      "input": "explain the function that calculates fibonacci numbers",
      "output": "## Fibonacci Function\n\nThis function calculates Fibonacci numbers using:\n- Recursive approach\n- Base cases for 0 and 1\n- Memoization for optimization"
    }
  ],
  "type": "custom",
  "useSystemAudio": false,
  "version": 1,
  "voiceModelID": "sw-ultra-cloud-v1-east"
}
```

### Field Descriptions

**Required Fields**:

- `name`: Display name in SuperWhisper menu
- `key`: Unique identifier for deep links (lowercase, hyphens)
- `type`: Mode type - typically `"custom"` for custom modes
- `version`: Version number - typically `1`
- `language`: Language code (e.g., `"en"` for English)

**Voice Processing**:

- `voiceModelID`: Voice model to use (e.g., `"sw-ultra-cloud-v1-east"`, `"sw-pro-cloud-v1-east"`)

**AI Processing**:

- `languageModelEnabled`: Boolean - whether to use AI processing
- `languageModelID`: LLM to use - `"sw-gpt-4o-mini"`, `"sw-gpt-4o"`, `"sw-claude-3-5-sonnet"`, etc.
- `prompt`: Instructions that tell AI how to format/process the transcription

**Context Fields** (what AI can see):

- `contextFromClipboard`: Boolean - include clipboard content in AI context
- `contextFromApplication`: Boolean - include active application info
- `contextFromSelection`: Boolean - include selected text from active app
- `contextTemplate`: String template for context formatting

**Optional Fields**:

- `promptExamples`: Array of `{"input": "...", "output": "..."}` pairs to train AI behavior
- `activationApps`: Array of **application names** for automatic mode switching (e.g.,
  `["Messages", "Slack"]`)
- `activationSites`: Array of website URLs for automatic mode switching
- `useSystemAudio`: Boolean - record from system audio
- `diarize`: Boolean - enable speaker identification
- `description`: String description of the mode
- `iconName`: String - custom icon name
- `pauseMediaPlayback`: Boolean - pause media while recording
- `adjustOutputVolume`: Boolean - adjust output volume during recording
- `literalPunctuation`: Boolean - include spoken punctuation literally
- `translateToEnglish`: Boolean - translate to English after transcription
- `realtimeOutput`: Boolean - show output in real-time
- `script`: String - custom script to run
- `scriptEnabled`: Boolean - whether to run custom script

### Auto-Activation

SuperWhisper can automatically switch to a mode when specific applications or websites are active.

**Application Auto-Activation**:

```json
{
  "activationApps": ["Mail", "Outlook", "Messages"]
}
```

- Use **application names** (as they appear in the menu bar/Dock), NOT bundle IDs
- Common examples:
  - `"Messages"` - Messages app
  - `"Mail"` - Mail app
  - `"Slack"` - Slack app
  - `"Visual Studio Code"` or `"Code"` - VS Code
  - `"Ghostty"`, `"iTerm2"`, `"Terminal"` - Terminal apps
  - `"Obsidian"` - Obsidian notes
  - `"Safari"`, `"Chrome"`, `"Firefox"` - Browsers

**Website Auto-Activation**:

```json
{
  "activationSites": ["*.gmail.com", "mail.google.com"]
}
```

- Array of URL patterns (wildcards supported)
- Empty array `[]` if not using website activation

**Audio Recording Options**:

```json
{
  "diarize": false,
  "pauseMediaPlayback": true,
  "useSystemAudio": false
}
```

- `useSystemAudio`: Capture computer audio along with microphone
- `diarize`: Enable speaker identification (who said what)
- `pauseMediaPlayback`: Pause media playback while recording

### Common Mode Templates

**Meeting Notes Mode**:

```json
{
  "activationApps": ["Zoom", "Microsoft Teams", "Google Meet"],
  "activationSites": [],
  "contextFromApplication": true,
  "contextFromClipboard": true,
  "contextFromSelection": false,
  "contextTemplate": "",
  "diarize": true,
  "key": "meeting-notes",
  "language": "en",
  "languageModelEnabled": true,
  "languageModelID": "sw-gpt-4o",
  "name": "Meeting Notes",
  "prompt": "Format as meeting notes with sections: Attendees, Key Points, Action Items, Next Steps. Use bullet points.",
  "promptExamples": [
    {
      "input": "We discussed the Q4 roadmap. John will handle the backend API. Sarah takes frontend. Launch target is December 15th.",
      "output": "## Meeting Notes\n\n### Key Points\n- Q4 roadmap discussion\n- Launch target: December 15th\n\n### Action Items\n- [ ] John: Backend API development\n- [ ] Sarah: Frontend implementation"
    }
  ],
  "type": "custom",
  "useSystemAudio": false,
  "version": 1,
  "voiceModelID": "sw-ultra-cloud-v1-east"
}
```

**Obsidian Mode** (ADHD-friendly):

```json
{
  "activationApps": ["Obsidian"],
  "activationSites": [],
  "contextFromApplication": false,
  "contextFromClipboard": true,
  "contextFromSelection": false,
  "contextTemplate": "",
  "diarize": false,
  "key": "obsidian-quick",
  "language": "en",
  "languageModelEnabled": true,
  "languageModelID": "sw-gpt-4o-mini",
  "name": "Obsidian Quick Capture",
  "prompt": "Format for Obsidian: Use ## for headings, [[wikilinks]] for connections, #tags for topics. Keep paragraphs short (2-3 sentences max).",
  "promptExamples": [
    {
      "input": "I need to remember to research react server components and how they relate to next.js",
      "output": "## Quick Note\n\nResearch [[React Server Components]] and their integration with [[Next.js]].\n\n#react #nextjs #todo"
    }
  ],
  "type": "custom",
  "useSystemAudio": false,
  "version": 1,
  "voiceModelID": "sw-pro-cloud-v1-east"
}
```

**Code Review Mode**:

````json
{
  "activationApps": ["Visual Studio Code", "Code", "Cursor", "Zed"],
  "activationSites": [],
  "contextFromApplication": true,
  "contextFromClipboard": true,
  "contextFromSelection": true,
  "contextTemplate": "",
  "diarize": false,
  "key": "code-review",
  "language": "en",
  "languageModelEnabled": true,
  "languageModelID": "sw-claude-3-5-sonnet",
  "name": "Code Review",
  "prompt": "Format as code review comments. Start with summary, then specific issues with line references. Use markdown code blocks. Be constructive and specific.",
  "promptExamples": [
    {
      "input": "This function has a memory leak because it doesn't clean up the event listener",
      "output": "## Code Review\n\n**Summary**: Memory leak detected - event listener cleanup missing\n\n**Issue**: The function registers an event listener but never removes it, causing a memory leak when the component unmounts.\n\n**Suggestion**:\n```javascript\nuseEffect(() => {\n  return () => element.removeEventListener('click', handler);\n}, []);\n```"
    }
  ],
  "type": "custom",
  "useSystemAudio": false,
  "version": 1,
  "voiceModelID": "sw-ultra-cloud-v1-east"
}
````

**Text - Melanie Mode** (Personal):

```json
{
  "activationApps": [],
  "activationSites": [],
  "contextFromApplication": false,
  "contextFromClipboard": false,
  "contextFromSelection": false,
  "contextTemplate": "",
  "diarize": false,
  "key": "text-melanie",
  "language": "en",
  "languageModelEnabled": true,
  "languageModelID": "sw-gpt-4o-mini",
  "name": "Text - Melanie",
  "prompt": "Format as a warm, affectionate text message to my partner Melanie. Use casual language, contractions, and emojis where appropriate. Keep it conversational and loving.",
  "promptExamples": [
    {
      "input": "let her know I will be home around six and ask if she needs anything from the store",
      "output": "Hey love! I'll be home around 6. Need me to grab anything from the store on the way? ❤️"
    }
  ],
  "type": "custom",
  "useSystemAudio": false,
  "version": 1,
  "voiceModelID": "sw-ultra-cloud-v1-east"
}
```

**Text - Mum Mode** (Personal):

```json
{
  "activationApps": [],
  "activationSites": [],
  "contextFromApplication": false,
  "contextFromClipboard": false,
  "contextFromSelection": false,
  "contextTemplate": "",
  "diarize": false,
  "key": "text-mum",
  "language": "en",
  "languageModelEnabled": true,
  "languageModelID": "sw-gpt-4o-mini",
  "name": "Text - Mum",
  "prompt": "Format as a friendly, warm text message to my mum. Use proper punctuation and complete sentences. Be affectionate but not overly casual.",
  "promptExamples": [
    {
      "input": "tell her I will call her tomorrow afternoon and hope she is feeling better",
      "output": "Hi Mum! I'll give you a call tomorrow afternoon. Hope you're feeling better! Love you xx"
    }
  ],
  "type": "custom",
  "useSystemAudio": false,
  "version": 1,
  "voiceModelID": "sw-ultra-cloud-v1-east"
}
```

## Mode Switching

### Via Menu Bar

Click SuperWhisper icon → Select mode

### Via Deep Link

```bash
# Switch to specific mode
open "superwhisper://mode?key=tech-docs"

# Switch and start recording
open "superwhisper://mode?key=meeting-notes&record=true"
```

### Via Keyboard (if configured)

SuperWhisper supports global hotkeys - configure in Settings → Keyboard Shortcuts

## Context Awareness

**Clipboard Context** (`contextFromClipboard: true`):

- AI can see what's on clipboard
- Use for: Follow-up questions, expanding on copied text
- Example: Copy code snippet, dictate "Explain this code"

**Selection Context** (`contextFromSelection: true`):

- AI can see selected text in active app
- Use for: Editing, expanding, reformatting existing text
- Example: Select paragraph, dictate "Make this more concise"

**Application Context** (`contextFromApplication: true`):

- AI knows which app is active (app name, window title)
- Use for: App-specific formatting (Slack vs Email vs Obsidian)
- Example: Auto-format for email in Mail.app

## Tips

**ADHD-Friendly Mode Design**:

- Keep instructions clear and specific
- Use consistent formatting (headings, bullets)
- Limit paragraph length (2-3 sentences)
- Include visual markers (emojis, tags)
- Use `"fast"` voice model for lower latency
- Add examples to train consistent output

**Mode Organization**:

- Prefix related modes: `obsidian-quick`, `obsidian-daily`
- Use descriptive keys for deep links
- Group by workflow in modes directory
- Use auto-activation rules to reduce manual switching

**Testing Modes**:

```bash
# Test mode with deep link
open "superwhisper://mode?key=your-mode&record=true"

# Check active mode (if stored)
defaults read com.superwhisper.macos activeMode
```

**Example Training**:

- Add 2-3 examples showing desired input → output
- Use realistic examples from your actual workflow
- Examples help AI understand formatting preferences
- Update examples when output isn't matching expectations

## Example Workflows

**Quick Obsidian Capture**:

1. Open Obsidian (auto-activates obsidian-quick mode)
2. Trigger recording shortcut
3. Speak note content
4. Auto-pastes formatted markdown with wikilinks and tags

**Email Drafting**:

1. Open Mail.app (auto-activates email mode)
2. Trigger recording
3. Dictate email content
4. AI formats professionally with greeting/closing
5. Paste into compose window

**Code Documentation**:

1. Copy function code
2. Switch to code-docs mode (or auto-activates in VS Code)
3. Dictate "Document this function"
4. AI uses clipboard context to generate docs
5. Paste above function

**Meeting Recording with Speaker Tracking**:

1. Switch to meeting-notes mode
2. Enable speaker identification in audio_options
3. Record meeting
4. Get transcript with speaker labels and formatted action items
