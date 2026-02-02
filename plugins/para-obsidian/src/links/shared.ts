/**
 * Shared utilities for link operations.
 *
 * This module provides common functions used across link-related modules
 * to avoid code duplication.
 *
 * @module links/shared
 */
import { globFilesSync } from "@side-quest/core/glob";

/**
 * Recursively lists all Markdown files in a directory.
 *
 * Uses glob for efficient pattern matching. Returns absolute paths.
 *
 * @param root - Directory to scan
 * @returns Array of absolute paths to .md files
 *
 * @example
 * ```typescript
 * const files = listMarkdownFiles('/vault');
 * // ['/vault/Projects/Note.md', '/vault/Areas/Work.md', ...]
 * ```
 */
export function listMarkdownFiles(root: string): string[] {
	return globFilesSync("**/*.md", { cwd: root });
}
