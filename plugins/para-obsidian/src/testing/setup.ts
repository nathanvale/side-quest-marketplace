/**
 * Global test setup - preloaded via bunfig.toml
 *
 * This file is automatically loaded before all tests to:
 * - Suppress log output for clean test output
 * - Configure test environment
 *
 * @module testing/setup
 */

import { beforeEach } from "bun:test";
import { setupTestLogging } from "./logger.js";

// Suppress logs before each test to ensure clean state
beforeEach(async () => {
	await setupTestLogging();
});
