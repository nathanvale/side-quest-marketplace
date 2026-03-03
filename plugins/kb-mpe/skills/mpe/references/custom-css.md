# MPE Custom CSS Reference

Last verified: 2026-03-03 | Source: [MPE customize CSS docs](https://shd101wyy.github.io/markdown-preview-enhanced/#/customize-css)

## Three Approaches

1. **Global / Workspace style.less** -- Applies to all previews
2. **Per-file styles** -- Target specific files via frontmatter `id`/`class`
3. **Imported stylesheets** -- Use `@ import` to include external CSS/LESS files

## style.less Location

| Scope | Path | Command |
|-------|------|---------|
| Global | `~/.crossnote/style.less` (macOS/Linux) | "MPE: Customize CSS (Global)" |
| Global | `%USERPROFILE%\.crossnote\style.less` (Windows) | Same command |
| Workspace | `.crossnote/style.less` in project root | "MPE: Customize CSS (Workspace)" |

Access via `Cmd+Shift+P` > "Markdown Preview Enhanced: Customize Css"

## style.less Structure

```less
.markdown-preview.markdown-preview {
  // Preview styles (doubled selector for specificity)

  @media print {
    // PDF export styles (Puppeteer)
  }

  &.prince {
    // Prince PDF export styles
  }

  .reveal .slides {
    // Presentation mode styles
  }
}

.md-sidebar-toc.md-sidebar-toc {
  // Sidebar table of contents styles
}
```

**Important:** The doubled selector (`.markdown-preview.markdown-preview`) is required for specificity -- MPE's built-in styles use the same class, so you need the double to override.

## Per-File Styling

### Step 1: Add frontmatter

```markdown
---
id: "my-report"
class: "dark-theme compact"
---
```

### Step 2: Target in style.less or imported stylesheet

```less
#my-report {
  font-family: Georgia, serif;
  max-width: 700px;
}

.dark-theme {
  background: #1a1a1a;
  color: #e0e0e0;
}
```

### Step 3: Or import a stylesheet directly

```
@ import "my-styles.less"
```

(Remove space after `@` in actual use.)

## Dark Mode

```less
.markdown-preview.markdown-preview {
  background: #1e1e1e;
  color: #d4d4d4;

  h1, h2, h3 { color: #569cd6; }
  a { color: #4ec9b0; }
  code { background: #2d2d2d; color: #ce9178; }

  pre {
    background: #1e1e1e;
    border: 1px solid #333;
  }

  table {
    border-color: #444;
    th { background: #333; }
    td { border-color: #444; }
  }
}
```

**Note:** MPE also ships with dark preview themes (e.g., `github-dark.css`). Set `previewTheme` before writing custom dark CSS.

## Print / PDF Styles

Target PDF export with `@media print`:

```less
.markdown-preview.markdown-preview {
  @media print {
    body { font-size: 12pt; }
    h1 { page-break-before: always; }
    pre, table, figure { page-break-inside: avoid; }
    a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; }
  }
}
```

## Code Block Theming

Override code block styles:

```less
.markdown-preview.markdown-preview {
  pre {
    background: #282c34;
    border-radius: 6px;
    padding: 16px;
  }

  code {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 14px;
  }

  // Inline code
  p code, li code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
  }
}
```

## Custom Fonts

```less
@font-face {
  font-family: "MyFont";
  src: url("path/to/font.ttf");
}

.markdown-preview.markdown-preview {
  font-family: "MyFont", sans-serif;

  h1, h2, h3, h4, h5, h6 {
    font-family: "MyFont", sans-serif;
  }

  code, pre {
    font-family: "JetBrains Mono", monospace;
  }
}
```

For web fonts (recommended over local):
```less
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap");
```

## LESS Syntax Basics

MPE uses LESS, a CSS superset:

```less
// Variables
@primary: #4a90d9;
@bg-dark: #1e1e1e;

// Nesting
.markdown-preview.markdown-preview {
  h1 { color: @primary; }
  h2 { color: lighten(@primary, 10%); }
}

// Mixins
.border-box() {
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 4px;
}

table { .border-box(); }
```

## Refreshing Styles

After editing `style.less`, click the refresh button in the preview pane (top-right) to recompile and apply changes.

## Gotchas

- Changes to `style.less` require a preview refresh to take effect
- The doubled selector pattern is required -- single `.markdown-preview` won't override built-in styles
- `@media print` styles only affect Puppeteer PDF export, not the live preview
- Imported fonts via `@font-face` with local paths resolve from the `style.less` file's directory
- Workspace `style.less` overrides global `style.less` for that workspace
