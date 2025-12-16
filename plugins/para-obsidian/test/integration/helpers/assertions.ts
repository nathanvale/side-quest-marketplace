/**
 * ADHD-Friendly Assertion Helpers for Integration Tests
 *
 * These helpers provide rich error context when tests fail, reducing debug time
 * from 5 minutes to 10 seconds by showing:
 * - WHAT was expected vs ACTUAL state
 * - WHERE to find created files
 * - WHY the assertion failed
 *
 * Design Philosophy:
 * - Show ALL context on failure (created files, diffs, paths)
 * - Use visual formatting (tables, colors) for quick scanning
 * - Include actionable next steps in error messages
 *
 * @module test/integration/helpers/assertions
 */

import { expect } from "bun:test";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { pathExists } from "@sidequest/core/fs";
import { glob } from "glob";
import { parseFrontmatter } from "../../../src/frontmatter/parse";
import type { ExecutionResult } from "../../../src/inbox/types";

/**
 * Assert that a note exists with rich failure context.
 *
 * On failure, this helper shows ALL created files in the vault
 * so you can quickly see what WAS created vs what was expected.
 *
 * **Why this helps ADHD:**
 * - No need to manually ls the test vault
 * - Visual confirmation of what exists
 * - Immediate context for debugging path issues
 *
 * @param vaultPath - Absolute path to test vault
 * @param relativePath - Vault-relative path to expected note (e.g., "01 Projects/MyNote.md")
 * @param context - Optional context string to help identify which test step failed
 * @throws AssertionError with list of all created files when note is missing
 *
 * @example
 * ```typescript
 * // Assert booking note was created
 * await assertNoteExists(
 *   vaultPath,
 *   "01 Projects/Travel/20250315_Flight-to-MEL.md",
 *   "after executing booking suggestion"
 * );
 * ```
 */
export async function assertNoteExists(
	vaultPath: string,
	relativePath: string,
	context?: string,
): Promise<void> {
	const absolutePath = path.join(vaultPath, relativePath);
	const exists = await pathExists(absolutePath);

	if (!exists) {
		// Gather ALL created files to show what WAS created
		const allMarkdownFiles = await glob("**/*.md", {
			cwd: vaultPath,
			ignore: ["Templates/**", "node_modules/**"],
		});

		const contextStr = context ? ` (${context})` : "";
		const errorMsg = [
			`\nNote does not exist${contextStr}:`,
			`  Expected: ${relativePath}`,
			"",
			"Files that DO exist in vault:",
			allMarkdownFiles.length > 0
				? allMarkdownFiles
						.sort()
						.map((f) => `  - ${f}`)
						.join("\n")
				: "  (no .md files found)",
			"",
			"Debugging tips:",
			"  1. Check if note was created in different location",
			"  2. Verify template path is correct",
			"  3. Check for filename sanitization issues",
			"  4. Review execute logs for creation errors",
		].join("\n");

		throw new Error(errorMsg);
	}
}

/**
 * Assert that frontmatter contains expected fields with visual diff on mismatch.
 *
 * Shows ACTUAL vs EXPECTED side-by-side with highlighting of differences.
 * Deep compares nested objects and arrays.
 *
 * **Why this helps ADHD:**
 * - No need to manually read the file and compare
 * - Visual diff shows EXACTLY what's wrong
 * - Clear action: fix the field that differs
 *
 * @param notePath - Absolute path to note file
 * @param expected - Expected frontmatter fields (partial match - only checks provided fields)
 * @throws AssertionError with visual diff when frontmatter doesn't match
 *
 * @example
 * ```typescript
 * await assertFrontmatterMatches(
 *   "/vault/Projects/MyNote.md",
 *   {
 *     title: "Expected Title",
 *     documentType: "booking",
 *     tags: ["travel", "flight"]
 *   }
 * );
 * ```
 */
export async function assertFrontmatterMatches(
	notePath: string,
	expected: Record<string, unknown>,
): Promise<void> {
	const exists = await pathExists(notePath);
	if (!exists) {
		throw new Error(
			`\nCannot check frontmatter - file does not exist:\n  ${notePath}\n\nCall assertNoteExists() first to verify file creation.`,
		);
	}

	const content = await readFile(notePath, "utf-8");
	const { attributes: actual } = parseFrontmatter(content);

	// Compare only the fields specified in expected (allows partial match)
	const mismatches: string[] = [];

	for (const [key, expectedValue] of Object.entries(expected)) {
		const actualValue = actual[key];

		// Deep comparison using JSON serialization
		const expectedJson = JSON.stringify(expectedValue, null, 2);
		const actualJson = JSON.stringify(actualValue, null, 2);

		if (expectedJson !== actualJson) {
			mismatches.push(`  ${key}:`);
			mismatches.push(`    Expected: ${expectedJson}`);
			mismatches.push(`    Actual:   ${actualJson}`);
		}
	}

	if (mismatches.length > 0) {
		const errorMsg = [
			"\nFrontmatter mismatch:",
			`  File: ${notePath}`,
			"",
			"Differences:",
			...mismatches,
			"",
			"Full actual frontmatter:",
			JSON.stringify(actual, null, 2)
				.split("\n")
				.map((line) => `  ${line}`)
				.join("\n"),
			"",
			"Debugging tips:",
			"  1. Check LLM extraction output for field parsing issues",
			"  2. Verify template contains correct field names",
			"  3. Check classifier field requirements",
			"  4. Review suggestion builder logic",
		].join("\n");

		throw new Error(errorMsg);
	}
}

/**
 * Assert that an inbox file was removed (cleanup verification).
 *
 * On failure, lists ALL remaining inbox files to help identify
 * which files weren't processed/cleaned up as expected.
 *
 * **Why this helps ADHD:**
 * - Quick visual scan of what's still in inbox
 * - Immediate identification of cleanup bugs
 * - No manual file listing required
 *
 * @param vaultPath - Absolute path to test vault
 * @param filename - Inbox filename (no path, e.g., "MyDocument.pdf")
 * @throws AssertionError with list of remaining inbox files when file still exists
 *
 * @example
 * ```typescript
 * // Verify inbox was cleaned up after successful execution
 * await assertInboxCleanedUp(vaultPath, "Booking-Confirmation.pdf");
 * ```
 */
export async function assertInboxCleanedUp(
	vaultPath: string,
	filename: string,
): Promise<void> {
	const inboxPath = path.join(vaultPath, "00 Inbox", filename);
	const exists = await pathExists(inboxPath);

	if (exists) {
		// Show what's still in inbox to help debug cleanup issues
		const remainingFiles = await glob("**/*", {
			cwd: path.join(vaultPath, "00 Inbox"),
			nodir: true,
		});

		const errorMsg = [
			"\nInbox file was NOT cleaned up:",
			`  File: ${filename}`,
			"",
			"Remaining inbox files:",
			remainingFiles.length > 0
				? remainingFiles
						.sort()
						.map((f) => `  - ${f}`)
						.join("\n")
				: "  (inbox is empty)",
			"",
			"Debugging tips:",
			"  1. Check execute() cleanup logic",
			"  2. Verify file was moved to Attachments",
			"  3. Check for permission errors during cleanup",
			"  4. Review transaction rollback logs",
		].join("\n");

		throw new Error(errorMsg);
	}
}

/**
 * Assert that execution succeeded with structured error details.
 *
 * Shows WHICH step failed and WHY, plus full result context
 * to help identify the root cause of execution failures.
 *
 * **Why this helps ADHD:**
 * - No need to dig through execution logs
 * - Clear failure point identification
 * - Action-oriented error messages
 *
 * @param result - Execution result from engine.execute()
 * @param expectedNotePath - Expected vault-relative path to created note
 * @throws AssertionError with structured failure details when execution failed
 *
 * @example
 * ```typescript
 * const [result] = await engine.execute([suggestionId]);
 * assertExecutionSuccess(
 *   result,
 *   "01 Projects/Travel/20250315_Flight.md"
 * );
 * ```
 */
export function assertExecutionSuccess(
	result: ExecutionResult,
	expectedNotePath: string,
): void {
	if (!result.success) {
		const errorMsg = [
			"\nExecution FAILED:",
			`  Action: ${result.action}`,
			`  Suggestion ID: ${result.suggestionId}`,
			`  Error: ${result.error}`,
			"",
			"Expected to create:",
			`  ${expectedNotePath}`,
			"",
			"Debugging tips:",
			"  1. Check template exists and is valid",
			"  2. Verify vault directories exist",
			"  3. Check for permission issues",
			"  4. Review suggestion field requirements",
			"  5. Check staging directory for partial files",
		].join("\n");

		throw new Error(errorMsg);
	}

	// Verify note was actually created at expected path
	if (result.createdNote) {
		const actualPath = result.createdNote;

		// Use expect() for nice diff output if paths don't match
		try {
			expect(actualPath).toContain(expectedNotePath);
		} catch (_error) {
			const errorMsg = [
				"\nExecution succeeded but note created at WRONG path:",
				`  Expected: ${expectedNotePath}`,
				`  Actual:   ${actualPath}`,
				"",
				"Debugging tips:",
				"  1. Check filename generation logic",
				"  2. Verify destination folder resolution",
				"  3. Check for path sanitization issues",
				"  4. Review suggestion builder destination logic",
			].join("\n");

			throw new Error(errorMsg);
		}
	}
}

/**
 * Assert that multiple notes exist with batch error reporting.
 *
 * Checks all paths at once and reports ALL missing files in a single
 * error message, avoiding the frustration of fixing one path at a time.
 *
 * **Why this helps ADHD:**
 * - See all failures at once (no iterative fixing)
 * - Batch context is more efficient
 * - Quick scan of what's missing
 *
 * @param vaultPath - Absolute path to test vault
 * @param relativePaths - Array of vault-relative paths to check
 * @param context - Optional context for the batch check
 * @throws AssertionError listing ALL missing notes when any are missing
 *
 * @example
 * ```typescript
 * await assertNotesExist(vaultPath, [
 *   "01 Projects/Travel/Flight.md",
 *   "01 Projects/Travel/Hotel.md",
 *   "01 Projects/Travel/Car.md"
 * ], "after processing travel batch");
 * ```
 */
export async function assertNotesExist(
	vaultPath: string,
	relativePaths: string[],
	context?: string,
): Promise<void> {
	const missing: string[] = [];

	for (const relativePath of relativePaths) {
		const absolutePath = path.join(vaultPath, relativePath);
		const exists = await pathExists(absolutePath);
		if (!exists) {
			missing.push(relativePath);
		}
	}

	if (missing.length > 0) {
		// Gather ALL created files for comparison
		const allMarkdownFiles = await glob("**/*.md", {
			cwd: vaultPath,
			ignore: ["Templates/**", "node_modules/**"],
		});

		const contextStr = context ? ` (${context})` : "";
		const errorMsg = [
			`\n${missing.length} note(s) missing${contextStr}:`,
			...missing.map((p) => `  ✗ ${p}`),
			"",
			"Files that DO exist in vault:",
			allMarkdownFiles.length > 0
				? allMarkdownFiles
						.sort()
						.map((f) => `  - ${f}`)
						.join("\n")
				: "  (no .md files found)",
			"",
			"Debugging tips:",
			"  1. Check batch execution didn't fail partway",
			"  2. Verify all templates exist",
			"  3. Check for permission errors",
			"  4. Review execution logs for individual failures",
		].join("\n");

		throw new Error(errorMsg);
	}
}

/**
 * Assert that frontmatter fields exist (without checking values).
 *
 * Useful for tests that only care about field presence, not specific values.
 * Shows which required fields are missing.
 *
 * **Why this helps ADHD:**
 * - Quick structural validation
 * - Clear missing field identification
 * - No noise from value mismatches
 *
 * @param notePath - Absolute path to note file
 * @param requiredFields - Array of field names that must exist
 * @throws AssertionError listing missing fields
 *
 * @example
 * ```typescript
 * await assertFrontmatterHasFields(
 *   "/vault/Projects/MyNote.md",
 *   ["title", "documentType", "createdAt"]
 * );
 * ```
 */
export async function assertFrontmatterHasFields(
	notePath: string,
	requiredFields: string[],
): Promise<void> {
	const exists = await pathExists(notePath);
	if (!exists) {
		throw new Error(
			`\nCannot check frontmatter - file does not exist:\n  ${notePath}`,
		);
	}

	const content = await readFile(notePath, "utf-8");
	const { attributes } = parseFrontmatter(content);

	const missing = requiredFields.filter((field) => !(field in attributes));

	if (missing.length > 0) {
		const errorMsg = [
			"\nRequired frontmatter fields missing:",
			`  File: ${notePath}`,
			"",
			"Missing fields:",
			...missing.map((f) => `  ✗ ${f}`),
			"",
			"Present fields:",
			...Object.keys(attributes).map((f) => `  ✓ ${f}`),
			"",
			"Debugging tips:",
			"  1. Check template contains all required fields",
			"  2. Verify classifier field definitions",
			"  3. Check LLM extraction output",
			"  4. Review suggestion builder field mapping",
		].join("\n");

		throw new Error(errorMsg);
	}
}

/**
 * Assert that attachment was moved to correct location.
 *
 * Verifies both that the file exists in Attachments folder
 * and was removed from inbox.
 *
 * **Why this helps ADHD:**
 * - Single assertion for move operation
 * - Clear before/after verification
 * - No manual path checking needed
 *
 * @param vaultPath - Absolute path to test vault
 * @param inboxFilename - Original filename in inbox
 * @param expectedAttachmentPath - Expected vault-relative path in Attachments
 * @throws AssertionError if file wasn't moved correctly
 *
 * @example
 * ```typescript
 * await assertAttachmentMoved(
 *   vaultPath,
 *   "booking.pdf",
 *   "Attachments/20250315_booking.pdf"
 * );
 * ```
 */
export async function assertAttachmentMoved(
	vaultPath: string,
	inboxFilename: string,
	expectedAttachmentPath: string,
): Promise<void> {
	const inboxPath = path.join(vaultPath, "00 Inbox", inboxFilename);
	const attachmentPath = path.join(vaultPath, expectedAttachmentPath);

	const stillInInbox = await pathExists(inboxPath);
	const existsInAttachments = await pathExists(attachmentPath);

	if (stillInInbox || !existsInAttachments) {
		// Gather context for debugging
		const allAttachments = await glob("**/*", {
			cwd: path.join(vaultPath, "Attachments"),
			nodir: true,
		});

		const errorMsg = [
			"\nAttachment was NOT moved correctly:",
			`  Original: ${inboxFilename}`,
			`  Expected: ${expectedAttachmentPath}`,
			"",
			"Status:",
			`  Still in inbox? ${stillInInbox ? "YES ✗" : "NO ✓"}`,
			`  In Attachments? ${existsInAttachments ? "YES ✓" : "NO ✗"}`,
			"",
			"Files in Attachments folder:",
			allAttachments.length > 0
				? allAttachments
						.sort()
						.map((f) => `  - ${f}`)
						.join("\n")
				: "  (no files found)",
			"",
			"Debugging tips:",
			"  1. Check attachment-mover.ts move operation",
			"  2. Verify Attachments folder exists",
			"  3. Check for permission errors",
			"  4. Review transaction logs for move failures",
		].join("\n");

		throw new Error(errorMsg);
	}
}
