#!/usr/bin/env bun
/**
 * Pre-commit hook script to detect missing cleanup patterns in test files.
 *
 * Checks for:
 * 1. Tests using createTestVault without cleanup (useTestVaultCleanup or afterEach/afterAll)
 * 2. Mock usage without mock.restore() calls
 * 3. Environment variable modifications without restoration
 *
 * Usage:
 *   bun run scripts/check-test-cleanup.ts [--fix]
 *
 * Exit codes:
 *   0 - All checks pass
 *   1 - Issues found (without --fix)
 *   2 - Script error
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

interface Issue {
	file: string;
	line: number;
	type: "vault-cleanup" | "mock-cleanup" | "env-cleanup";
	message: string;
}

const SRC_DIR = join(import.meta.dir, "../src");

function findTestFiles(dir: string): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			files.push(...findTestFiles(fullPath));
		} else if (entry.endsWith(".test.ts")) {
			files.push(fullPath);
		}
	}

	return files;
}

function checkFile(filePath: string): Issue[] {
	const issues: Issue[] = [];
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const relativePath = relative(process.cwd(), filePath);

	// Check for createTestVault usage without cleanup
	// Only check if createTestVault is actually called (not just imported)
	const createVaultCallPattern = /createTestVault\s*\(/;
	const hasCreateTestVaultCall = createVaultCallPattern.test(content);
	const hasUseTestVaultCleanup = content.includes("useTestVaultCleanup");
	const hasCleanupTestVault = content.includes("cleanupTestVault");
	const hasAfterEach = content.includes("afterEach");
	const hasAfterAll = content.includes("afterAll");
	const hasWithTempVault = content.includes("withTempVault");
	// onTestFinished from Bun provides per-test cleanup
	const hasOnTestFinished = content.includes("onTestFinished");

	if (hasCreateTestVaultCall) {
		// Check if there's proper cleanup
		const hasProperCleanup =
			hasUseTestVaultCleanup ||
			hasWithTempVault ||
			hasOnTestFinished ||
			(hasCleanupTestVault && (hasAfterEach || hasAfterAll));

		if (!hasProperCleanup) {
			// Find the first occurrence of createTestVault call
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && createVaultCallPattern.test(line)) {
					issues.push({
						file: relativePath,
						line: i + 1,
						type: "vault-cleanup",
						message:
							"createTestVault used without proper cleanup. Use useTestVaultCleanup(), withTempVault(), onTestFinished, or cleanupTestVault in afterEach/afterAll.",
					});
					break; // Only report once per file
				}
			}
		}
	}

	// Check for mock() usage without restore
	const mockMatches = content.match(/\bmock\s*\(/g);
	const restoreMatches = content.match(/\.restore\s*\(\s*\)/g);
	const mockRestoreMatches = content.match(/mock\.restore\s*\(\s*\)/g);

	if (mockMatches && mockMatches.length > 0) {
		const hasRestore =
			(restoreMatches && restoreMatches.length > 0) ||
			(mockRestoreMatches && mockRestoreMatches.length > 0);

		if (!hasRestore) {
			// Find the first mock usage
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && /\bmock\s*\(/.test(line)) {
					issues.push({
						file: relativePath,
						line: i + 1,
						type: "mock-cleanup",
						message:
							"mock() used without mock.restore(). Add mock.restore() in afterEach or use onTestFinished.",
					});
					break;
				}
			}
		}
	}

	// Check for process.env modifications without restoration
	const envSetPattern = /process\.env\.\w+\s*=/;
	const hasEnvModification = envSetPattern.test(content);

	if (hasEnvModification) {
		// Check if there's environment restoration pattern
		const hasEnvRestore =
			content.includes("originalEnv") ||
			content.includes("delete process.env") ||
			content.includes("useTestVaultCleanup") || // This utility handles env cleanup
			content.includes("withTempVault"); // This utility handles env cleanup

		if (!hasEnvRestore) {
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && envSetPattern.test(line)) {
					issues.push({
						file: relativePath,
						line: i + 1,
						type: "env-cleanup",
						message:
							"process.env modified without restoration. Save original value and restore in afterEach/afterAll.",
					});
					break;
				}
			}
		}
	}

	return issues;
}

function main(): number {
	const testFiles = findTestFiles(SRC_DIR);
	const allIssues: Issue[] = [];

	console.log(
		`Checking ${testFiles.length} test files for cleanup patterns...\n`,
	);

	for (const file of testFiles) {
		const issues = checkFile(file);
		allIssues.push(...issues);
	}

	if (allIssues.length === 0) {
		console.log("✅ All test files have proper cleanup patterns.\n");
		return 0;
	}

	console.log(`❌ Found ${allIssues.length} cleanup issues:\n`);

	// Group by type
	const byType = {
		"vault-cleanup": allIssues.filter((i) => i.type === "vault-cleanup"),
		"mock-cleanup": allIssues.filter((i) => i.type === "mock-cleanup"),
		"env-cleanup": allIssues.filter((i) => i.type === "env-cleanup"),
	};

	if (byType["vault-cleanup"].length > 0) {
		console.log(
			`\n## Vault Cleanup Issues (${byType["vault-cleanup"].length}):\n`,
		);
		for (const issue of byType["vault-cleanup"]) {
			console.log(`  ${issue.file}:${issue.line}`);
			console.log(`    → ${issue.message}\n`);
		}
	}

	if (byType["mock-cleanup"].length > 0) {
		console.log(
			`\n## Mock Cleanup Issues (${byType["mock-cleanup"].length}):\n`,
		);
		for (const issue of byType["mock-cleanup"]) {
			console.log(`  ${issue.file}:${issue.line}`);
			console.log(`    → ${issue.message}\n`);
		}
	}

	if (byType["env-cleanup"].length > 0) {
		console.log(
			`\n## Environment Cleanup Issues (${byType["env-cleanup"].length}):\n`,
		);
		for (const issue of byType["env-cleanup"]) {
			console.log(`  ${issue.file}:${issue.line}`);
			console.log(`    → ${issue.message}\n`);
		}
	}

	console.log("\n## How to Fix:\n");
	console.log(
		"1. Vault cleanup: Import and use `useTestVaultCleanup()` from testing/utils.ts",
	);
	console.log(
		"2. Mock cleanup: Add `afterEach(() => mock.restore())` or use `onTestFinished`",
	);
	console.log(
		"3. Env cleanup: Save original value before modifying, restore in afterEach/afterAll\n",
	);

	return 1;
}

process.exit(main());
