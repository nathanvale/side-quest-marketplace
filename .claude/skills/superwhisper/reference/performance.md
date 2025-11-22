# SuperWhisper Performance Optimization

## Voice Model Selection

### Local vs Cloud Models

**Local Models**:

- ✅ Fast (no network latency)
- ✅ Private (never leaves device)
- ✅ Works offline
- ✅ Lower battery usage
- ❌ Less accurate for accents
- ❌ Limited language support

**Cloud Models**:

- ✅ More accurate transcription
- ✅ Better accent recognition
- ✅ More languages supported
- ✅ Handles technical jargon better
- ❌ Requires internet
- ❌ Slower (network latency)
- ❌ Higher battery usage

### Recommended Models by Use Case

| Use Case           | Recommended Model | Why                            |
| ------------------ | ----------------- | ------------------------------ |
| Quick notes        | Local (Fast)      | Speed > accuracy               |
| Email drafts       | Cloud (Enhanced)  | Professionalism needs accuracy |
| Meeting notes      | Cloud (Enhanced)  | Multiple speakers, accents     |
| Code comments      | Local (Fast)      | Technical terms, speed matters |
| Offline work       | Local (any)       | No internet access             |
| ADHD quick capture | Local (Fast)      | Minimize friction              |

**Switch Models**:

```bash
# Via Settings
# SuperWhisper → Settings → Voice Model → Select

# Test different models for your use case
```

## Optimizing Transcription Speed

### 1. Model Selection

**Fastest to Slowest**:

1. Local Fast (< 1 second)
2. Local Enhanced (1-2 seconds)
3. Cloud Fast (2-3 seconds)
4. Cloud Enhanced (3-5 seconds)

**ADHD Tip**: Use Local Fast for quick capture (speed > perfection)

### 2. Mode Instructions Length

**Impact**: Longer instructions = slower processing

```json
// ❌ SLOW - Too verbose
{
  "instructions": "Please transcribe my voice and format it as a professional email with proper greeting, body paragraphs that are well-structured with clear topic sentences, and a professional closing. Make sure to check grammar, spelling, and tone. Use appropriate salutations based on context..."
}

// ✅ FAST - Concise
{
  "instructions": "Format as professional email: greeting, clear paragraphs, closing. Fix grammar."
}
```

**Rule of Thumb**: Keep instructions under 100 words for fast processing

### 3. Context Awareness Settings

**Performance Impact**:

- No context: Fastest
- Clipboard only: Fast
- Selection + clipboard: Medium
- Active app + clipboard + selection: Slowest

**Optimize**:

```json
// ❌ SLOW - All context enabled
{
  "context": {
    "clipboard": true,
    "selection": true,
    "activeApp": true
  }
}

// ✅ FAST - Only needed context
{
  "context": {
    "clipboard": false,
    "selection": false,
    "activeApp": false
  }
}
```

**When to Use Context**:

- **Clipboard**: Only if AI needs to reference copied text
- **Selection**: Only for editing/expanding existing text
- **Active App**: Only for app-specific formatting

## Recording Optimization

### Recording Duration

**Impact on Speed**:

- < 10 seconds: Near-instant processing
- 10-30 seconds: 1-3 second delay
- 30-60 seconds: 3-5 second delay
- > 60 seconds: 5+ second delay

**ADHD Strategy**: Break long dictations into multiple short recordings

```bash
# Instead of: 2-minute monologue
# Do: 4x 30-second chunks
```

### Audio Quality vs Speed

**High Quality** (Settings → Audio Quality → High):

- More accurate transcription
- Larger files to process
- Slower processing

**Normal Quality** (Default):

- Balanced accuracy/speed
- Recommended for most users

**Fast Quality** (Settings → Audio Quality → Fast):

- Fastest processing
- Slightly less accurate
- Good for quick notes

## Battery Optimization

### Settings to Reduce Battery Drain

1. **Use Local Models**:
   - Settings → Voice Model → Local
   - No network = less power

2. **Disable Always-On Listening**:
   - Use push-to-talk instead
   - Settings → Activation → Push-to-talk

3. **Reduce Background Processing**:
   - Settings → Advanced → Background processing → Minimal

4. **Disable Unnecessary Context**:
   - Turn off clipboard/selection monitoring
   - Only enable when needed per-mode

### Battery Usage Monitoring

```bash
# Check battery usage (Activity Monitor)
open -a "Activity Monitor"
# View → Energy

# Look for SuperWhisper process
# Check "Avg Energy Impact"
```

## Network Optimization (Cloud Models)

### Reduce Network Calls

1. **Use Local Models for Quick Tasks**:
   - Notes, quick capture → Local
   - Important emails, documents → Cloud

2. **Batch Recordings**:
   - Record multiple thoughts
   - Process together
   - Reduces network overhead

3. **Check Connection Quality**:

   ```bash
   # Test network speed
   ping -c 5 8.8.8.8

   # Slow network? Switch to local model temporarily
   ```

## System Resource Optimization

### macOS Settings

**Reduce System Load**:

1. Close unnecessary apps during dictation
2. Disable visual effects: System Preferences → Accessibility → Display → Reduce motion
3. Keep at least 20% free disk space

**Check Resource Usage**:

```bash
# CPU usage
top -l 1 | grep SuperWhisper

# Memory usage
ps aux | grep SuperWhisper | awk '{print $4"%"}'

# Disk space
df -h ~/Documents/SuperWhisper/
```

### Mode Optimization Checklist

**For Every Custom Mode, Ask**:

- [ ] Are instructions minimal and clear?
- [ ] Is context awareness limited to what's needed?
- [ ] Is output method appropriate (paste vs clipboard)?
- [ ] Is voice model right for use case (local vs cloud)?
- [ ] Have I tested on actual recording length (not just short tests)?

## ADHD-Specific Performance Tips

### 1. Optimize for Friction Reduction

**Slowest (avoid)**:

1. Open app → select mode → start recording → wait → paste

**Fastest (use this)**:

1. Press shortcut → speak → auto-paste
   ```bash
   # One-step activation
   open "superwhisper://mode?key=quick-note&record=true"
   ```

### 2. Pre-Configure Common Modes

**Create Keyboard Shortcuts**:

- `cmd+shift+q`: Quick note (local, fast, paste)
- `cmd+shift+e`: Email (cloud, accurate, paste)
- `cmd+shift+o`: Obsidian (local, fast, paste with markdown)

### 3. Use Local Models Default

**Why**: Eliminates "waiting for internet" friction **Exception**: Only use cloud for
important/formal writing

## Benchmarking Your Setup

### Test Different Configurations

```bash
# Test script (create as ~/test-superwhisper-speed.sh)
#!/bin/bash

echo "Testing SuperWhisper performance..."
echo "Speak for 10 seconds after each beep"

for model in "local-fast" "local-enhanced" "cloud-fast"; do
  echo "Testing: $model"
  # Switch mode and record
  open "superwhisper://mode?key=test-$model&record=true"
  sleep 15  # 10s recording + 5s processing
  # Check result speed
done
```

### Measure Your Results

**Track**:

- Time from recording start to paste (use stopwatch)
- Accuracy (count errors per 100 words)
- Battery drain (Activity Monitor → Energy)

**Optimize Based on Your Needs**:

- Need speed? → Local Fast
- Need accuracy? → Cloud Enhanced
- Need balance? → Local Enhanced

## Quick Performance Checklist

**Before Each Session**:

- [ ] Right voice model for task?
- [ ] Mode instructions concise?
- [ ] Unnecessary context disabled?
- [ ] Good microphone position?
- [ ] Internet stable (if cloud)?
- [ ] System resources available?

**ADHD Hack**: Create mode called "performance-check" that displays this checklist!
