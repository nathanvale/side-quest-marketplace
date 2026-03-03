---
name: mpe
description: "Reference knowledge for Markdown Preview Enhanced (MPE) VS Code extension. Covers settings, code chunks, file imports (@import), diagram engines (Mermaid, PlantUML, GraphViz, Vega-Lite, Kroki, WaveDrom), reveal.js presentations, export pipelines (PDF, HTML, Pandoc, eBook), and custom CSS styling. Use when the user is working with MPE, asking about MPE features, configuring preview settings, embedding diagrams, building slides, exporting documents, or troubleshooting issues like preview not rendering or export failing. Do not use for general Markdown syntax or other VS Code extensions."
user-invocable: false
---

# MPE Knowledge Hub

Reference knowledge for Markdown Preview Enhanced (MPE), a VS Code extension for advanced Markdown previewing and exporting. MPE uses the **crossnote** rendering engine.

## Routing Table

| User Intent | Reference | Quick Hint |
|-------------|-----------|------------|
| Configure VS Code settings / extension options | [settings.md](references/settings.md) | `markdown-preview-enhanced.*` in settings.json |
| Execute code in preview / `{cmd}` blocks / output modes | [code-chunks.md](references/code-chunks.md) | Requires `enableScriptExecution: true` |
| Import files, images, or other markdown into a doc | [file-imports.md](references/file-imports.md) | `@ import "path"` syntax (no space in actual use) |
| Embed diagrams (Mermaid, PlantUML, GraphViz, etc.) | [diagrams.md](references/diagrams.md) | Fenced code blocks with engine name |
| Build reveal.js presentations / slides | [presentations.md](references/presentations.md) | `<!-- slide -->` separator |
| Export to PDF, HTML, eBook, or PNG | [export.md](references/export.md) | Right-click preview > Export |
| Style the preview / custom CSS / dark mode | [custom-css.md](references/custom-css.md) | Edit `style.less` via Customize CSS command |

## Quick Reference

### Top 5 Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `previewTheme` | `github-light.css` | Preview color scheme |
| `codeBlockTheme` | `auto.css` | Syntax highlight theme |
| `enableScriptExecution` | `false` | Allow `{cmd}` code chunks |
| `mermaidTheme` | `default` | Mermaid diagram theme |
| `mathRenderingOption` | `KaTeX` | Math engine (KaTeX or MathJax) |

### Code Chunk Quick Syntax

````
```python {cmd=true output="markdown"}
print("| Col A | Col B |")
```
````

Run current chunk: `Shift+Enter` | Run all chunks: `Ctrl+Shift+Enter`

### File Import Quick Syntax

```
@ import "path/to/file.md"
```

(Remove space after `@` in actual use -- escaped here to prevent loader execution.)

### Common Questions

1. **Preview not rendering?** Check `editorAssociations` in settings.json -- VS Code bug #192954 can override MPE. Fix: set `"*.md": "default"` in `editorAssociations`.

2. **Code chunks not executing?** Set `enableScriptExecution: true` in VS Code settings. Security risk -- only enable in trusted workspaces.

3. **Diagrams not showing?** PlantUML requires Java on PATH. Mermaid/GraphViz work out of the box. Kroki requires internet (external service).

4. **PDF export failing?** Puppeteer needs Chrome/Chromium. Set `chromePath` if auto-detection fails. See [export.md](references/export.md).

5. **Custom CSS not applying?** Run "Markdown Preview Enhanced: Customize Css" from Command Palette. Edits `~/.crossnote/style.less` (global) or workspace `.crossnote/style.less`.

6. **Config.js vs settings.json?** VS Code settings.json controls extension behavior. Crossnote `config.js` controls rendering engine. Access config.js from Command Palette: "MPE: Open Crossnote Config".
