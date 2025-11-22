# SuperWhisper Advanced Features

Advanced capabilities for power users: XML instructions, file transcription, speaker identification,
recording customization, context awareness, and more.

## XML-Based AI Instructions

**Why XML?** More powerful than plain text for complex AI instructions. Provides structure and
clarity for multi-step prompts.

### XML Structure

Use these tags in Custom Mode AI instructions:

```xml
<role>Define who the AI should be</role>
<instructions>What the AI should do</instructions>
<requirements>Mandatory rules and constraints</requirements>
<context>Background information and sources</context>
<style>Tone, voice, and writing preferences</style>
<output-format>Structure of the final output</output-format>
```

### Example 1: Professional Email Assistant

```xml
<role>You are a professional email assistant</role>

<instructions>
Transform the User Message into a professional email based on the context provided.
</instructions>

<requirements>
- Use formal but friendly tone
- Include proper greeting and closing
- Structure with clear paragraphs
- Maintain key information from dictation
</requirements>

<context>
- Email is for business communication
- Recipient context from Application Context
- Reference materials from Clipboard Context
</context>

<style>
- Professional yet approachable
- Clear and concise language
- Action-oriented when appropriate
</style>

<output-format>
Subject: [Extracted from content]

[Greeting]

[Body paragraphs]

[Closing]
[Signature]
</output-format>
```

### Example 2: Code Review Prompt

```xml
<role>You are a senior software engineer conducting code reviews</role>

<instructions>
Analyze the User Message and any code from Selection Context or Clipboard Context.
Provide constructive feedback on code quality, potential bugs, and improvements.
</instructions>

<requirements>
- Focus on actionable feedback
- Reference specific line numbers when possible
- Categorize issues by severity (critical, important, minor)
- Suggest concrete improvements
</requirements>

<context>
- Code language from Application Context
- Selected code from Selection Context
- Additional context from Clipboard Context
</context>

<style>
- Constructive and encouraging
- Technical but clear
- Use code blocks for examples
</style>

<output-format>
## Summary
[Overall assessment]

## Critical Issues
- [Issue with line reference]

## Improvements
- [Suggestion with example]

## Minor Notes
- [Optional enhancements]
</output-format>
```

### Example 3: Meeting Notes Formatter

```xml
<role>You are an executive assistant specializing in meeting documentation</role>

<instructions>
Transform the User Message into structured meeting notes with clear sections
for attendees, key discussion points, decisions, and action items.
</instructions>

<requirements>
- Extract all action items with owners
- Highlight decisions made
- Keep notes concise but complete
- Use bullet points for easy scanning
</requirements>

<context>
- Meeting context from Application Context
- Agenda items from Clipboard Context (if available)
</context>

<style>
- Professional and neutral tone
- Clear, scannable formatting
- Action-oriented language
</style>

<output-format>
# Meeting Notes: [Topic]
Date: [Date]

## Attendees
- [Names]

## Key Discussion Points
- [Topic 1]
- [Topic 2]

## Decisions Made
- [Decision 1]
- [Decision 2]

## Action Items
- [ ] [Action] - Owner: [Name] - Due: [Date]
- [ ] [Action] - Owner: [Name] - Due: [Date]

## Next Steps
- [Next meeting date/follow-up]
</output-format>
```

### Referencing Context in XML

In your instructions, reference these content types:

- **User Message**: The dictated transcription
- **Application Context**: Active window data (captured after transcription)
- **Clipboard Context**: Copied text (captured 3 seconds before/during recording)
- **Text Selection Context**: Highlighted text (captured when recording starts)

**Example with conditional logic:**

```xml
<instructions>
If Application Context shows a code editor:
- Format the User Message as code comments
- Use coding style from Clipboard Context as reference

If Application Context shows an email client:
- Format as professional email
- Reference previous email from Selection Context
</instructions>
```

## File Transcription

Transcribe audio/video files using SuperWhisper's voice engine.

### How to Transcribe Files

**Method 1: Menu Bar**

1. Click SuperWhisper menu bar icon
2. Select "Transcribe File"
3. Choose your audio/video file

**Method 2: Finder Context Menu**

1. Right-click audio/video file
2. Select "Open With" → "SuperWhisper"

**Method 3: Command Line**

```bash
# Basic transcription
open /path/to/recording.mp3 -a superwhisper

# Meeting recording
open ~/Documents/meeting-2024.mp4 -a superwhisper

# Interview audio
open ~/Downloads/interview.wav -a superwhisper
```

### Optimal File Formats

**Best formats:**

- **MP3**: Most common, well-supported
- **MP4**: Video files (audio extracted automatically)
- **WAV**: Mono, 16 kHz sample rate (highest quality)

**Processing behavior:**

- Uses current active mode's voice and AI settings
- Switch to appropriate mode before transcription
- Results appear in History tab

### Common Workflows

**Meeting Recordings:**

```bash
# 1. Switch to meeting notes mode
open "superwhisper://mode?key=meeting-notes"

# 2. Transcribe recording
open ~/Documents/meetings/team-sync-2024-11-08.mp3 -a superwhisper

# 3. Check History for formatted notes
```

**Podcast Interviews:**

```bash
# 1. Switch to transcription-only mode (no AI formatting)
open "superwhisper://mode?key=default"

# 2. Transcribe podcast
open ~/Podcasts/episode-42.mp3 -a superwhisper

# 3. Review transcript in History
```

**Research Interviews:**

```bash
# 1. Create custom mode for research notes
# 2. Set AI instructions to format as research notes
# 3. Transcribe interview
open ~/Research/participant-01.mp3 -a superwhisper
```

## Speaker Identification in Meetings

Separate transcription by speaker for multi-person recordings.

### Setup

**Enable in Custom Mode:**

1. Select or create a Custom Mode
2. Open mode settings
3. Enable "Record from System Audio"
4. Enable "Identify Speakers"

**Or configure via JSON:**

```json
{
  "audio_options": {
    "identify_speakers": true,
    "mute_audio_while_recording": false,
    "pause_media_while_recording": true,
    "record_system_audio": true
  },
  "key": "meeting-speakers",
  "name": "Meeting with Speakers"
}
```

### Viewing Speaker Segments

**After recording:**

1. Open History (Menu Bar → History)
2. Select your meeting recording
3. Click "Segments" tab
4. View speaker-separated transcription

**Note:** Waveform stays static when recording system audio (expected behavior). Verify capture in
History tab.

### Example Meeting Mode with Speaker ID

```json
{
  "contextFromApplication": true,
  "contextFromClipboard": true,
  "diarize": true,
  "key": "team-meeting",
  "name": "Team Meeting",
  "prompt": "<role>You are a meeting assistant</role>\n\n<instructions>\nFormat the transcript with speaker labels, timestamps, and clear sections.\nExtract action items and decisions.\n</instructions>\n\n<output-format>\n# Meeting Transcript\n\n## Speaker 1 (00:00-02:30)\n[Content]\n\n## Speaker 2 (02:30-05:15)\n[Content]\n\n## Action Items\n- [Item]\n</output-format>",
  "type": "custom",
  "useSystemAudio": true,
  "version": 1
}
```

### Workflow: Record → Transcribe → Export

**Complete workflow:**

```bash
# 1. Switch to meeting mode with speaker ID
open "superwhisper://mode?key=team-meeting"

# 2. Start recording system audio
# (Use keyboard shortcut: Option+Space)

# 3. Conduct meeting (system audio captured)

# 4. Stop recording

# 5. View in History > Segments tab
# (Speaker-separated transcript appears)

# 6. Copy formatted output
# (AI-processed version with speakers labeled)
```

## Recording Window Customization

Customize the visual recording interface for different workflows.

### Recording Window Options

**Access:** Menu Bar → Settings → Advanced → Recording Window

**Available options:**

- **Recording Window Enabled**: Show/hide visual interface during recording
- **Auto-Close Window**: Close automatically after each dictation
- **Mini Recording Window**: Use compact view by default
- **Always Show Mini Recording Window**: Persistent minimal indicator

### Mini Recording Window

**Compact view features:**

- Minimal screen real estate
- Hover to show controls
- Quick mode switching
- Expand on demand

**Hover actions:**

1. Change Mode
2. Start Recording
3. Expand to Regular Window

**Right-click menu:**

- Expand Window
- Open Settings
- Open History

**Toggle views:**

- Hover over recording window
- Click resize toggle (top area)
- Switch between mini and regular

### Configuration Examples

**Distraction-free workflow:**

```json
{
  "auto_close_window": true,
  "mini_recording_window": true,
  "recording_window_enabled": true
}
```

**Always visible indicator:**

```json
{
  "always_show_mini_recording_window": true,
  "auto_close_window": false,
  "recording_window_enabled": true
}
```

**Hidden mode (keyboard-only):**

```json
{
  "recording_window_enabled": false,
  "show_in_dock": false
}
```

### Tips for Different Workflows

**Focus mode (writing, coding):**

- Enable Mini Recording Window
- Enable Auto-Close
- Use keyboard shortcuts only

**Meeting mode (visible recording indicator):**

- Enable Regular Window
- Disable Auto-Close
- Show in dock for easy access

**Quick capture (ADHD-friendly):**

- Always Show Mini Recording Window
- Enable Auto-Close
- Quick visual feedback without distraction

## Context Awareness Advanced

SuperWhisper captures three types of context for smarter AI processing.

### Three Context Types

**1. Selection Context**

- **What**: Text highlighted when recording starts
- **When**: Captured at recording start
- **Use for**: Editing, expanding, reformatting existing text

**2. Application Context**

- **What**: Active window data (input fields, titles, app info)
- **When**: Captured after transcription, before AI processing
- **Use for**: App-specific formatting and smart mode switching

**3. Clipboard Context**

- **What**: Recently copied text content
- **When**: Captured 3 seconds before or during recording
- **Use for**: Follow-up questions, referencing copied material

### Timing Details

```
User Action Timeline:
1. Copy text to clipboard → Clipboard Context available
2. Select text in document → Selection Context captured
3. Start recording → All contexts captured
4. Speak dictation → User Message transcribed
5. Stop recording → Application Context added
6. AI processing → All contexts available to AI
7. Output generated → Paste/clipboard/notification
```

### Enable Context in Custom Modes

**Via JSON configuration:**

```json
{
  "contextFromApplication": true,
  "contextFromClipboard": true,
  "contextFromSelection": true,
  "key": "context-aware",
  "name": "Context-Aware Mode",
  "type": "custom",
  "version": 1
}
```

**Note:** Super Mode has all three enabled by default. Most built-in modes have context disabled.

### Examples: Using Context for Smarter Formatting

**Example 1: Expand on copied code**

```xml
<!-- Setup: Copy code snippet, then dictate -->
<instructions>
If Clipboard Context contains code:
- Explain the code from Clipboard Context
- Format User Message as inline documentation
- Use same language and style
</instructions>
```

**Workflow:**

1. Copy function code to clipboard
2. Start recording
3. Dictate: "Explain what this does and add usage examples"
4. AI uses clipboard code + your dictation

**Example 2: Edit selected text**

```xml
<!-- Setup: Highlight paragraph, then dictate -->
<instructions>
If Text Selection Context is present:
- Apply User Message as editing instruction to selected text
- Preserve original meaning
- Return only the edited version
</instructions>
```

**Workflow:**

1. Select paragraph in document
2. Start recording
3. Dictate: "Make this more concise"
4. AI rewrites selected text

**Example 3: Context-aware email replies**

```xml
<!-- Setup: Copy received email, then dictate -->
<instructions>
If Clipboard Context contains an email:
- Use it as reference for reply
- Format User Message as professional response
- Maintain appropriate tone matching original
- Include relevant quotes from Clipboard Context
</instructions>
```

**Workflow:**

1. Copy received email
2. Switch to email mode
3. Dictate your response
4. AI formats reply with context

### Verify Context Capture

**Check what was captured:**

1. Menu Bar → History
2. Select your dictation
3. View "Context" section
4. See all captured contexts

## Recording Control Commands

Control SuperWhisper recordings with keyboard shortcuts and deep links.

### Toggle Recording

**Start and stop with same shortcut**

- **Default**: Right Command key
- **Configure**: Menu Bar → Settings → Shortcuts → Toggle Recording

**Behavior:**

- Press once: Start recording
- Press again: Stop recording and process

### Push-to-Talk Mode

**Hold to record, release to stop**

- Can share same shortcut as Toggle Recording
- **Configure**: Menu Bar → Settings → Shortcuts → Push-to-Talk

**Use cases:**

- Quick dictations
- Gaming-style "press and hold"
- Avoid accidental recordings

### Cancel Recording

**Abort current recording**

- **Default**: Escape key
- **Configure**: Menu Bar → Settings → Shortcuts → Cancel Recording

**Behavior:**

- Recordings < 30 seconds: Cancel immediately
- Recordings > 30 seconds: Show confirmation prompt
- No processing, recording discarded

### Deep Link Control

**Programmatic control via URLs:**

```bash
# Start recording
open "superwhisper://record"

# Switch mode and record
open "superwhisper://mode?key=meeting-notes&record=true"

# Open settings
open "superwhisper://settings"
```

**Automation example:**

```bash
# Raycast script or Keyboard Maestro macro
open "superwhisper://mode?key=email"
sleep 0.5
open "superwhisper://record"
```

## Vocabulary & Text Replacement

Improve transcription accuracy for technical terms, proper nouns, and jargon.

### Custom Vocabulary

**Purpose:** Help voice engine recognize specialized terms before AI processing.

**Access:** Menu Bar → Settings → Vocabulary

**File location:** `~/Documents/SuperWhisper/vocabulary/`

### Text Replacement Format

**JSON structure:**

```json
{
  "replacements": [
    {
      "from": "gee pee tee",
      "to": "GPT"
    },
    {
      "from": "react jay ess",
      "to": "React.js"
    },
    {
      "from": "type script",
      "to": "TypeScript"
    },
    {
      "from": "next jay ess",
      "to": "Next.js"
    },
    {
      "from": "docker",
      "to": "Docker"
    },
    {
      "from": "kubernetes",
      "to": "Kubernetes"
    }
  ]
}
```

### Homophone Corrections

**Fix common speech-to-text errors:**

```json
{
  "replacements": [
    {
      "from": "there function",
      "to": "their function"
    },
    {
      "from": "its working",
      "to": "it's working"
    },
    {
      "from": "your going to",
      "to": "you're going to"
    },
    {
      "from": "the merge",
      "to": "they merge"
    }
  ]
}
```

### Technical Terms Example

```json
{
  "replacements": [
    {
      "from": "apollo graphql",
      "to": "Apollo GraphQL"
    },
    {
      "from": "postgres ql",
      "to": "PostgreSQL"
    },
    {
      "from": "mongo db",
      "to": "MongoDB"
    },
    {
      "from": "redis",
      "to": "Redis"
    },
    {
      "from": "web pack",
      "to": "webpack"
    },
    {
      "from": "es lint",
      "to": "ESLint"
    },
    {
      "from": "prettier",
      "to": "Prettier"
    }
  ]
}
```

### How It Works

**Processing order:**

1. You speak: "I'm using react jay ess with type script"
2. Voice engine transcribes: "I'm using react jay ess with type script"
3. Text replacement applied: "I'm using React.js with TypeScript"
4. AI processing (if enabled): Further formatting based on mode
5. Output: "I'm using React.js with TypeScript"

**Note:** Applied during voice processing, before AI. Works with all modes.

### Create Vocabulary File

```bash
# Create vocabulary directory if needed
mkdir -p ~/Documents/SuperWhisper/vocabulary/

# Create replacement file
cat > ~/Documents/SuperWhisper/vocabulary/tech-terms.json << 'EOF'
{
  "replacements": [
    {
      "from": "gee pee tee",
      "to": "GPT"
    }
  ]
}
EOF

# Restart SuperWhisper to load
killall superwhisper && open -a SuperWhisper
```

## Backup & Cloud Sync

Sync configurations and history across devices or create backups.

### Filesync Feature

**Enable cloud sync:**

1. Menu Bar → Settings → Advanced → Folder Location
2. Toggle "Filesync"
3. Point to cloud storage (Dropbox, iCloud Drive, etc.)

**Requirements:**

- Same license on all devices
- Cloud storage provider (Dropbox, iCloud, OneDrive)

**What syncs:**

- Custom modes (`modes/`)
- History (`history/`)
- Vocabulary (`vocabulary/`)
- Settings (`settings.json`)

### Manual Backup Process

**Backup everything:**

```bash
# Create timestamped backup
cp -r ~/Documents/SuperWhisper ~/Backups/SuperWhisper-$(date +%Y%m%d)

# Or backup to cloud storage
cp -r ~/Documents/SuperWhisper ~/Dropbox/Backups/SuperWhisper-$(date +%Y%m%d)
```

**Backup just modes:**

```bash
# Backup modes only
cp -r ~/Documents/SuperWhisper/modes ~/code/dotfiles/config/superwhisper/modes

# Add to git for version control
cd ~/code/dotfiles
git add config/superwhisper/modes
git commit -m "Backup SuperWhisper modes"
```

**Backup specific files:**

```bash
# Settings only
cp ~/Documents/SuperWhisper/settings.json ~/Backups/

# Vocabulary only
cp -r ~/Documents/SuperWhisper/vocabulary ~/Backups/
```

### Restore to New Machine

**Complete restore:**

```bash
# 1. Install SuperWhisper on new machine
# 2. Copy backup to SuperWhisper directory
cp -r ~/Backups/SuperWhisper-20241108/* ~/Documents/SuperWhisper/

# 3. Restart SuperWhisper
killall superwhisper && open -a SuperWhisper
```

**Restore from dotfiles:**

```bash
# If you've stored modes in dotfiles repo
cp -r ~/code/dotfiles/config/superwhisper/modes ~/Documents/SuperWhisper/modes

# Restart to load
killall superwhisper && open -a SuperWhisper
```

### Automated Backup with Cron

**Daily backup script:**

```bash
#!/bin/bash
# Save as: ~/bin/backup-superwhisper.sh

BACKUP_DIR="$HOME/Backups/SuperWhisper"
DATE=$(date +%Y%m%d)

# Create backup
cp -r ~/Documents/SuperWhisper "$BACKUP_DIR-$DATE"

# Keep only last 7 backups
ls -t "$HOME/Backups" | grep SuperWhisper | tail -n +8 | xargs -I {} rm -rf "$HOME/Backups/{}"
```

**Add to crontab:**

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * ~/bin/backup-superwhisper.sh
```

### Selective Sync Strategy

**Strategy for ADHD workflow:**

- **Sync modes**: Always (consistent across devices)
- **Sync vocabulary**: Always (technical terms needed everywhere)
- **Sync history**: Optional (can get large, may slow sync)
- **Sync settings**: Usually (unless device-specific preferences)

**Exclude history from sync:**

```bash
# If using Dropbox/iCloud, symlink modes only
mkdir -p ~/Dropbox/SuperWhisper
cp -r ~/Documents/SuperWhisper/modes ~/Dropbox/SuperWhisper/
ln -s ~/Dropbox/SuperWhisper/modes ~/Documents/SuperWhisper/modes
```

## Tips for Advanced Users

**Combine features for powerful workflows:**

1. **XML instructions** + **Context awareness** = Smart formatting based on clipboard/selection
2. **File transcription** + **Speaker ID** = Meeting notes from recordings
3. **Vocabulary** + **Custom modes** = Accurate technical documentation
4. **Recording customization** + **Deep links** = Automated mode switching
5. **Backup & sync** + **Version control** = Track mode evolution in git

**Performance tips:**

- Use text replacement for frequently misheard terms
- Keep XML instructions focused and clear
- Enable only needed context types (reduces processing)
- Use Mini Recording Window for less distraction
- Backup modes before experimenting

**Troubleshooting:**

- Check History tab to verify context capture
- Use Segments tab to confirm speaker identification
- Test vocabulary replacements with simple phrases first
- Restart SuperWhisper after JSON config changes
