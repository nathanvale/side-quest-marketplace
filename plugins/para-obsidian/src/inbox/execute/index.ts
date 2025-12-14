/**
 * Execution functionality for applying approved suggestions
 */

// Re-export execution functions from engine
export type {
	ExecutionResult,
	ProcessorResult,
} from "../types";

// The main execution logic is currently in engine.ts
// In the future, this will be broken out into separate files:
// - executor.ts - main execution orchestration
// - attachment-mover.ts - file operations
// - note-creator.ts - note creation from suggestions
