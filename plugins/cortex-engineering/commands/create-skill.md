---
name: create-skill
description: Creates, audits, or improves Claude Code skills and commands. Use when scaffolding a new skill, reviewing an existing skill against best practices, or adding components like references, workflows, or templates.
argument-hint: [action]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Bash(mkdir *), Bash(ls *), Bash(chmod *)
---

Use the **skill-authoring** skill to guide skill creation, auditing, or improvement.

create $ARGUMENTS
