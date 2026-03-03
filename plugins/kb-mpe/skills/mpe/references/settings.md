# MPE Settings Reference

Last verified: 2026-03-03 | Source: [MPE config docs](https://shd101wyy.github.io/markdown-preview-enhanced/#/config)

## Table of Contents

- [VS Code Settings](#vs-code-settings)
- [Crossnote Config.js](#crossnote-configjs)
- [Known Issues](#known-issues)

## VS Code Settings

All settings use the `markdown-preview-enhanced.` prefix in `settings.json`.

### Preview

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `previewTheme` | string | `github-light.css` | Preview color scheme |
| `codeBlockTheme` | string | `auto.css` | Syntax highlighting theme for code blocks |
| `previewColorScheme` | string | `selectedPreviewTheme` | Follow system, light, dark, or theme |
| `revealjsTheme` | string | `white.css` | Theme for reveal.js presentations |
| `enablePreviewZenMode` | boolean | `true` | Zen mode removes minimap and tab bar |
| `automaticallyShowPreviewOfMarkdownBeingEdited` | boolean | `true` | Auto-open preview when editing markdown |
| `previewMode` | string | `singlePreview` | `singlePreview` or `multiplePreview` |
| `liveUpdate` | boolean | `true` | Live update preview on edit. Disable for large files. |

### Parser

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `breakOnSingleNewLine` | boolean | `true` | Treat single newline as `<br>` |
| `usePandocParser` | boolean | `false` | Use Pandoc instead of markdown-it |
| `enableTypographer` | boolean | `false` | Enable smart quotes and dashes |
| `enableWikiLinkSyntax` | boolean | `true` | Support `[[wikilink]]` syntax |
| `enableEmojiSyntax` | boolean | `true` | Convert `:emoji:` to emoji characters |
| `enableCriticMarkupSyntax` | boolean | `false` | Support CriticMarkup for editing annotations |
| `enableLinkify` | boolean | `true` | Auto-link URLs |
| `protocolsWhiteList` | string | `""` | Comma-separated list of allowed URL protocols |

### Math

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mathRenderingOption` | string | `KaTeX` | `KaTeX`, `MathJax`, or `None` |
| `mathInlineDelimiters` | array | `[["$", "$"], ["\\(", "\\)"]]` | Inline math delimiters |
| `mathBlockDelimiters` | array | `[["$$", "$$"], ["\\[", "\\]"]]` | Block math delimiters |
| `mathRenderingOnlineService` | string | `https://latex.codecogs.com/gif.latex` | URL for online math rendering fallback |

### Diagrams

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mermaidTheme` | string | `default` | Mermaid theme: `default`, `dark`, `forest` |
| `plantumlServer` | string | `""` | PlantUML server URL (default uses local Java) |
| `plantumlJarPath` | string | `""` | Path to local PlantUML `.jar` file |
| `krokiServer` | string | `https://kroki.io` | Kroki server URL |

### Export

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `chromePath` | string | `""` | Path to Chrome/Chromium for Puppeteer export |
| `imageFolderPath` | string | `/assets` | Default image save directory |
| `printBackground` | boolean | `false` | Include background colors in PDF export |
| `puppeteerWaitForTimeout` | number | `0` | Extra wait (ms) before Puppeteer capture |
| `pandocPath` | string | `pandoc` | Path to Pandoc executable |
| `pandocMarkdownFlavor` | string | `markdown-raw_tex+tex_math_single_backslash` | Pandoc input format |

### Code Execution

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableScriptExecution` | boolean | `false` | Allow `{cmd}` code chunks. **Security risk.** |
| `enableHTML5Embed` | boolean | `false` | Enable HTML5 audio/video embedding |

### Image

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `imageUploader` | string | `imgur` | Image upload service |
| `imageDropAction` | string | `copy` | What happens when images are dropped |

## Crossnote Config.js

Crossnote is MPE's rendering engine. It has its own configuration separate from VS Code settings.

### Location

| Scope | Path | Command |
|-------|------|---------|
| Global | `~/.crossnote/config.js` (macOS/Linux) | "MPE: Open Config Script (Global)" |
| Global | `%USERPROFILE%\.crossnote\config.js` (Windows) | Same command |
| Workspace | `.crossnote/config.js` in project root | "MPE: Open Config Script (Workspace)" |

Note: `$XDG_CONFIG_HOME/.crossnote/config.js` is also checked on Linux.

### Config.js Structure

```javascript
module.exports = {
  katexConfig: {
    macros: { "\\RR": "\\mathbb{R}" }
  },
  mathjaxConfig: {
    tex: {},
    options: {},
    loader: {}
  },
  mermaidConfig: {
    startOnLoad: false
  }
};
```

### Settings.json vs Config.js

| Concern | settings.json | config.js |
|---------|---------------|-----------|
| Extension behavior | Yes | No |
| Preview theme | Yes | No |
| Math engine config | No | Yes (KaTeX macros, MathJax options) |
| Mermaid config | Theme only | Full Mermaid config |
| Scope | VS Code-wide | Per-project or global |

## Known Issues

### VS Code editorAssociations Bug (#192954)

**Symptom:** MPE preview doesn't open or markdown files open in a different editor.

**Cause:** VS Code `workbench.editorAssociations` can override the default markdown handler.

**Fix:** Add to `settings.json`:
```json
{
  "workbench.editorAssociations": {
    "*.md": "default"
  }
}
```

### Preview Performance with Large Files

**Symptom:** Preview lags or freezes with large markdown files.

**Fix:** Disable live update:
- Command Palette: "Markdown Preview Enhanced: Toggle Live Update"
- Or set `liveUpdate: false` in settings

### Keyboard Shortcuts Not Working

**Symptom:** MPE keybindings don't respond.

**Debug:** Command Palette > "Key Binding Resolver: Toggle" to check for conflicts.
