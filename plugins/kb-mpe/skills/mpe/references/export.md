# MPE Export Reference

Last verified: 2026-03-03 | Sources: [Puppeteer](https://shd101wyy.github.io/markdown-preview-enhanced/#/puppeteer), [HTML](https://shd101wyy.github.io/markdown-preview-enhanced/#/html), [Pandoc](https://shd101wyy.github.io/markdown-preview-enhanced/#/pandoc), [Markdown](https://shd101wyy.github.io/markdown-preview-enhanced/#/markdown)

## Table of Contents

- [Export Methods Overview](#export-methods-overview)
- [Puppeteer (PDF / PNG / JPEG)](#puppeteer-pdf--png--jpeg)
- [HTML Export](#html-export)
- [Pandoc Export](#pandoc-export)
- [GFM Markdown Export](#gfm-markdown-export)
- [eBook Export](#ebook-export)
- [Export on Save](#export-on-save)
- [Gotchas](#gotchas)

## Export Methods Overview

| Pipeline | Output Formats | Requirements | Best For |
|----------|---------------|-------------|----------|
| Puppeteer | PDF, PNG, JPEG | Chrome/Chromium | High-fidelity PDF, screenshots |
| HTML | HTML file | None | Web deployment, sharing |
| Pandoc | PDF, Word, RTF, Beamer | Pandoc + LaTeX (for PDF) | Academic papers, Word docs |
| GFM Markdown | `.md` file | None | GitHub-compatible markdown |
| eBook | ePub | ebook-convert (Calibre) | eBook publishing |

**How to export:** Right-click the preview pane and select the export method.

## Puppeteer (PDF / PNG / JPEG)

### Requirements

Chrome or Chromium must be installed. MPE auto-detects the browser location. If detection fails, set `chromePath` in VS Code settings.

### Frontmatter

```yaml
---
puppeteer:
  landscape: false
  format: A4
  timeout: 3000
  printBackground: true
  margin:
    top: 1cm
    right: 1cm
    bottom: 1cm
    left: 1cm
---
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `Letter` | Paper size: `A3`, `A4`, `A5`, `Legal`, `Letter`, `Tabloid` |
| `landscape` | boolean | `false` | Landscape orientation |
| `printBackground` | boolean | `false` | Include background colors/images |
| `margin` | object | `{}` | Page margins (`top`, `right`, `bottom`, `left`) |
| `timeout` | number | `30000` | Wait time (ms) before capture |
| `displayHeaderFooter` | boolean | `false` | Show header/footer |
| `headerTemplate` | string | `""` | HTML template for header |
| `footerTemplate` | string | `""` | HTML template for footer |

### Print Styles

Customize PDF appearance via `style.less`:

```less
.markdown-preview.markdown-preview {
  @media print {
    h1 { page-break-before: always; }
    pre { page-break-inside: avoid; }
    body { font-size: 12pt; }
  }
}
```

Access via Command Palette: "Markdown Preview Enhanced: Customize Css"

## HTML Export

### Two Modes

| Mode | When to Use | Setting |
|------|------------|---------|
| Offline | Local viewing only | `offline: true` |
| CDN | Remote deployment (GitHub Pages, etc.) | `offline: false` (default) |

### Frontmatter

```yaml
---
html:
  embed_local_images: false
  embed_svg: true
  offline: false
  toc: true
  print_background: false
---
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `embed_local_images` | boolean | `false` | Convert images to base64 |
| `embed_svg` | boolean | `true` | Embed SVGs inline |
| `offline` | boolean | `false` | Bundle all assets for offline use |
| `toc` | bool/undefined | undefined | Table of contents: `true` (visible), `false` (disabled), undefined (hidden sidebar) |
| `print_background` | boolean | `false` | Include backgrounds |

**Note:** Sidebar TOC requires `enableScriptExecution: true` in VS Code settings.

## Pandoc Export

### Requirements

[Pandoc](https://pandoc.org/) must be installed. For PDF output, a LaTeX distribution (TeX Live, MiKTeX) is also needed.

### Frontmatter

```yaml
---
title: My Document
output: word_document
pandoc_args: ["--toc", "--toc-depth=2"]
bibliography: references.bib
---
```

| Option | Description |
|--------|-------------|
| `output` | Target format: `pdf_document`, `word_document`, `rtf_document`, `beamer_presentation`, `custom_document` |
| `pandoc_args` | Array of CLI arguments passed to Pandoc |
| `bibliography` | Path to `.bib` file (auto-adds `--filter=pandoc-citeproc`) |
| `csl` | Citation style language file |

### Output Formats

| Format | Output Option | Extra Requirements |
|--------|--------------|-------------------|
| PDF | `pdf_document` | LaTeX distribution |
| Word | `word_document` | None |
| RTF | `rtf_document` | None |
| Beamer | `beamer_presentation` | LaTeX distribution |
| Custom | `custom_document` | Varies |

### Using Pandoc Parser

To use Pandoc as the markdown parser (instead of markdown-it):
```json
{ "markdown-preview-enhanced.usePandocParser": true }
```

## GFM Markdown Export

Exports to GitHub-flavored markdown with diagrams converted to PNG images.

### Frontmatter

```yaml
---
markdown:
  image_dir: /assets
  path: output.md
  ignore_from_front_matter: true
  absolute_image_path: false
---
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `image_dir` | string | `/assets` | Directory for generated images |
| `path` | string | `filename_.md` | Output file path |
| `ignore_from_front_matter` | boolean | `true` | Exclude markdown config from output |
| `absolute_image_path` | boolean | `false` | Use absolute paths for images |

### What Gets Converted

- Diagrams (Mermaid, PlantUML, GraphViz, etc.) become PNG images
- Math expressions become images
- Code chunk results are included (code hidden by default)

## eBook Export

Brief -- uses [Calibre's ebook-convert](https://calibre-ebook.com/) tool.

Export via right-click > "eBook (ePub)". Requires `ebook-convert` on PATH.

**Limitation:** Code chunks are not supported in eBook export.

## Export on Save

Trigger any export automatically when the file is saved:

```yaml
---
export_on_save:
  puppeteer: true                # PDF only
  # or:
  # puppeteer: ["pdf", "png"]    # Multiple formats
  html: true                     # HTML export
  pandoc: true                   # Pandoc export
  markdown: true                 # GFM Markdown export
---
```

## Gotchas

### Puppeteer Chrome Not Found

**Symptom:** "Chrome not found" or "Failed to launch browser"

**Fixes:**
1. Install Chrome or Chromium
2. Set `chromePath` to the executable: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` (macOS)
3. Check GitHub issue [#2141](https://github.com/shd101wyy/markdown-preview-enhanced/issues/2141) for platform-specific paths

### Pandoc Reference Doc Deprecation

`--reference-docx` is deprecated. Use `--reference-doc` instead in `pandoc_args`.

See issue [#2145](https://github.com/shd101wyy/markdown-preview-enhanced/issues/2145).

### Math in HTML Export

MathJax/KaTeX formulas won't render in CDN-exported HTML if served from `file://`. Use a local server or deploy remotely.

### Large File Performance

Exporting large files (500+ lines with many diagrams) can be slow or time out. Increase `puppeteerWaitForTimeout` or `puppeteer.timeout` for Puppeteer exports.

### Diagram Export Limitations

| Feature | Puppeteer | HTML | Pandoc | GFM | eBook |
|---------|-----------|------|--------|-----|-------|
| Mermaid | Yes | Yes | No | PNG | No |
| WaveDrom | Yes | Yes | No | No | No |
| Code chunks | Yes | Yes | Partial | Results only | No |
| Math | Yes | Yes | Yes | Image | Yes |
