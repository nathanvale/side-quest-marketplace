---
created: 2026-03-01
title: "Tiled Printing for Large Diagrams"
type: research
tags: [printing, tiling, poster, diagrams, svg, pdf, macos]
project: cortex
status: draft
---

# Tiled Printing for Large Diagrams

Research into printing large diagrams across multiple pages that tile together on a wall. Compiled from community sources and newsroom beat report.

## The Problem

SVG has no built-in pagination. Large diagrams get squashed to one page or clipped. macOS Preview cannot tile at all -- confirmed by multiple Apple Community threads. The standard macOS print dialog clips horizontal overflow.

## Terminology

The community uses these interchangeably:
- **Poster printing** -- most common
- **Tiled printing** -- preferred in technical contexts
- **Multi-page printing** -- generic
- **Posterizing** -- sometimes used for the pdftilecut/pdfposter workflow

## Tier 1: GUI Tools

### PosteRazor (Community Favourite)

[posterazor.sourceforge.io](https://posterazor.sourceforge.io/)

Open-source, cross-platform (Windows/macOS/Linux), also available as WebAssembly browser version. Takes a raster image, lets you configure paper size, margins, and overlap, exports a multi-page PDF ready to print. Nothing leaves your machine.

**Workflow for Mermaid diagrams on macOS:**
1. Export diagram to PNG: `bunx --bun @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.png -s 4 -b white`
2. Open in PosteRazor (online or desktop), set paper size (A4/A3), configure overlap
3. Print the resulting tiled PDF, trim margins, assemble on wall

### Adobe Acrobat / Acrobat Reader

Built-in "Poster" mode under Page Size & Handling in print dialog. Sets tile scale and overlap. However -- Sonoma and newer have broken "Print As Image" in Acrobat Reader, so unreliable on modern macOS.

### Docuslice

[docuslice.com](https://docuslice.com/) -- browser-based, marketed as easiest option. PDF or image in, tiled PDF out.

### Rasterbator

[rasterbator.net](https://rasterbator.net/) -- the classic. Known for halftone/dot-art style output. Best for decorative posters, less ideal for technical diagrams where legibility matters.

## Tier 2: CLI Tools (Scriptable)

### pdftilecut

[github.com/oxplot/pdftilecut](https://github.com/oxplot/pdftilecut)

Purpose-built for tiling. Cross-platform CLI, subdivides a PDF page into smaller pages matching a target paper size. Multiple sources call it the cleanest solution.

### pdfposter

```bash
pdfposter -mA3 input.pdf output.pdf
```

Scales and tiles PDF pages across multiple sheets. Available via package managers.

### mutool poster (MuPDF)

```bash
mutool poster -x 3 -y 2 input.pdf output.pdf  # 3x2 grid
```

`-x` splits side-to-side, `-y` splits top-to-bottom. Widely available via brew (`brew install mupdf-tools`).

### Inkscape CLI

```bash
inkscape --export-pdf=output.pdf input.svg
```

Handles SVGs natively with built-in tiling in some versions. Preserves vector quality without rasterizing first.

## Tier 3: SVG/CSS Developer Hack

A CSS `@media print` approach documented in a [GitHub gist by asizer](https://gist.github.com/asizer/dc0279aa47abbc3a19a70f514dab765b):

- Create multiple `<svg>` elements each with a different `viewBox` showing a different region
- Use `<use xlink:href="#graphic">` to reference the same underlying data
- CSS `@page` rules handle page breaks

Only approach that preserves full vector quality with zero rasterization. Requires manual breakpoint definition per paper size.

## Mermaid-Specific Path

No native tiled printing in Mermaid CLI or MermaidChart. Community consensus: export SVG or PNG via `mmdc`, then feed to PosteRazor or pdftilecut.

**Recommended pipeline for Cortex diagrams:**
1. Export high-res PNG: `bunx --bun @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.png -s 4 -b white`
2. Tile with pdftilecut or PosteRazor
3. Print, trim overlap margins, tape together on wall

## macOS Gotchas

- **Preview** cannot tile pages at all -- no workaround
- **Adobe Acrobat Reader** "Poster" mode broken on Sonoma+ (Print As Image issue)
- **Chrome** can print to PDF but has no tiling option
- Best macOS path: PosteRazor (desktop app or browser version) or CLI tools

## Sources

- [PosteRazor](https://posterazor.sourceforge.io/)
- [pdftilecut](https://github.com/oxplot/pdftilecut)
- [Docuslice](https://docuslice.com/)
- [Rasterbator](https://rasterbator.net/)
- [Poster printing in macOS](https://jsyang.ca/guides/poster-printing-in-macos/)
- [Adobe Acrobat poster printing](https://helpx.adobe.com/acrobat/desktop/print-documents/booklets-posters-banners/posters-banners.html)
- [SVG tiling CSS hack](https://gist.github.com/asizer/dc0279aa47abbc3a19a70f514dab765b)
- [pdfposter manpage](https://manpages.ubuntu.com/manpages/trusty/man1/pdfposter.1.html)
- [Mermaid Chart export guide](https://docs.mermaidchart.com/guides/export-diagram)
- [Apple Community - tiling discussion](https://discussions.apple.com/thread/250703086)
