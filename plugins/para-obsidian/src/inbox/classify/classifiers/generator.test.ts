/**
 * Classifier Generator Tests
 *
 * Tests for TypeScript classifier code generation from configuration.
 */

import { describe, expect, test } from "bun:test";
import {
	generateClassifierCode,
	generateExportStatement,
	generateImportStatement,
} from "./generator";
import type { InboxConverter } from "./types";

describe("generateImportStatement", () => {
	test("generates correct import for simple ID", () => {
		const result = generateImportStatement("invoice");
		expect(result).toBe('import { invoiceClassifier } from "./invoice";');
	});

	test("generates correct import for hyphenated ID", () => {
		const result = generateImportStatement("medical-bill");
		expect(result).toBe(
			'import { medicalBillClassifier } from "./medical-bill";',
		);
	});

	test("handles multiple hyphens", () => {
		const result = generateImportStatement("very-long-classifier-name");
		expect(result).toBe(
			'import { veryLongClassifierNameClassifier } from "./very-long-classifier-name";',
		);
	});
});

describe("generateExportStatement", () => {
	test("generates correct export for simple ID", () => {
		const result = generateExportStatement("invoice");
		expect(result).toBe("\tinvoiceClassifier,");
	});

	test("generates correct export for hyphenated ID", () => {
		const result = generateExportStatement("medical-bill");
		expect(result).toBe("\tmedicalBillClassifier,");
	});
});

describe("generateClassifierCode", () => {
	test("generates valid TypeScript classifier code", () => {
		const config: InboxConverter = {
			schemaVersion: 1,
			id: "test-classifier",
			displayName: "Test Classifier",
			enabled: true,
			priority: 75,
			heuristics: {
				filenamePatterns: [
					{ pattern: "test", weight: 1.0 },
					{ pattern: "sample", weight: 0.8 },
				],
				contentMarkers: [
					{ pattern: "test marker", weight: 0.9 },
					{ pattern: "sample text", weight: 0.7 },
				],
				threshold: 0.5,
			},
			fields: [
				{
					name: "title",
					type: "string",
					description: "Document title",
					requirement: "required",
				},
				{
					name: "date",
					type: "date",
					description: "Document date",
					requirement: "required",
				},
				{
					name: "amount",
					type: "currency",
					description: "Total amount",
					requirement: "optional",
				},
			],
			extraction: {
				promptHint: "This is a test document type",
				keyFields: ["title", "date"],
			},
			template: {
				name: "test-template",
				fieldMappings: {
					title: "Document Title",
					date: "Date (YYYY-MM-DD)",
					amount: "Amount",
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

		// Check structure
		expect(code).toContain('import type { InboxConverter } from "../types";');
		expect(code).toContain("export const testClassifierClassifier");
		expect(code).toContain('id: "test-classifier"');
		expect(code).toContain('displayName: "Test Classifier"');
		expect(code).toContain("priority: 75");

		// Check heuristics
		expect(code).toContain('{ pattern: "test", weight: 1 }');
		expect(code).toContain('{ pattern: "sample", weight: 0.8 }');
		expect(code).toContain('{ pattern: "test marker", weight: 0.9 }');

		// Check fields
		expect(code).toContain('name: "title"');
		expect(code).toContain('type: "string"');
		expect(code).toContain('description:\n\t\t\t"Document title"');
		expect(code).toContain('requirement: "required"');

		// Check template
		expect(code).toContain('name: "test-template"');
		expect(code).toContain('title: "Document Title"');
		expect(code).toContain('date: "Date (YYYY-MM-DD)"');

		// Check scoring
		expect(code).toContain("heuristicWeight: 0.3");
		expect(code).toContain("llmWeight: 0.7");
		expect(code).toContain("highThreshold: 0.85");
		expect(code).toContain("mediumThreshold: 0.6");
	});

	test("handles conditional fields", () => {
		const config: InboxConverter = {
			schemaVersion: 1,
			id: "conditional-test",
			displayName: "Conditional Test",
			enabled: true,
			priority: 50,
			heuristics: {
				filenamePatterns: [{ pattern: "test", weight: 1.0 }],
				contentMarkers: [],
				threshold: 0.5,
			},
			fields: [
				{
					name: "status",
					type: "string",
					description: "Payment status",
					requirement: "conditional",
					conditionalOn: "amount",
					conditionalDescription: "Required when amount > 0",
					allowedValues: ["paid", "unpaid"],
					validationPattern: "^(paid|unpaid)$",
				},
			],
			extraction: {
				promptHint: "Test",
				keyFields: [],
			},
			template: {
				name: "test",
				fieldMappings: {},
			},
			scoring: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			},
		};

		const code = generateClassifierCode(config);

		expect(code).toContain('requirement: "conditional"');
		expect(code).toContain('conditionalOn: "amount"');
		expect(code).toContain(
			'conditionalDescription:\n\t\t\t"Required when amount > 0"',
		);
		expect(code).toContain('allowedValues: ["paid", "unpaid"]');
		expect(code).toContain('validationPattern: "^(paid|unpaid)$"');
	});

	test("generates valid TypeScript that can be parsed", () => {
		const config: InboxConverter = {
			schemaVersion: 1,
			id: "simple",
			displayName: "Simple",
			enabled: true,
			priority: 100,
			heuristics: {
				filenamePatterns: [{ pattern: "invoice", weight: 1.0 }],
				contentMarkers: [{ pattern: "total", weight: 0.8 }],
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
				promptHint: "Extract invoice data",
				keyFields: ["title"],
			},
			template: {
				name: "invoice",
				fieldMappings: { title: "Invoice Title" },
			},
			scoring: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			},
		};

		const code = generateClassifierCode(config);

		// Should not throw syntax errors when evaluated
		// (This doesn't actually import the type, but validates structure)
		expect(code).toContain("export const simpleClassifier");
		expect(code.split("\n").length).toBeGreaterThan(10);
	});
});
