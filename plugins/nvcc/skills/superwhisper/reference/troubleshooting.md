# SuperWhisper Troubleshooting

## Quick Diagnostics

```bash
# Check if SuperWhisper is running
ps aux | grep -i superwhisper

# Check microphone permissions
system_profiler SPAudioDataType | grep -A 10 "Input Device"

# View recent logs (Console.app)
# Filter: "SuperWhisper"
```

## History Tab Debugging

SuperWhisper's History tab is your most powerful diagnostic tool. It shows every recording with full
metadata, context, and processing details.

### How to Open History

1. **From Menu Bar**: Click SuperWhisper icon → History
2. **From Settings**: SuperWhisper → Settings → History
3. **Keyboard Shortcut**: Check Settings → Shortcuts for history shortcut

### What Information is Available

Each history entry shows:

- **Transcript**: Full transcribed text
- **Timestamp**: When recording occurred
- **Mode Used**: Which mode processed the recording
- **Duration**: Recording length
- **Context**: Application, clipboard, and selection context
- **Segments**: Individual audio segments (if speaker identification enabled)
- **Processing Details**: Model used, processing time, errors

### Debugging Workflow Using History

1. **Make a test recording** in the problematic scenario
2. **Open History** immediately after
3. **Click the most recent entry** to see full details
4. **Check these fields**:
   - **Context**: Is it captured? Empty fields indicate context not enabled
   - **Mode**: Is the correct mode being used?
   - **Transcript**: Any obvious errors or missing words?
   - **Segments**: Speaker identification working?
   - **Errors**: Any error messages in processing details?

### Common Patterns to Look For

**Empty Context Fields**:

- Indicates context not enabled in mode JSON
- See "Context Not Captured" section below

**Wrong Mode Used**:

- Auto-activation not working
- Check `activationApps` in mode JSON

**Poor Transcription in History**:

- Audio quality issue, not mode instruction issue
- Try different voice model

**Missing Recordings**:

- May indicate permission issue
- Check microphone and accessibility permissions

**Slow Processing Time**:

- Cloud model with poor internet
- Switch to local model for testing

### Export and Backup History

```bash
# History stored in SuperWhisper's database
# Location varies by version - check Settings → Advanced → Data Location

# Export specific recordings:
# 1. Open History
# 2. Select recording(s)
# 3. Right-click → Export
# 4. Choose format (TXT, JSON, CSV)

# Backup entire history database
# (check exact path in Settings → Advanced)
cp -r ~/Library/Application\ Support/SuperWhisper/history.db ~/Desktop/superwhisper-history-backup.db
```

## Common Issues

### 1. Mode Not Auto-Activating

**Symptoms**: Mode doesn't switch automatically when opening specific apps

**Causes**:

- App name in `activationApps` doesn't match exactly
- Missing required fields in mode JSON
- SuperWhisper not restarted after mode changes

**Fixes**:

```bash
# 1. Verify app name matches exactly
jq '.activationApps' ~/Documents/superwhisper/modes/your-mode.json

# 2. Check all required fields are present
jq 'keys' ~/Documents/superwhisper/modes/your-mode.json

# 3. Restart SuperWhisper
killall -9 superwhisper
sleep 2
open -a SuperWhisper
```

### 2. Context Not Captured

**Symptoms**:

- History shows empty context fields
- Mode instructions reference context but transcription doesn't use it
- "Use context from application" not working

**Causes**:

- Context options not enabled in mode JSON
- Context permissions not granted
- SuperWhisper not restarted after enabling context

**How to Verify Context Settings in Mode JSON**:

```bash
# Check current context settings
jq '{contextFromClipboard, contextFromApplication, contextFromSelection}' ~/Documents/superwhisper/modes/your-mode.json

# Should see something like:
# {
#   "contextFromClipboard": true,
#   "contextFromApplication": true,
#   "contextFromSelection": true
# }
```

**Context Fields Explained**:

- `contextFromClipboard`: Includes clipboard contents
- `contextFromApplication`: Includes active app name/info
- `contextFromSelection`: Includes selected text (if any)

**Fixes**:

1. **Enable Context in Mode JSON**:

   ```json
   {
     "contextFromApplication": true,
     "contextFromClipboard": true,
     "contextFromSelection": true,
     "key": "your-mode",
     "name": "Your Mode",
     "prompt": "Use context...",
     "type": "custom",
     "version": 1
   }
   ```

2. **Grant Context Permissions**:

   ```bash
   # Accessibility (for selection context)
   open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

   # Screen Recording (for application context - may be required)
   open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
   ```

3. **Restart SuperWhisper**:

   ```bash
   killall -9 superwhisper
   sleep 2
   open -a SuperWhisper
   ```

4. **Verify in History Tab**:
   - Make a test recording
   - Open History
   - Check most recent entry
   - Context fields should now be populated

**Common Context Issues**:

- **Context from Selection not working**: Grant Accessibility permission
- **Context from Application empty**: Some apps don't expose info - try others
- **Context from Clipboard empty**: Clipboard was empty during recording

### 3. SuperWhisper Switching Workspaces

**Symptoms**: SuperWhisper causes AeroSpace to switch workspaces when activating

**Causes**:

- AeroSpace floating rule not configured
- Incorrect app-id in configuration

**Fixes**:

```bash
# 1. Verify AeroSpace configuration
grep -A 2 "com.superduper.superwhisper" ~/code/dotfiles/config/aerospace/aerospace.toml

# 2. Reload AeroSpace config
aerospace reload-config

# 3. Check SuperWhisper app ID
osascript -e 'id of app "SuperWhisper"'
```

### 4. SuperWhisper Not Responding to Shortcuts

**Symptoms**: Keyboard shortcuts don't trigger recording

**Causes**:

- Accessibility permissions not granted
- Shortcut conflict with another app
- SuperWhisper not running

**Fixes**:

```bash
# 1. Check if running
ps aux | grep SuperWhisper

# 2. Restart SuperWhisper
killall SuperWhisper && open -a SuperWhisper

# 3. Check Accessibility permissions
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
# Ensure SuperWhisper is checked
```

**Verify Shortcuts**:

- Open SuperWhisper → Settings → Shortcuts
- Test each shortcut
- Look for conflicts with system shortcuts

### 5. Microphone Not Picking Up Voice

**Symptoms**: Recording starts but no transcription, or transcription is blank

**Causes**:

- Microphone permissions denied
- Wrong input device selected
- Microphone hardware issue

**Fixes**:

```bash
# 1. Check microphone permissions
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
# Ensure SuperWhisper is checked

# 2. Test microphone in System Preferences
open "x-apple.systempreferences:com.apple.preference.sound"
# Input tab → speak and watch input level

# 3. Check selected input device in SuperWhisper
# Settings → Audio → Input Device
```

### 6. Poor Transcription Quality

**Symptoms**: Lots of errors, missing words, wrong words

**Causes**:

- Noisy environment
- Speaking too fast or unclear
- Wrong voice model selected
- Low-quality microphone

**Fixes**:

1. **Switch Voice Model**:
   - Settings → Voice Model
   - Try: Enhanced (more accurate, slower) vs Fast (less accurate, faster)

2. **Improve Audio**:
   - Reduce background noise
   - Speak clearly at moderate pace
   - Use better microphone (if available)
   - Adjust microphone position (closer = better)

3. **Adjust Mode Instructions**:
   - Add context: "I have an Australian accent"
   - Add domain: "Technical terms related to software development"
   - Add corrections: "Always use 'Vue.js' not 'view'"

### 7. Mode Not Switching or Custom Modes Not Showing

**Symptoms**: Custom modes don't appear in Modes menu, deep links don't work, only "Default" mode
visible

**Causes**:

- SuperWhisper preferences cache not reloaded
- Mode JSON files valid but app hasn't detected them
- Preferences database out of sync with mode files

**Primary Fix** (Try first):

```bash
# 1. Hard quit SuperWhisper
killall -9 superwhisper

# 2. Relaunch
sleep 2
open -a SuperWhisper
sleep 3

# 3. Check if modes now appear in the Modes menu
```

**Destructive Fix** (Last resort - clears all preferences):

```bash
# Only do this if hard restart doesn't work
killall -9 superwhisper
rm -rf ~/Library/Caches/com.superduper.superwhisper
rm -rf ~/Library/Preferences/com.superduper.superwhisper.plist
sleep 2
open -a SuperWhisper
sleep 3

# Warning: This nukes all your SuperWhisper settings!
```

**Standard Troubleshooting** (if above doesn't work):

```bash
# 1. Validate mode JSON syntax
jq '.' ~/Documents/SuperWhisper/modes/your-mode.json
# If error, fix JSON syntax

# 2. Check mode key matches (for deep links)
jq '.key' ~/Documents/SuperWhisper/modes/*.json
# Note exact key for deep link

# 3. Verify modes directory location
ls -la ~/Documents/superwhisper/modes/
# Note: lowercase "superwhisper"

# 4. Test with deep link
open "superwhisper://mode?key=exact-mode-key"
```

**Important Notes**:

- SuperWhisper looks for modes in `~/Documents/superwhisper/modes/` (lowercase)
- Custom JSON files must have valid JSON syntax (use `jq` to validate)
- If modes still don't appear after clean restart, create one in SuperWhisper UI as test
- The plist cache clearing fix resolves 95% of "modes not showing" issues

### 8. Transcription Not Pasting

**Symptoms**: Recording completes but text doesn't paste

**Causes**:

- Mode output set to clipboard instead of paste
- Active app doesn't accept paste
- Accessibility permissions issue

**Fixes**:

1. **Check Mode Output**:

   ```bash
   jq '.output.method' ~/Documents/SuperWhisper/modes/your-mode.json
   # Should be "paste" not "clipboard"
   ```

2. **Check App Compatibility**:
   - Test in TextEdit first
   - Some apps (system dialogs) don't accept programmatic paste
   - Use clipboard method for those apps

3. **Check Accessibility**:
   ```bash
   open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
   ```

### 9. SuperWhisper Crashes on Launch

**Symptoms**: App opens then immediately closes

**Causes**:

- Corrupted settings file
- Incompatible mode configuration
- macOS permissions issue

**Fixes**:

```bash
# 1. Check crash logs
open ~/Library/Logs/DiagnosticReports/
# Look for SuperWhisper crash reports

# 2. Reset settings (backup first!)
cp -r ~/Documents/SuperWhisper ~/Documents/SuperWhisper.backup
rm -rf ~/Documents/SuperWhisper/settings.json

# 3. Reinstall SuperWhisper
# Download latest from website
```

### 10. Deep Links Not Working

**Symptoms**: `open "superwhisper://..."` doesn't trigger SuperWhisper

**Causes**:

- SuperWhisper not running
- URL scheme not registered
- Invalid deep link syntax

**Fixes**:

```bash
# 1. Start SuperWhisper first
open -a SuperWhisper
sleep 2  # Wait for launch

# 2. Test basic deep link
open "superwhisper://record"

# 3. Check deep link syntax
# Correct:   superwhisper://mode?key=value
# Incorrect: superwhisper://mode/key=value
```

## Speaker Identification Issues

Speaker identification (diarization) allows SuperWhisper to distinguish between multiple speakers in
a recording.

### Symptoms When Speaker ID Doesn't Work

- History → Segments tab shows only one speaker for multi-person conversation
- All segments labeled as "Speaker 1" even when multiple people spoke
- Segments tab is empty or not showing individual segments
- Mixed speaker audio not being separated

### How to Enable in Mode JSON

Speaker identification must be enabled in your mode configuration:

```json
{
  "audio": {
    "max_speakers": 2,
    "speaker_identification": true
  },
  "instructions": "Transcribe conversation...",
  "key": "your-mode",
  "name": "Your Mode"
}
```

**Audio Options**:

- `speaker_identification`: Boolean - enables/disables speaker detection
- `max_speakers`: Number - maximum speakers to detect (2-10 typically)

### Troubleshooting Speaker Identification

1. **Verify Mode Configuration**:

   ```bash
   jq '.audio' ~/Documents/superwhisper/modes/your-mode.json
   # Should show speaker_identification: true
   ```

2. **Restart SuperWhisper After Enabling**:

   ```bash
   killall -9 superwhisper
   sleep 2
   open -a SuperWhisper
   ```

3. **Verify in History → Segments Tab**:
   - Make a test recording with multiple speakers
   - Open History
   - Click most recent entry
   - Switch to "Segments" tab
   - Should see separate segments for each speaker:
     ```
     [00:00] Speaker 1: Hello, how are you?
     [00:03] Speaker 2: I'm doing well, thanks!
     [00:06] Speaker 1: That's great to hear.
     ```

4. **Audio Quality Requirements**:
   - Clear audio with distinct voices
   - Minimal overlap between speakers
   - Good microphone quality
   - Low background noise

5. **Model Requirements**:
   - Some voice models support speaker ID better than others
   - Try different models: Settings → Voice Model
   - Enhanced models typically have better speaker identification

### Common Speaker ID Issues

**Only One Speaker Detected**:

- Voices too similar in tone/pitch
- Poor audio quality obscuring differences
- Speakers talking over each other
- Try recording in quieter environment

**Too Many Speakers Detected**:

- `max_speakers` set too high
- Background noise being detected as speakers
- Reduce `max_speakers` to actual number
- Improve audio quality

**Inconsistent Speaker Labels**:

- Speaker 1 sometimes labeled as Speaker 2
- This is normal - labels are relative, not absolute
- Focus on separation, not consistent labeling

**Segments Tab Empty**:

- Speaker identification not enabled in mode
- Check mode JSON has `audio.speaker_identification: true`
- Restart SuperWhisper after enabling

## Vocabulary & Text Replacement Issues

Custom vocabulary and text replacements allow you to teach SuperWhisper domain-specific terms and
preferred spellings.

### Symptoms

- Technical terms consistently misspelled (e.g., "Kubernetes" → "communities")
- Brand names wrong (e.g., "Claude" → "cloud")
- Acronyms spelled out (e.g., "API" → "a p i")
- Custom vocabulary file exists but not being applied
- Text replacements defined but not working

### Custom Vocabulary Not Being Applied

**Vocabulary File Location**:

```bash
# Default location (check in Settings → Advanced)
~/Documents/SuperWhisper/vocabulary.txt

# Format: One term per line
# Example:
# Kubernetes
# TypeScript
# GitHub
# Anthropic
# Claude
```

**Verify File Location**:

```bash
# Check if file exists
ls -la ~/Documents/SuperWhisper/vocabulary.txt

# View contents
cat ~/Documents/SuperWhisper/vocabulary.txt
```

**Format Validation**:

```bash
# Check for common issues:
# - No blank lines at end
# - No special characters (unless part of term)
# - One term per line
# - UTF-8 encoding

# Remove blank lines
sed '/^$/d' ~/Documents/SuperWhisper/vocabulary.txt > /tmp/vocab-clean.txt
mv /tmp/vocab-clean.txt ~/Documents/SuperWhisper/vocabulary.txt

# Check encoding
file ~/Documents/SuperWhisper/vocabulary.txt
# Should show: UTF-8 Unicode text
```

**Testing Vocabulary**:

1. Add test term to vocabulary file
2. Restart SuperWhisper (required!)
3. Make recording using the term
4. Check History for correct spelling
5. If still wrong, try adding variations:
   ```
   Kubernetes
   kubernetes
   K8s
   k8s
   ```

### Text Replacements Not Working

**Replacement File Location**:

```bash
# Default location (check in Settings → Advanced)
~/Documents/SuperWhisper/replacements.json

# Format: JSON key-value pairs
# {
#   "find": "replace",
#   "cloud": "Claude",
#   "react native": "React Native",
#   "java script": "JavaScript"
# }
```

**Verify File Location and Format**:

```bash
# Check if file exists
ls -la ~/Documents/SuperWhisper/replacements.json

# Validate JSON syntax
jq '.' ~/Documents/SuperWhisper/replacements.json

# View contents
cat ~/Documents/SuperWhisper/replacements.json
```

**Common Format Issues**:

```json
// WRONG - Comments not allowed in JSON
{
  "find": "replace"  // This will cause error
}

// WRONG - Trailing comma
{
  "find": "replace",
}

// CORRECT
{
  "find": "replace",
  "another": "replacement"
}
```

**Replacement Rules**:

- Case-sensitive by default
- Replacements applied after transcription
- Order matters - first match wins
- Use lowercase keys for case-insensitive matching

**Testing Replacements**:

1. Edit replacements.json
2. Validate JSON: `jq '.' ~/Documents/SuperWhisper/replacements.json`
3. Restart SuperWhisper (required!)
4. Make test recording with replacement terms
5. Check History for correct replacements

### Restart Required

**Important**: SuperWhisper loads vocabulary and replacements at startup only.

```bash
# Always restart after editing vocabulary or replacements
killall -9 superwhisper
sleep 2
open -a SuperWhisper
sleep 3  # Wait for full initialization

# Then test with recording
```

### Advanced Vocabulary Techniques

**For Technical Terms**:

```
# Add variations and common misspellings
PostgreSQL
Postgres
postgres
GraphQL
graphql
WebSocket
websocket
```

**For Names and Brands**:

```
# Add proper capitalization
GitHub
LinkedIn
TypeScript
JavaScript
Anthropic
Claude
```

**For Acronyms**:

```
# Add with and without periods
API
A.P.I.
HTTP
HTTPS
REST
GraphQL
```

### Debugging Workflow

1. **Identify problematic terms**: Check History for consistent misspellings
2. **Add to vocabulary.txt**: One term per line, proper spelling
3. **Restart SuperWhisper**: Required for changes to load
4. **Test recording**: Use the problematic term
5. **Check History**: Verify correct spelling
6. **Iterate**: If still wrong, try variations or replacements

**Priority Order**:

1. Try vocabulary.txt first (teaches model correct spelling)
2. Use replacements.json for post-processing (find/replace after transcription)
3. Combine both for best results

## File Transcription Issues

SuperWhisper can transcribe audio from files, not just live recordings. However, file format and
quality affect success.

### Symptoms

- "Unsupported file format" error
- File transcription fails or produces no output
- Garbled or poor quality transcription from file
- File transcription much slower than live recording
- File transcription produces different results than expected

### File Format Problems

**Optimal Formats**:

- **MP3**: Best compatibility, good compression
- **MP4**: Video files (audio extracted automatically)
- **WAV (mono)**: Best quality, larger file size
- **M4A**: Good for voice recordings

**Supported Formats** (varies by SuperWhisper version):

```bash
# Generally supported:
.mp3, .mp4, .wav, .m4a, .aac, .flac, .ogg

# Check specific file
file /path/to/audio.mp3
# Should show audio format details
```

**Problematic Formats**:

- **Stereo WAV**: May need conversion to mono
- **High sample rates**: >48kHz may cause issues
- **Unusual codecs**: Proprietary formats may fail
- **Very large files**: >100MB may timeout

### How to Convert Files

**Convert to Optimal Format (MP3, mono, 16kHz)**:

```bash
# Using ffmpeg (install via: brew install ffmpeg)

# Convert any audio to optimal format
ffmpeg -i input.wav -ar 16000 -ac 1 -b:a 64k output.mp3

# Extract audio from video
ffmpeg -i input.mp4 -vn -ar 16000 -ac 1 -b:a 64k output.mp3

# Convert stereo to mono
ffmpeg -i stereo.mp3 -ac 1 mono.mp3

# Reduce sample rate
ffmpeg -i input.wav -ar 16000 output.wav

# Convert multiple files at once
for file in *.wav; do
  ffmpeg -i "$file" -ar 16000 -ac 1 "${file%.wav}.mp3"
done
```

**Conversion Options Explained**:

- `-i input.file`: Input file
- `-ar 16000`: Set sample rate to 16kHz (optimal for speech)
- `-ac 1`: Set to mono (1 audio channel)
- `-b:a 64k`: Set audio bitrate to 64kbps (sufficient for speech)
- `-vn`: No video (for extracting audio from video)

**Check File Properties**:

```bash
# Using ffmpeg
ffmpeg -i input.mp3

# Look for:
# - Sample rate (optimal: 16000 Hz or 48000 Hz)
# - Channels (optimal: 1 for mono)
# - Bitrate (optimal: 64-128 kbps for speech)
# - Duration (longer files = longer processing)
```

### Current Mode's Settings Applied

**Important**: File transcription uses the currently active mode's settings.

**Mode Settings Applied to Files**:

- **Instructions**: Processing instructions apply to file
- **Output method**: Paste/clipboard behavior
- **Context**: Context settings (though less relevant for files)
- **Audio options**: Speaker identification, voice model
- **Language**: Target language for transcription

**Workflow for File Transcription**:

1. **Select appropriate mode** before transcribing file:

   ```bash
   # Switch to desired mode first
   open "superwhisper://mode?key=meeting-notes"
   sleep 1

   # Then transcribe file (via UI or drag-drop)
   ```

2. **Create dedicated mode for file transcription**:

   ```json
   {
     "audio": {
       "max_speakers": 4,
       "speaker_identification": true
     },
     "instructions": "Transcribe this audio file verbatim. Include speaker labels if multiple speakers. Format as clean paragraphs.",
     "key": "file-transcription",
     "name": "File Transcription",
     "output": {
       "method": "clipboard"
     }
   }
   ```

3. **Switch to mode before file transcription**:
   - Menu bar → Modes → File Transcription
   - Or: `open "superwhisper://mode?key=file-transcription"`
   - Then transcribe file

**Debugging File Transcription**:

1. **Check which mode was used**:
   - Open History
   - Click file transcription entry
   - Check "Mode Used" field

2. **Verify file was processed correctly**:
   - Check History → Context (may show file info)
   - Check duration matches file length
   - Check for errors in processing details

3. **Test with different mode**:
   - Create simple mode with minimal instructions
   - Switch to that mode
   - Re-transcribe same file
   - Compare results in History

**File Transcription Tips**:

- **Use clipboard method** for files (easier to review before pasting)
- **Enable speaker identification** for multi-person recordings
- **Provide context in instructions**: "This is a technical meeting about..."
- **Split large files**: <30 min per file for best results
- **Clean audio first**: Reduce noise, normalize volume
- **Use consistent format**: Convert all files to same format

**Common File Issues**:

**File Too Large**:

```bash
# Split into smaller chunks (10-minute segments)
ffmpeg -i large.mp3 -f segment -segment_time 600 -c copy chunk_%03d.mp3
```

**Poor Quality Source**:

```bash
# Enhance audio quality
ffmpeg -i input.mp3 -af "highpass=f=200, lowpass=f=3000, volume=2" output.mp3
```

**Background Noise**:

```bash
# Reduce noise (basic)
ffmpeg -i input.mp3 -af "anlmdn=s=10:p=0.002:r=0.002:m=15" output.mp3
```

## Performance Issues

### Slow Transcription

**Symptoms**: Long delay between speaking and transcription appearing

**Causes**:

- Cloud model selected (requires internet)
- Large mode instructions
- System resource constraints

**Fixes**:

1. Switch to local model (Settings → Voice Model → Local)
2. Simplify mode instructions (shorter = faster)
3. Close resource-heavy apps
4. Check internet connection (for cloud models)

### High Battery Usage

**Symptoms**: SuperWhisper draining battery quickly

**Causes**:

- Cloud model constant network usage
- Always-on listening mode
- Frequent background processing

**Fixes**:

1. Use local models instead of cloud
2. Disable always-on listening (use push-to-talk)
3. Settings → Advanced → Reduce background processing

## Debug Mode

**Enable Debug Logging**:

```bash
# Check if debug mode available
defaults read com.superwhisper.macos debugMode

# Enable (if supported)
defaults write com.superwhisper.macos debugMode -bool true

# Restart SuperWhisper
killall SuperWhisper && open -a SuperWhisper

# View logs in Console.app
```

## Getting Help

**Check Version**:

- SuperWhisper → About SuperWhisper → Version

**Export Diagnostic Info**:

```bash
# System info
system_profiler SPSoftwareDataType SPAudioDataType > ~/Desktop/superwhisper-diagnostics.txt

# Mode configurations
cp -r ~/Documents/SuperWhisper/modes ~/Desktop/superwhisper-modes-backup

# Check permissions
ls -la ~/Documents/SuperWhisper/
```

**Contact Support**:

- Include: macOS version, SuperWhisper version, specific error messages
- Attach: Diagnostic info, relevant mode JSON files
