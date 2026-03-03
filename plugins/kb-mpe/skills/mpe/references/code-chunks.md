# MPE Code Chunks Reference

Last verified: 2026-03-03 | Source: [MPE code chunk docs](https://shd101wyy.github.io/markdown-preview-enhanced/#/code-chunk)

## Table of Contents

- [Quick Start](#quick-start)
- [Syntax](#syntax)
- [Chunk Options](#chunk-options)
- [Output Modes](#output-modes)
- [Session Continuity](#session-continuity)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Language Aliases](#language-aliases)
- [Macros](#macros)
- [Gotchas](#gotchas)

## Quick Start

Enable code execution first:

```json
// settings.json
{ "markdown-preview-enhanced.enableScriptExecution": true }
```

Then write a code chunk:

````
```python {cmd=true}
print("Hello from MPE")
```
````

Run with `Shift+Enter`.

## Syntax

````
```lang {cmd=your_cmd opt1=value1 opt2=value2 ...}
your code here
```
````

- Language specifier comes first
- When an option value equals `true`, you can omit the value: `{cmd hide}` is the same as `{cmd=true hide=true}`
- `cmd` defaults to the language name if omitted when `cmd=true`

## Chunk Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cmd` | string/bool | false | Command to execute. `true` uses the language name. |
| `output` | string | `text` | How output renders: `html`, `markdown`, `text`, `png`, `none` |
| `args` | array | `[]` | Arguments appended to the command |
| `stdin` | boolean | `false` | Pass code via stdin instead of temp file |
| `hide` | boolean | `false` | Hide code block, show only output |
| `continue` | bool/string | `false` | `true` continues from previous chunk; string references a chunk `id` |
| `id` | string | none | Identifier for referencing this chunk |
| `class` | string | none | CSS classes (e.g., `line-numbers` for line numbering) |
| `element` | string | none | Target HTML element for appending output |
| `run_on_save` | boolean | `false` | Auto-execute when the markdown file is saved |
| `modify_source` | boolean | `false` | Insert output directly into the source file |
| `matplotlib` | boolean | `false` | Enable inline matplotlib graph plotting (Python) |

## Output Modes

| Mode | Behavior |
|------|----------|
| `html` | Output appended as raw HTML |
| `markdown` | Parsed as Markdown (KaTeX supported; MathJax and diagrams not supported) |
| `text` | Wrapped in `<pre>` block (default) |
| `png` | Rendered as base64-encoded image |
| `none` | Output hidden entirely |

### Example: Markdown Output

````
```python {cmd=true output="markdown"}
print("| Col A | Col B |")
print("|-------|-------|")
print("| 1     | 2     |")
```
````

### Example: Hidden Code with Visible Output

````
```python {cmd=true hide}
print("Only this output is visible")
```
````

## Session Continuity

Chunks can share state using `continue`:

````
```python {cmd=true id="setup"}
x = 42
```

```python {cmd=true continue="setup"}
print(x)  # prints 42
```
````

Using `continue=true` (without an id) continues from the immediately preceding chunk.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Enter` | Run current code chunk |
| `Ctrl+Shift+Enter` | Run all code chunks in file |

## Language Aliases

Common languages work directly as `cmd` values:

- `python` / `python3`
- `javascript` / `node`
- `ruby`
- `bash` / `sh`
- `typescript` / `ts-node`
- `go` (uses `go run`)

## Macros

**`$input_file`** -- A temp file containing the chunk's code, auto-deleted after execution. Useful with `args`:

````
```gnuplot {cmd=true args=["$input_file"]}
set terminal png
plot sin(x)
```
````

## Gotchas

### Security

Code chunks execute arbitrary commands on your system. **Only enable `enableScriptExecution` in trusted workspaces.** A malicious markdown file with `run_on_save` could compromise your system when opened.

See also: [CVE-2023-26152](https://nvd.nist.gov/vuln/detail/CVE-2023-26152)

### Export Compatibility

| Export Pipeline | Code Chunk Support |
|----------------|-------------------|
| Puppeteer (PDF/PNG) | Full support |
| HTML | Full support |
| Pandoc | Partial -- some output modes unreliable |
| eBook | Not supported |
| GFM Markdown | Results only (code hidden by default) |

### matplotlib

Set `matplotlib=true` on the chunk for inline plots. The extension handles `plt.show()` automatically -- do not call it manually or you'll get duplicate output.
