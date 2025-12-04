/**
 * Shared constants for bun-runner test hooks.
 */

/**
 * File extensions for test files that trigger test hooks.
 * Only .test.ts and .test.tsx files will run automated tests.
 */
export const TEST_FILE_EXTENSIONS = [".test.ts", ".test.tsx"];

/**
 * Timeout for single-file test runs (PostToolUse hook).
 * Shorter timeout since we're only running one file.
 */
export const TEST_FILE_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Timeout for comprehensive test runs (Stop hook).
 * Longer timeout to handle multiple test files.
 */
export const TEST_CI_TIMEOUT_MS = 60_000; // 60 seconds
