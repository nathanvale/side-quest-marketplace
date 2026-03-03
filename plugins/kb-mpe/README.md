# kb-mpe

Reference knowledge for [Markdown Preview Enhanced](https://shd101wyy.github.io/markdown-preview-enhanced/) (MPE), a VS Code extension for advanced Markdown previewing and exporting.

## What this plugin does

Provides on-demand reference knowledge about MPE features. When Claude detects you're working with MPE, it automatically loads relevant documentation -- settings, code chunks, diagrams, exports, and more.

This is a **knowledge bank** plugin (`kb-*` tier). It consumes zero context when disabled and loads progressively when active.

## Enable / Disable

```bash
# Enable
claude plugin add ./plugins/kb-mpe

# Disable
claude plugin remove kb-mpe
```

## Reference areas

| Area | What it covers |
|------|---------------|
| Settings | VS Code settings, crossnote config.js, editor associations |
| Code chunks | `{cmd}` execution, output modes, security considerations |
| File imports | `@import` syntax (all 4 forms), supported file types |
| Diagrams | Mermaid, PlantUML, GraphViz, Vega-Lite, Kroki, WaveDrom |
| Presentations | reveal.js slides, themes, speaker notes, fragments |
| Export | Puppeteer (PDF/PNG), HTML, Pandoc, GFM Markdown, eBook |
| Custom CSS | style.less, per-file styling, dark mode, print styles |

## Links

- [MPE Documentation](https://shd101wyy.github.io/markdown-preview-enhanced/)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced)
- [GitHub Repository](https://github.com/shd101wyy/markdown-preview-enhanced)
