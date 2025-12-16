/**
 * Integration Test Helpers
 *
 * @example
 * ```typescript
 * import { createTestHarness, assertNoteExists } from "../helpers"
 * ```
 */

// Custom assertions
export {
	assertExecutionSuccess,
	assertFrontmatterMatches,
	assertInboxCleanedUp,
	assertNoteExists,
} from "./assertions";
// Test harness
export {
	createTestHarness,
	type IntegrationTestHarness,
	type TestHarnessOptions,
} from "./test-harness";
