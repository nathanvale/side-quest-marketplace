# MPE Presentations Reference

Last verified: 2026-03-03 | Source: [MPE presentation docs](https://shd101wyy.github.io/markdown-preview-enhanced/#/presentation)

## Table of Contents

- [Quick Start](#quick-start)
- [Slide Syntax](#slide-syntax)
- [Frontmatter Configuration](#frontmatter-configuration)
- [Built-in Themes](#built-in-themes)
- [Per-Slide Customization](#per-slide-customization)
- [Fragments](#fragments)
- [Speaker Notes](#speaker-notes)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Deployment](#deployment)
- [Gotchas](#gotchas)

## Quick Start

```markdown
---
presentation:
  theme: white.css
  width: 960
  height: 700
---

<!-- slide -->

# First Slide

Content here

<!-- slide -->

# Second Slide

More content
```

Open preview, then click the presentation icon to enter fullscreen.

## Slide Syntax

Slides are separated by HTML comments:

```markdown
<!-- slide -->
```

The first `<!-- slide -->` is required before the first slide's content.

## Frontmatter Configuration

All options go under the `presentation:` key in YAML frontmatter.

### Layout

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | 960 | Presentation width (px) |
| `height` | number | 700 | Presentation height (px) |
| `margin` | number | 0.1 | Margin around slides (fraction) |
| `center` | boolean | true | Vertically center slide content |

### Navigation

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `controls` | boolean | true | Show navigation arrows (bottom-right) |
| `progress` | boolean | true | Show progress bar |
| `slideNumber` | boolean | false | Show current slide number |
| `keyboard` | boolean | true | Enable keyboard navigation |
| `touch` | boolean | true | Enable touch navigation |
| `mouseWheel` | boolean | false | Enable mouse wheel navigation |
| `history` | boolean | false | Push slide changes to browser history |
| `overview` | boolean | true | Enable slide overview mode |
| `help` | boolean | true | Show help overlay on `?` key |

### Transitions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transition` | string | `default` | Slide transition: `none`, `fade`, `slide`, `convex`, `concave`, `zoom` |
| `transitionSpeed` | string | `default` | Speed: `default`, `fast`, `slow` |
| `backgroundTransition` | string | `default` | Background transition style |

### Auto-Play

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoSlide` | number | 0 | Auto-advance interval (ms). 0 = disabled. |
| `autoSlideStoppable` | boolean | true | Allow user to pause auto-advance |
| `loop` | boolean | false | Loop back to first slide after last |

### Advanced

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fragments` | boolean | true | Enable fragment animations globally |
| `embedded` | boolean | false | Embedded mode (partial page) |
| `rtl` | boolean | false | Right-to-left layout |
| `shuffle` | boolean | false | Randomize slide order |
| `previewLinks` | boolean | false | Open links in iframe overlay |
| `viewDistance` | number | 3 | Number of slides to pre-render |
| `enableSpeakerNotes` | boolean | false | Enable speaker notes panel |

### Parallax Background

| Option | Type | Description |
|--------|------|-------------|
| `parallaxBackgroundImage` | string | URL to parallax background image |
| `parallaxBackgroundSize` | string | CSS background-size value |
| `parallaxBackgroundHorizontal` | number | Horizontal parallax scroll amount |
| `parallaxBackgroundVertical` | number | Vertical parallax scroll amount |

## Built-in Themes

12 themes available: `beige`, `black`, `blood`, `league`, `moon`, `night`, `serif`, `simple`, `sky`, `solarized`, `white`, `none`

Set via frontmatter:
```yaml
presentation:
  theme: night.css
```

Or via VS Code setting `revealjsTheme`.

## Per-Slide Customization

Add `id` and `class` attributes to individual slides:

```markdown
<!-- slide id="intro" class="centered dark" -->
```

Target in CSS using:
```less
.slides > section#intro { background: #1a1a1a; }
.slides > section:nth-child(2) { font-size: 1.2em; }
```

## Fragments

Fragments reveal content incrementally within a slide:

```html
<p class="fragment">Appears first</p>
<p class="fragment">Appears second</p>
```

Fragment styles: `fade-in`, `fade-out`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `grow`, `shrink`, `strike`, `highlight-red`, `highlight-green`, `highlight-blue`

## Speaker Notes

Enable in frontmatter:
```yaml
presentation:
  enableSpeakerNotes: true
```

Add notes per slide:
```markdown
<!-- slide -->
# My Slide

Content here

Note: These are speaker notes, only visible in speaker view.
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `Right` / `Down` | Next slide |
| `Left` / `Up` | Previous slide |
| `Esc` / `O` | Toggle overview |
| `S` | Open speaker notes |
| `F` | Toggle fullscreen |
| `?` | Show keyboard help |
| `B` / `.` | Blackout/pause |

## Deployment

Exported presentations use CDN-hosted reveal.js resources. For offline/local deployment:

1. Export with "HTML (offline)" to bundle all assets
2. Or host reveal.js resources on your own server

For GitHub Pages or remote hosting, use the CDN export mode.

## Gotchas

- The first `<!-- slide -->` separator is required -- content before it won't appear
- Speaker notes require `enableSpeakerNotes: true` in frontmatter
- Transitions and animations may not render in PDF export
- Theme CSS overrides go in `style.less` under `.reveal .slides { }` selector
- Large images in slides can cause performance issues -- optimize beforehand
