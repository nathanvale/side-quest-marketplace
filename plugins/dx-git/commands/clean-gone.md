---
description: Delete local branches whose remote tracking branch is gone
model: sonnet
allowed-tools: Bash(git fetch:*), Bash(git for-each-ref:*), Bash(git branch -d:*), Bash(git worktree list:*), Bash(git worktree prune:*), Bash(git worktree remove:*), Bash(git rev-parse:*), Bash(git symbolic-ref:*), Bash(git commit-tree:*), Bash(git merge-base:*), Bash(git config --get:*), Bash(git config --get-all:*), Bash(gh repo view:*)
argument-hint: "[--confirm]"
---

Use the **workflow** skill to clean up local branches whose remote tracking branch has been deleted. $ARGUMENTS
