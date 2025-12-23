/**
 * Routing Module
 *
 * Handles automatic routing of notes from inbox to PARA folders
 * based on frontmatter area/project fields.
 *
 * @module inbox/routing
 */

// Executor
export { moveNote } from "./executor";
export type { ResolvedDestination } from "./resolver";
// Resolver
export { resolveDestination } from "./resolver";
// Context
export type { RoutingContext } from "./scanner";
// Scanner
export { scanForRoutableNotes } from "./scanner";
// Types
export type {
	RoutingCandidate,
	RoutingResult,
	RoutingScanResult,
} from "./types";
