/**
 * Execution Module
 *
 * Provides functionality for executing approved inbox suggestions:
 * - Moving attachments with dated filenames
 * - Creating notes from templates
 * - Injecting attachment links into notes
 *
 * @module inbox/execute
 */

// Re-export types from main types file
export type { ExecutionResult, ProcessorResult } from "../types";
export { injectAttachmentLink } from "./attachment-linker";
export { moveAttachment } from "./attachment-mover";
// Re-export execution functions
export {
	executeSuggestion,
	generateDatedFilename,
	rollbackNote,
} from "./executor";
export { createNoteFromSuggestion } from "./note-creator";
// Re-export execution-specific types
export type {
	AttachmentLinkResult,
	AttachmentMoveResult,
	ExecutionConfig,
	ExecutionContext,
	NoteCreationResult,
} from "./types";
