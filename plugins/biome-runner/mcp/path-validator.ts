/**
 * Path validation utilities for MCP tools.
 *
 * Re-exports validation utilities from @sidequest/core/validation
 * for backward compatibility.
 */

// Re-export validation utilities from @sidequest/core/validation
export {
	SHELL_METACHARACTERS,
	validatePath,
	validatePathOrDefault,
	validateShellSafePattern as validatePattern,
} from "@sidequest/core/validation";
