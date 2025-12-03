# Say Skill

macOS text-to-speech using the native `say` command.

Use this skill when users want to:
- Speak text aloud
- List available voices
- Save speech to audio files
- Find voices by language

## MCP Tools

| Tool | Description |
|------|-------------|
| `say_speak` | Speak text with optional voice and rate |
| `say_list_voices` | List voices, optionally filtered by language |
| `say_save_audio` | Save speech to .aiff or .m4a file |

## Usage Examples

**Speak text:**
```
say_speak({ text: "Hello Nathan", voice: "Samantha" })
```

**List English voices:**
```
say_list_voices({ language: "en" })
```

**Save to file:**
```
say_save_audio({ text: "Intro", output: "intro.m4a", voice: "Daniel" })
```

## Popular Voices

| Voice | Language | Notes |
|-------|----------|-------|
| Samantha | en_US | Premium, natural |
| Alex | en_US | Premium, natural |
| Daniel | en_GB | British accent |
| Karen | en_AU | Australian accent |
| Albert | en_US | Fun, robotic |

## Rate Guidelines

- Default: ~175 words per minute
- Slow: 100-150 WPM (for comprehension)
- Fast: 200-250 WPM (for quick listening)
