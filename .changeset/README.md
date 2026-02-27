# Changesets

This folder contains changeset files that describe changes to be included in the
next release.

## What is a Changeset?

A changeset is a piece of information about changes made in a branch or commit.
It holds three key pieces of information:

1. **What packages to update**
2. **What type of version bump** to apply (major, minor, or patch)
3. **A summary of the changes** (appears in CHANGELOG.md)

## Creating a Changeset

When you make a change that should be included in the release notes, create a
changeset:

```bash
bun run version:gen
# or: bunx changeset
```

This will prompt you to:

1. Select the package(s) to version
2. Choose the version bump type:
   - **patch** (0.0.x): Bug fixes, performance improvements
   - **minor** (0.x.0): New features, backward-compatible changes
   - **major** (x.0.0): Breaking changes
3. Write a summary describing the change

## When to Create a Changeset

**DO create a changeset for:**

- New features (`feat`)
- Bug fixes (`fix`)
- Breaking changes (`feat!` or with `BREAKING CHANGE:` footer)
- Performance improvements (`perf`)

**DON'T create a changeset for:**

- Documentation updates (`docs`)
- Code style changes (`style`)
- Internal refactoring (`refactor`)
- Test updates (`test`)
- Build/CI changes (`build`, `ci`, `chore`)

## Changeset File Format

Changesets are markdown files with frontmatter:

```markdown
---
'your-package-name': minor
---

Add JSON export format
```

## Release Process

1. Create changesets for your changes
2. Commit and push to your branch
3. Open a pull request
4. When merged to `main`, GitHub Actions will:
   - Detect the changeset
   - Create/update a "Version Packages" PR
   - Update `package.json` version
   - Generate `CHANGELOG.md` entries
5. Merge the "Version Packages" PR to publish

## Changeset Bot

The [Changeset Bot](https://github.com/apps/changeset-bot) GitHub App comments on every PR
with changeset status. Install it on your repo for instant feedback:

https://github.com/apps/changeset-bot

The bot works alongside `autogenerate-changeset.yml` — the bot comments instantly with
status, and the workflow auto-generates a changeset file if one is missing.

## More Information

See [Changesets Documentation](https://github.com/changesets/changesets)
