/**
 * Shared types for biome-runner hooks.
 *
 * Hook input utilities are re-exported from @sidequest/core/hooks.
 */

// Re-export hook utilities from core (eliminates duplication with tsc-runner)
export {
	extractFilePaths,
	type HookInput,
	parseHookInput,
} from "@sidequest/marketplace-core/hooks";
