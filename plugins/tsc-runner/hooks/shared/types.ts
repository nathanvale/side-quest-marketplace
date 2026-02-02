/**
 * Shared types for tsc-runner hooks.
 *
 * Hook input utilities are re-exported from @sidequest/core/hooks.
 * TSC-specific types are defined locally.
 */

// Re-export hook utilities from core (eliminates duplication with biome-runner)
export {
	extractFilePaths,
	type HookInput,
	parseHookInput,
} from "@sidequest/core/hooks";

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
