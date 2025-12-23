/**
 * Inbox Engine Tests
 *
 * Main test suite that imports focused test modules.
 * This is a transitional file that consolidates all engine tests.
 *
 * Test organization:
 * - engine-factory.test.ts - Factory function and configuration tests
 * - engine-scan.test.ts - Scan functionality and filesystem operations
 * - engine-execute.test.ts - Execute functionality and collision handling
 * - engine-other.test.ts - Utility methods (editWithPrompt, challenge, generateReport)
 */

import { afterEach, mock } from "bun:test";

// Ensure all mocks are cleaned up after each test
// This is a safety net in case tests are added directly to this file
afterEach(() => {
	mock.restore();
});

// Import all test suites to run them as part of the main test run
import "./engine-factory.test";
import "./engine-scan.test";
import "./engine-execute.test";
import "./engine-other.test";

// The individual test files contain the actual test implementations
// This file serves as the entry point for all engine tests
