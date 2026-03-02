# Markmap Theming and Known Issues

Reference for Markmap-specific theming and caveats. The visualize SKILL.md covers the full workflow (routing, generation, export, save). This file provides supplementary detail.

## Okabe-Ito Color Palette

Markmap JSON options in source `.mmd` YAML frontmatter (markmap-cli reads these automatically):

```yaml
---
markmap:
  color:
    - '#0072B2'
    - '#E69F00'
    - '#009E73'
    - '#D55E00'
    - '#56B4E9'
    - '#CC79A7'
    - '#F0E442'
  colorFreezeLevel: 2
  maxWidth: 320
  spacingVertical: 12
  spacingHorizontal: 80
  paddingX: 16
---
```

## Theme CSS

The `markmap-theme.css` file provides:
- **Font**: Inter, Helvetica, Arial, sans-serif
- **Typographic scale by depth**: Root 24px/700, L2 20px/600, L3 18px/500, L4+ 16px/400
- **White background** for print
- **Branch lines**: 2px stroke width
- **Print color-adjust**: forces color rendering in print

The CSS uses `!important` on font properties because markmap injects inline styles that must be overridden.

## Known Issues

1. **foreignObject rendering** -- Markmap uses HTML-in-SVG via `<foreignObject>` rather than SVG `<text>`. The extracted SVG renders best in a browser. For print-ready output, PDF is the better format.
2. **D3 animation timing** -- The export script waits 2 seconds after `waitForSelector('svg')` for D3 transitions to complete. If you see clipped/missing nodes, increase the delay in `export-markmap.mjs`.
3. **`--offline` is required** -- Without it, the HTML references CDN URLs that fail with `file://` protocol in Puppeteer.
4. **Inline font scale duplication** -- The export script hardcodes the same typographic scale as `markmap-theme.css` because SVG `<style>` CSS does not reliably cross the namespace boundary into XHTML `<foreignObject>` content. The CSS file is the canonical source; keep the script values in sync if changing.
