/**
 * UI functionality for inbox processing
 */

// Re-export main CLI adapter functionality
export type { InteractiveOptions } from "./cli-adapter";
export {
	displayResults,
	formatConfidence,
	formatSuggestion,
	formatSuggestionsTable,
	getHelpText,
	parseCommand,
	runInteractiveLoop,
} from "./cli-adapter";
