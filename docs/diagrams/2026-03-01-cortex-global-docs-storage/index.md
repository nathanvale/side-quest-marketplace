---
created: 2026-03-01
title: "Cortex Global Docs Storage"
type: diagram
tags: [cortex, storage, xdg, config, architecture]
project: side-quest-marketplace
status: draft
source: docs/brainstorms/2026-02-28-cortex-global-docs-storage.md
---

# Cortex Global Docs Storage

Mind map of the brainstorm exploring where Cortex global docs should live after the plugin moved from a standalone repo into side-quest-marketplace.

**Preset:** Sketch (warm tones, hand-drawn feel)
**Paper:** A4 landscape

```mermaid
mindmap
  root((Cortex Global<br/>Docs Storage))
    (Problem)
      [Plugin moved to marketplace]
      [Can't ship personal docs<br/>in community plugin]
      [Users need own<br/>global docs location]
    (Approaches)
      [1. Dedicated repo]
        )Rejected - architecture drift(
      [2. ~/.cortex/docs/]
        )No git by default(
        )Custom dot-directory(
      [3. ~/.config/cortex/docs/]
        )XDG convention(
        )Dotfiles managers(
      [4. Configurable + default]
        ))Chosen((
    (Decision)
      [XDG default<br/>~/.config/cortex/]
      [docs_path in config.yaml]
      [Zero lock-in]
      [cortex init creates it]
    (Config Structure)
      [config.yaml]
        )docs_path setting(
        )sources array(
      [docs/ subdirectory]
        )research/(
        )brainstorms/(
        )plans/(
        )decisions/(
    (Community Research)
      [Git winning for<br/>developer PKM]
      [No consensus on<br/>global notes location]
      [XDG standard for<br/>tool configs]
      [Stow + chezmoi<br/>for dotfiles]
```
