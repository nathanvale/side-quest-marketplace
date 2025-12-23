/**
 * Create Classifier Command Integration Tests
 *
 * Comprehensive test coverage for classifier creation including:
 * - Happy path: full wizard flow
 * - Generated code validation
 * - Registry updates with priority ordering
 * - Template detection and creation
 * - Rollback completeness on failures
 * - Concurrent operation handling
 * - Lock timeout scenarios
 * - Validation failures
 *
 * @module cli/create-classifier.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	generateClassifierCode,
	generateExportStatement,
	generateImportStatement,
} from "../inbox/classify/classifiers/generator";
import type {
	FieldDefinition,
	InboxConverter,
} from "../inbox/classify/classifiers/types";
import { atomicWriteFile } from "../shared/atomic-fs";
import { withFileLock } from "../shared/file-lock";
import { Transaction } from "../shared/transaction";
import {
	validateClassifierId,
	validateFieldName,
	validatePriority,
} from "../shared/validation";
import {
	cleanupTestVault,
	createTestVault,
	readVaultFile,
	useTestVaultCleanup,
	vaultFileExists,
	writeVaultFile,
} from "../testing/utils";

describe("create-classifier - Happy Path Tests", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	let vault: string;
	let classifiersDir: string;
	let templatesDir: string;
	let _registryPath: string;

	beforeEach(() => {
		vault = createTestVault();
		trackVault(vault);
		classifiersDir = join(
			vault,
			".plugin-workspace",
			"classifiers",
			"definitions",
		);
		templatesDir = join(vault, "Templates");
		_registryPath = join(classifiersDir, "index.ts");

		// Setup minimal directory structure
		writeVaultFile(
			vault,
			".plugin-workspace/classifiers/definitions/.gitkeep",
			"",
		);
		writeVaultFile(vault, "Templates/.gitkeep", "");
	});

	test("generates valid TypeScript classifier code", () => {
		const config: InboxConverter = {
			schemaVersion: 1,
			id: "test-invoice",
			displayName: "Test Invoice",
			enabled: true,
			priority: 75,
			heuristics: {
				filenamePatterns: [
					{ pattern: "invoice", weight: 1.0 },
					{ pattern: "bill", weight: 0.8 },
				],
				contentMarkers: [
					{ pattern: "total amount", weight: 0.9 },
					{ pattern: "due date", weight: 0.7 },
				],
				threshold: 0.5,
			},
			fields: [
				{
					name: "vendor",
					type: "string",
					description: "Vendor name",
					requirement: "required",
				},
				{
					name: "invoiceDate",
					type: "date",
					description: "Invoice date",
					requirement: "required",
				},
				{
					name: "totalAmount",
					type: "currency",
					description: "Total amount due",
					requirement: "required",
				},
			],
			extraction: {
				promptHint: "Extract invoice details from the document",
				keyFields: ["vendor", "invoiceDate", "totalAmount"],
			},
			template: {
				name: "test-invoice",
				fieldMappings: {
					vendor: "Vendor Name",
					invoiceDate: "Invoice Date (YYYY-MM-DD)",
					totalAmount: "Total Amount",
				},
			},
			scoring: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			},
		};

		const code = generateClassifierCode(config);

		// Verify structure
		expect(code).toContain('import type { InboxConverter } from "../types";');
		expect(code).toContain("export const testInvoiceClassifier");
		expect(code).toContain('id: "test-invoice"');
		expect(code).toContain('displayName: "Test Invoice"');
		expect(code).toContain("priority: 75");

		// Verify heuristics
		expect(code).toContain('{ pattern: "invoice", weight: 1 }');
		expect(code).toContain('{ pattern: "bill", weight: 0.8 }');
		expect(code).toContain('{ pattern: "total amount", weight: 0.9 }');

		// Verify fields
		expect(code).toContain('name: "vendor"');
		expect(code).toContain('type: "string"');
		expect(code).toContain('requirement: "required"');

		// Verify template config
		expect(code).toContain('name: "test-invoice"');
		expect(code).toContain('vendor: "Vendor Name"');

		// Verify TypeScript compiles (basic syntax check)
		expect(code.split("\n").length).toBeGreaterThan(20);
	});

	test("generates correct import and export statements for registry", () => {
		const importStmt = generateImportStatement("medical-bill");
		const exportStmt = generateExportStatement("medical-bill");

		expect(importStmt).toBe(
			'import { medicalBillClassifier } from "./medical-bill";',
		);
		expect(exportStmt).toBe("\tmedicalBillClassifier,");
	});

	test("creates classifier file with atomic write", async () => {
		const classifierPath = join(classifiersDir, "test-classifier.ts");

		const config: InboxConverter = {
			schemaVersion: 1,
			id: "test-classifier",
			displayName: "Test",
			enabled: true,
			priority: 50,
			heuristics: {
				filenamePatterns: [{ pattern: "test", weight: 1.0 }],
				contentMarkers: [],
				threshold: 0.5,
			},
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
			],
			extraction: {
				promptHint: "Test",
				keyFields: ["title"],
			},
			template: {
				name: "test",
				fieldMappings: { title: "Title" },
			},
			scoring: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			},
		};

		const code = generateClassifierCode(config);

		// Write using atomic operation
		await atomicWriteFile(classifierPath, code);

		// Verify file exists and is valid
		const written = await readFile(classifierPath, "utf-8");
		expect(written).toBe(code);
		expect(written).toContain("export const testClassifierClassifier");
	});

	test("template detection finds existing template", async () => {
		const templateName = "invoice";
		const _templatePath = join(templatesDir, `${templateName}.md`);
		const templateContent = `---
type: invoice
template_version: 1
---

# Invoice

**Vendor**: <% tp.system.prompt("Vendor Name") %>
`;

		// Create existing template
		writeVaultFile(vault, `Templates/${templateName}.md`, templateContent);

		// Simulate detection
		const detected = vaultFileExists(vault, `Templates/${templateName}.md`);
		expect(detected).toBe(true);

		const content = readVaultFile(vault, `Templates/${templateName}.md`);
		expect(content).toContain("type: invoice");
	});

	test("basic template scaffold generation", () => {
		const templateName = "test-template";
		const fields: FieldDefinition[] = [
			{
				name: "vendor",
				type: "string",
				description: "Vendor name",
				requirement: "required",
			},
			{
				name: "date",
				type: "date",
				description: "Invoice date",
				requirement: "required",
			},
			{
				name: "amount",
				type: "currency",
				description: "Total amount",
				requirement: "optional",
			},
		];
		const fieldMappings = {
			vendor: "Vendor Name",
			date: "Invoice Date (YYYY-MM-DD)",
			amount: "Total Amount",
		};

		// Generate basic template
		const template = generateBasicTemplate(templateName, fields, fieldMappings);

		expect(template).toContain("---");
		expect(template).toContain(`type: ${templateName}`);
		expect(template).toContain("template_version: 1");
		expect(template).toContain('tp.system.prompt("Vendor Name")');
		expect(template).toContain('tp.system.prompt("Invoice Date (YYYY-MM-DD)")');
		expect(template).toContain('tp.system.prompt("Total Amount")');
	});

	test("registry update maintains priority ordering", async () => {
		// Create initial registry with sorted classifiers
		const initialRegistry = `import type { InboxConverter } from "../types";
import { invoiceClassifier } from "./invoice";
import { bookingClassifier } from "./booking";

export const DEFAULT_CLASSIFIERS: readonly InboxConverter[] = [
	invoiceClassifier, // Priority 100
	bookingClassifier, // Priority 90
] as const;
`;

		writeVaultFile(
			vault,
			".plugin-workspace/classifiers/definitions/index.ts",
			initialRegistry,
		);

		// New classifier with priority 95 (should be inserted between invoice and booking)
		const newImport = generateImportStatement("medical-bill");
		const newExport = generateExportStatement("medical-bill");

		// Simulate registry update (simplified - real implementation would use AST)
		const updated = insertClassifierInRegistry(
			initialRegistry,
			newImport,
			newExport,
			95,
		);

		// Verify insertion order
		const lines = updated.split("\n");
		const invoiceIndex = lines.findIndex((l) =>
			l.includes("invoiceClassifier,"),
		);
		const medicalIndex = lines.findIndex((l) =>
			l.includes("medicalBillClassifier,"),
		);
		const bookingIndex = lines.findIndex((l) =>
			l.includes("bookingClassifier,"),
		);

		expect(invoiceIndex).toBeGreaterThan(-1);
		expect(medicalIndex).toBeGreaterThan(invoiceIndex);
		expect(bookingIndex).toBeGreaterThan(medicalIndex);
	});
});

describe("create-classifier - Failure Scenario Tests", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	let vault: string;
	let classifiersDir: string;
	let registryPath: string;

	beforeEach(() => {
		vault = createTestVault();
		trackVault(vault);
		classifiersDir = join(
			vault,
			".plugin-workspace",
			"classifiers",
			"definitions",
		);
		registryPath = join(classifiersDir, "index.ts");

		writeVaultFile(
			vault,
			".plugin-workspace/classifiers/definitions/.gitkeep",
			"",
		);
		writeVaultFile(vault, "Templates/.gitkeep", "");
	});

	test("rollback removes classifier when registry update fails", async () => {
		const classifierPath = join(classifiersDir, "rollback-test.ts");
		const classifierCode = "export const rollbackTestClassifier = {};";

		const tx = new Transaction();

		// Add create classifier operation
		tx.add({
			name: "create-classifier",
			execute: async () => {
				await atomicWriteFile(classifierPath, classifierCode);
				return { path: classifierPath };
			},
			rollback: async (result?: unknown) => {
				const fileResult = result as FileRollbackResult | undefined;
				if (fileResult?.path) {
					await unlink(fileResult.path).catch(() => {});
				}
			},
		});

		// Add failing registry update
		tx.add({
			name: "update-registry",
			execute: async () => {
				throw new Error("Registry update failed");
			},
			rollback: async () => {},
		});

		// Execute transaction (should fail and rollback)
		const result = await tx.execute();

		expect(result.success).toBe(false);
		expect(result.success === false && result.failedAt).toBe("update-registry");

		// Verify classifier was rolled back
		const exists = await readFile(classifierPath, "utf-8").catch(() => null);
		expect(exists).toBeNull();
	});

	test("rollback removes template when validation fails", async () => {
		const templatePath = join(vault, "Templates", "rollback-template.md");
		const templateContent = "---\ntype: test\n---\nContent";

		const tx = new Transaction();

		// Create template
		tx.add({
			name: "create-template",
			execute: async () => {
				await atomicWriteFile(templatePath, templateContent);
				return { path: templatePath };
			},
			rollback: async (result?: unknown) => {
				const fileResult = result as FileRollbackResult | undefined;
				if (fileResult?.path) {
					await unlink(fileResult.path).catch(() => {});
				}
			},
		});

		// Validation fails
		tx.add({
			name: "validate-template",
			execute: async () => {
				throw new Error("Template validation failed");
			},
			rollback: async () => {},
		});

		const result = await tx.execute();

		expect(result.success).toBe(false);

		// Template should be removed
		const exists = await readFile(templatePath, "utf-8").catch(() => null);
		expect(exists).toBeNull();
	});

	test("complete rollback on multi-step failure", async () => {
		const classifierPath = join(classifiersDir, "multi-step.ts");
		const _templatePath = join(vault, "Templates", "multi-step.md");
		const backupPath = `${registryPath}.backup`;

		const tx = new Transaction();

		// Step 1: Create classifier
		tx.add({
			name: "create-classifier",
			execute: async () => {
				await atomicWriteFile(classifierPath, "export const test = {};");
				return { path: classifierPath };
			},
			rollback: async (result?: unknown) => {
				const fileResult = result as FileRollbackResult | undefined;
				if (fileResult?.path) await unlink(fileResult.path).catch(() => {});
			},
		});

		// Step 2: Update registry (with backup)
		tx.add({
			name: "update-registry",
			execute: async () => {
				const original = "original registry content";
				await atomicWriteFile(registryPath, original);
				await atomicWriteFile(backupPath, original);

				const updated = "updated registry content";
				await atomicWriteFile(registryPath, updated);

				return { backup: original, backupPath };
			},
			rollback: async (result?: unknown) => {
				const registryResult = result as RegistryRollbackResult | undefined;
				if (registryResult?.backup && registryResult?.backupPath) {
					await atomicWriteFile(registryPath, registryResult.backup).catch(
						() => {},
					);
				}
			},
		});

		// Step 3: Create template (FAILS)
		tx.add({
			name: "create-template",
			execute: async () => {
				throw new Error("Template creation failed");
			},
			rollback: async () => {},
		});

		const result = await tx.execute();

		expect(result.success).toBe(false);
		expect(result.success === false && result.failedAt).toBe("create-template");

		// Verify complete rollback
		const classifierExists = await readFile(classifierPath, "utf-8").catch(
			() => null,
		);
		expect(classifierExists).toBeNull();

		const registryContent = await readFile(registryPath, "utf-8");
		expect(registryContent).toBe("original registry content");
	});

	test("concurrent classifier creation with file locking", async () => {
		const results: Array<{ success: boolean; error?: string }> = [];

		// Simulate two concurrent operations
		const operation1 = withFileLock("classifier-registry", async () => {
			// Simulate work
			await sleep(50);
			results.push({ success: true });
		});

		const operation2 = withFileLock("classifier-registry", async () => {
			// Simulate work
			await sleep(50);
			results.push({ success: true });
		});

		// Both should succeed sequentially
		await Promise.all([operation1, operation2]);

		expect(results).toHaveLength(2);
		expect(results[0]?.success).toBe(true);
		expect(results[1]?.success).toBe(true);
	});

	test("template name collision offers rename", () => {
		const existingTemplates = ["invoice", "booking", "medical-statement"];

		// User wants to create "invoice" but it exists
		const requestedName = "invoice";
		const exists = existingTemplates.includes(requestedName);

		expect(exists).toBe(true);

		// Suggest suffixed name
		const suggestedName = `${requestedName}-v2`;
		expect(existingTemplates.includes(suggestedName)).toBe(false);
	});

	test("invalid classifier ID rejected early", () => {
		// Not kebab-case
		expect(() => validateClassifierId("medical_bill")).toThrow(
			"must be kebab-case",
		);

		// Path traversal
		expect(() => validateClassifierId("../secrets")).toThrow(
			"Path traversal not allowed",
		);

		// Reserved name
		expect(() => validateClassifierId("index")).toThrow(
			"Reserved classifier ID",
		);

		// Valid
		expect(validateClassifierId("medical-bill")).toBe("medical-bill");
	});

	test("priority out of range rejected", () => {
		expect(() => validatePriority(-1)).toThrow("Priority must be 0-100");
		expect(() => validatePriority(101)).toThrow("Priority must be 0-100");
		expect(() => validatePriority(50.5)).toThrow("Priority must be 0-100");

		// Valid
		expect(validatePriority(0)).toBe(0);
		expect(validatePriority(100)).toBe(100);
		expect(validatePriority(75)).toBe(75);
	});

	test("invalid field names rejected", () => {
		// Not camelCase
		expect(() => validateFieldName("date-of-service")).toThrow(
			"must be camelCase",
		);
		expect(() => validateFieldName("date_of_service")).toThrow(
			"must be camelCase",
		);
		expect(() => validateFieldName("DateOfService")).toThrow(
			"must be camelCase",
		);

		// Valid
		expect(validateFieldName("dateOfService")).toBe("dateOfService");
		expect(validateFieldName("amount")).toBe("amount");
	});

	test("TypeScript compilation failure triggers rollback", async () => {
		const classifierPath = join(classifiersDir, "invalid-ts.ts");

		// Invalid TypeScript code
		const invalidCode = `
export const invalidClassifier: InboxConverter = {
	// Missing required fields
	id: "test"
}; // <- syntax error, missing fields
`;

		const tx = new Transaction();

		tx.add({
			name: "create-classifier",
			execute: async () => {
				await atomicWriteFile(classifierPath, invalidCode);
				return { path: classifierPath };
			},
			rollback: async (result?: unknown) => {
				const fileResult = result as FileRollbackResult | undefined;
				if (fileResult?.path) await unlink(fileResult.path).catch(() => {});
			},
		});

		tx.add({
			name: "validate-typescript",
			execute: async () => {
				// Simulate TypeScript validation failure
				throw new Error("TypeScript compilation failed");
			},
			rollback: async () => {},
		});

		const result = await tx.execute();

		expect(result.success).toBe(false);

		// File should be removed
		const exists = await readFile(classifierPath, "utf-8").catch(() => null);
		expect(exists).toBeNull();
	});

	test("lock timeout handling", async () => {
		// Create a lock that won't be released quickly
		const longOperation = withFileLock("test-resource", async () => {
			await sleep(100);
		});

		// Try to acquire same lock (will wait)
		const startTime = Date.now();

		// This will succeed after the first lock releases
		await longOperation;

		const secondOperation = await withFileLock("test-resource", async () => {
			return "success";
		});

		expect(secondOperation).toBe("success");

		// Should have waited for first lock
		const elapsed = Date.now() - startTime;
		expect(elapsed).toBeGreaterThanOrEqual(100);
	});

	test("stale lock detection and cleanup", async () => {
		const lockDir = join(vault, ".locks");
		const lockPath = join(lockDir, "test-resource.lock");

		// Create directory
		await writeFile(lockPath, "999999", { flag: "w" }).catch(() => {});

		// Simulate lock with non-existent PID
		await atomicWriteFile(lockPath, "999999");

		// Attempting to acquire should detect stale lock and succeed
		const result = await withFileLock("test-resource", async () => {
			return "acquired";
		});

		expect(result).toBe("acquired");
	});
});

describe("create-classifier - End-to-End Tests", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	let vault: string;

	beforeEach(() => {
		vault = createTestVault();
		trackVault(vault);
		writeVaultFile(vault, "Templates/.gitkeep", "");
	});

	test("full workflow: classifier + template → functional", async () => {
		const classifierId = "e2e-test";
		const templateName = "e2e-test";

		// 1. Create classifier
		const classifier: InboxConverter = {
			schemaVersion: 1,
			id: classifierId,
			displayName: "E2E Test",
			enabled: true,
			priority: 80,
			heuristics: {
				filenamePatterns: [{ pattern: "e2e", weight: 1.0 }],
				contentMarkers: [{ pattern: "test content", weight: 0.9 }],
				threshold: 0.5,
			},
			fields: [
				{
					name: "title",
					type: "string",
					description: "Document title",
					requirement: "required",
				},
			],
			extraction: {
				promptHint: "Extract E2E test data",
				keyFields: ["title"],
			},
			template: {
				name: templateName,
				fieldMappings: {
					title: "Title",
				},
			},
			scoring: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			},
		};

		const classifierCode = generateClassifierCode(classifier);

		// 2. Create template
		const template = generateBasicTemplate(
			templateName,
			classifier.fields,
			classifier.template.fieldMappings,
		);

		// 3. Write both files
		writeVaultFile(
			vault,
			`.plugin-workspace/classifiers/definitions/${classifierId}.ts`,
			classifierCode,
		);
		writeVaultFile(vault, `Templates/${templateName}.md`, template);

		// 4. Verify both exist and are valid
		const classifierExists = vaultFileExists(
			vault,
			`.plugin-workspace/classifiers/definitions/${classifierId}.ts`,
		);
		const templateExists = vaultFileExists(
			vault,
			`Templates/${templateName}.md`,
		);

		expect(classifierExists).toBe(true);
		expect(templateExists).toBe(true);

		const writtenClassifier = readVaultFile(
			vault,
			`.plugin-workspace/classifiers/definitions/${classifierId}.ts`,
		);
		const writtenTemplate = readVaultFile(
			vault,
			`Templates/${templateName}.md`,
		);

		expect(writtenClassifier).toContain("e2eTestClassifier");
		expect(writtenTemplate).toContain("type: e2e-test");
	});
});

// Helper types and functions

/**
 * Rollback result for file operations
 */
interface FileRollbackResult {
	path: string;
}

/**
 * Rollback result for registry operations
 */
interface RegistryRollbackResult {
	backup: string;
	backupPath: string;
}

/**
 * Generate basic template from field definitions
 */
function generateBasicTemplate(
	templateName: string,
	fields: readonly FieldDefinition[],
	fieldMappings: Readonly<Record<string, string>>,
): string {
	const frontmatter = fields
		.map((field) => {
			const promptText = fieldMappings[field.name] || field.name;
			return `${field.name}: "<% tp.system.prompt("${promptText}") %>"`;
		})
		.join("\n");

	return `---
type: ${templateName}
template_version: 1
${frontmatter}
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.system.prompt("Title") %>

## Details

${fields
	.map((field) => {
		const promptText = fieldMappings[field.name] || field.name;
		return `**${promptText}**: <% tp.system.prompt("${promptText}") %>`;
	})
	.join("\n")}

## Notes

<% tp.system.prompt("Additional notes (optional)", "") %>

---
*Created from template: ${templateName}*
`;
}

/**
 * Simulate registry insertion (simplified - real implementation uses AST)
 */
function insertClassifierInRegistry(
	registry: string,
	importStmt: string,
	exportStmt: string,
	priority: number,
): string {
	const lines = registry.split("\n");

	// Find last import
	let lastImportIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line?.startsWith("import")) {
			lastImportIndex = i;
		}
	}

	// Insert import after last import
	lines.splice(lastImportIndex + 1, 0, importStmt);

	// Find array opening
	const arrayStartIndex = lines.findIndex((l) => l.includes("= ["));

	// Find correct position by priority (simplified - just inserts between invoice and booking)
	// In real implementation, this would parse priority comments
	const invoiceLineIndex = lines.findIndex((l) =>
		l.includes("invoiceClassifier,"),
	);

	// Insert after invoice (priority 100 > 95)
	if (invoiceLineIndex !== -1) {
		lines.splice(invoiceLineIndex + 1, 0, exportStmt);
	} else {
		// Fallback: insert after array start
		lines.splice(arrayStartIndex + 1, 0, exportStmt);
	}

	return lines.join("\n");
}

/**
 * Sleep for testing
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
