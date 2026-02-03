/**
 * Shared types and utilities for Claude Code hooks.
 */

/**
 * Hook input contract from Claude Code PostToolUse events.
 * This is a partial type modeling only the file-related fields we use.
 *
 * @see https://docs.anthropic.com/en/docs/claude-code/hooks#posttooluse-input
 */
export interface HookInput {
	tool_name: string;
	tool_input?: {
		file_path?: string;
		edits?: Array<{ file_path: string }>;
	};
}

/**
 * Parsed TypeScript compiler error.
 */
export interface TscError {
	file: string;
	line: number;
	col: number;
	message: string;
}

/**
 * Result of parsing TypeScript compiler output.
 */
export interface TscParseResult {
	errorCount: number;
	errors: TscError[];
}

/**
 * Extract file paths from hook input.
 * Handles both single file (Write) and multiple files (Edit/MultiEdit).
 *
 * @param hookInput - The parsed hook input from stdin
 * @returns Array of file paths from the tool input
 */
export function extractFilePaths(hookInput: HookInput): string[] {
	const filePaths: string[] = [];

	// Guard against missing tool_input (some hook events may not have it)
	if (!hookInput.tool_input) {
		return filePaths;
	}

	if (hookInput.tool_input.file_path) {
		filePaths.push(hookInput.tool_input.file_path);
	}

	if (hookInput.tool_input.edits) {
		for (const edit of hookInput.tool_input.edits) {
			if (edit.file_path && !filePaths.includes(edit.file_path)) {
				filePaths.push(edit.file_path);
			}
		}
	}

	return filePaths;
}

/**
 * Parse hook input from stdin JSON.
 * Returns null if parsing fails (graceful degradation).
 *
 * @param input - Raw stdin text
 * @returns Parsed HookInput or null if invalid
 */
export function parseHookInput(input: string): HookInput | null {
	try {
		return JSON.parse(input) as HookInput;
	} catch {
		return null;
	}
}
