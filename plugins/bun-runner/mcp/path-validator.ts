/**
 * Path validation utilities for MCP tools.
 *
 * Re-exports path validation from @sidequest/core/validation.
 * This file exists for backward compatibility with existing imports.
 *
 * Why: MCP tools accept file paths and patterns from potentially untrusted input
 * (Claude's tool calls). Without validation, attackers could use path traversal
 * (e.g., "../../etc/passwd") to access or modify files outside the repository.
 *
 * Defense strategy:
 * 1. Resolve paths to absolute form
 * 2. Verify resolved path is within git repository
 * 3. Reject patterns containing shell metacharacters
 */

export {
	validatePath,
	validatePathOrDefault,
} from "@side-quest/core/validation";
