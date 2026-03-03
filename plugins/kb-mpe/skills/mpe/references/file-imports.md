# MPE File Imports Reference

Last verified: 2026-03-03 | Source: [MPE file imports docs](https://shd101wyy.github.io/markdown-preview-enhanced/#/file-imports)

## Syntax Forms

Four equivalent syntaxes (note: remove space after `@` in actual use):

```
@ import "path/to/file"
<!-- @ import "path/to/file" -->
![](path/to/file)
[[ path/to/file ]]
```

The first form is most common. HTML comment form is useful inside code fences or when you want the import hidden from non-MPE renderers.

## File Type Handling

| Extension | Rendering |
|-----------|-----------|
| `.jpeg`, `.gif`, `.png`, `.apng`, `.svg`, `.bmp` | Markdown image |
| `.csv` | Markdown table |
| `.mermaid` | Mermaid diagram |
| `.dot` | GraphViz diagram (via viz.js) |
| `.plantuml`, `.puml` | PlantUML diagram |
| `.html` | Embedded directly |
| `.js` | `<script>` tag |
| `.css`, `.less` | Stylesheet |
| `.pdf` | Converted to SVG (requires `pdf2svg`) |
| `.md` | Parsed and embedded inline |
| Other | Rendered as code block |

## Curly-Brace Attributes

Add attributes after the path in curly braces:

```
@ import "image.png" {width="300px" height="200px"}
@ import "data.csv" {class="table-striped"}
@ import "code.py" {code_block=true class="line-numbers"}
@ import "doc.pdf" {page_no=1}
```

### Available Attributes

| Attribute | Applies To | Description |
|-----------|------------|-------------|
| `width` | Images | Display width |
| `height` | Images | Display height |
| `title` | Images | Image title |
| `alt` | Images | Alt text |
| `line_begin` | Code files | First line to include (1-indexed) |
| `line_end` | Code files | Last line to include (supports negative: `-1` = last line) |
| `code_block` | Any | Force rendering as code block |
| `class` | Any | CSS classes (e.g., `line-numbers`) |
| `cmd` | Code files | Execute as code chunk with given command |
| `as` | Data files | Force interpretation (e.g., `as="vega-lite"`) |
| `page_no` | PDF | Single page number |
| `page_begin` | PDF | Start page for range |
| `page_end` | PDF | End page for range |

## Path Resolution

- Relative paths resolve from the importing file's directory
- Absolute paths start from the workspace root
- Remote URLs are supported (e.g., raw GitHub links)

## Remote Imports

```
@ import "https://raw.githubusercontent.com/user/repo/main/data.csv"
```

Remote files are cached. Use the refresh button in the preview pane to clear the cache and re-fetch.

## Import as Code Chunk

Execute an imported file as a code chunk:

```
@ import "script.py" {cmd="python3"}
```

This combines file imports with code chunk execution.

## Gotchas

- PDF import requires `pdf2svg` installed on your system
- Large PDFs are slow to render -- use `page_no` or `page_begin`/`page_end` to limit
- Remote imports depend on network availability and are cached until manual refresh
- Circular imports (A imports B imports A) will cause infinite loops
- `@ import` syntax in skill files or markdown processed by other tools may trigger unintended execution -- escape with a space after `@` in documentation
