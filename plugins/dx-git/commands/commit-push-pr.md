---
description: Commit, push, and create a pull request in one workflow
model: sonnet
allowed-tools: Bash(git status:*), Bash(git add:*), Bash(git diff:*), Bash(git log:*), Bash(git commit:*), Bash(git push:*), Bash(git reset --soft:*), Bash(git merge-base:*), Bash(git branch --show-current:*), Bash(git symbolic-ref:*), Bash(git rev-list:*), Bash(git fetch:*), Bash(git remote:*), Bash(git config --get:*), Bash(gh pr create:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(gh auth status:*), Bash(bun run validate:*)
argument-hint: "[description] [--draft] [--skip-validate]"
---

Use the **workflow** skill to commit, push, and create a pull request in one workflow. $ARGUMENTS
