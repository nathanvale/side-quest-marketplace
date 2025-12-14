import { describe, expect, test } from "bun:test";
import { ClassifierRegistry, CURRENT_SCHEMA_VERSION } from "./registry";
import type { InboxConverter } from "./types";

// Test fixture: minimal valid converter
const createTestConverter = (
	overrides: Partial<InboxConverter> = {},
): InboxConverter => ({
	schemaVersion: 1,
	id: "test",
	displayName: "Test Converter",
	enabled: true,
	priority: 50,
	heuristics: {
		filenamePatterns: [{ pattern: "test", weight: 1.0 }],
		contentMarkers: [{ pattern: "test content", weight: 1.0 }],
		threshold: 0.3,
	},
	fields: [
		{
			name: "title",
			type: "string",
			description: "Test title",
			requirement: "required",
		},
	],
	extraction: {
		promptHint: "Test prompt hint",
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
	...overrides,
});

describe("ClassifierRegistry", () => {
	describe("register", () => {
		test("should register a converter", () => {
			const registry = new ClassifierRegistry();
			const converter = createTestConverter();

			registry.register(converter);

			expect(registry.has("test")).toBe(true);
			expect(registry.size).toBe(1);
		});

		test("should throw when registering duplicate ID", () => {
			const registry = new ClassifierRegistry();
			const converter = createTestConverter();

			registry.register(converter);

			expect(() => registry.register(converter)).toThrow(
				"Converter with ID 'test' is already registered",
			);
		});

		test("should throw when schema version is too new", () => {
			const registry = new ClassifierRegistry();
			const futureConverter = createTestConverter({
				schemaVersion: CURRENT_SCHEMA_VERSION + 1,
			});

			expect(() => registry.register(futureConverter)).toThrow(
				/schema version.*only supports up to version/,
			);
		});

		test("should accept converters at current schema version", () => {
			const registry = new ClassifierRegistry();
			const converter = createTestConverter({
				schemaVersion: CURRENT_SCHEMA_VERSION,
			});

			registry.register(converter);

			expect(registry.has("test")).toBe(true);
		});
	});

	describe("registerAll", () => {
		test("should register multiple converters", () => {
			const registry = new ClassifierRegistry();
			const converters = [
				createTestConverter({ id: "conv1" }),
				createTestConverter({ id: "conv2" }),
				createTestConverter({ id: "conv3" }),
			];

			registry.registerAll(converters);

			expect(registry.size).toBe(3);
			expect(registry.has("conv1")).toBe(true);
			expect(registry.has("conv2")).toBe(true);
			expect(registry.has("conv3")).toBe(true);
		});
	});

	describe("unregister", () => {
		test("should remove a registered converter", () => {
			const registry = new ClassifierRegistry();
			registry.register(createTestConverter());

			const result = registry.unregister("test");

			expect(result).toBe(true);
			expect(registry.has("test")).toBe(false);
			expect(registry.size).toBe(0);
		});

		test("should return false for non-existent ID", () => {
			const registry = new ClassifierRegistry();

			const result = registry.unregister("nonexistent");

			expect(result).toBe(false);
		});
	});

	describe("get", () => {
		test("should return registered converter", () => {
			const registry = new ClassifierRegistry();
			const converter = createTestConverter();
			registry.register(converter);

			const result = registry.get("test");

			expect(result).toEqual(converter);
		});

		test("should return undefined for non-existent ID", () => {
			const registry = new ClassifierRegistry();

			const result = registry.get("nonexistent");

			expect(result).toBeUndefined();
		});
	});

	describe("getEnabled", () => {
		test("should return only enabled converters", () => {
			const registry = new ClassifierRegistry();
			registry.registerAll([
				createTestConverter({ id: "enabled1", enabled: true, priority: 10 }),
				createTestConverter({ id: "disabled", enabled: false, priority: 50 }),
				createTestConverter({ id: "enabled2", enabled: true, priority: 20 }),
			]);

			const enabled = registry.getEnabled();

			expect(enabled.length).toBe(2);
			expect(enabled.map((c) => c.id)).toEqual(["enabled2", "enabled1"]);
		});

		test("should sort by priority (highest first)", () => {
			const registry = new ClassifierRegistry();
			registry.registerAll([
				createTestConverter({ id: "low", priority: 10 }),
				createTestConverter({ id: "high", priority: 100 }),
				createTestConverter({ id: "mid", priority: 50 }),
			]);

			const enabled = registry.getEnabled();

			expect(enabled.map((c) => c.id)).toEqual(["high", "mid", "low"]);
		});
	});

	describe("getAll", () => {
		test("should return all converters including disabled", () => {
			const registry = new ClassifierRegistry();
			registry.registerAll([
				createTestConverter({ id: "enabled", enabled: true }),
				createTestConverter({ id: "disabled", enabled: false }),
			]);

			const all = registry.getAll();

			expect(all.length).toBe(2);
		});
	});

	describe("getIds", () => {
		test("should return all registered IDs", () => {
			const registry = new ClassifierRegistry();
			registry.registerAll([
				createTestConverter({ id: "alpha" }),
				createTestConverter({ id: "beta" }),
			]);

			const ids = registry.getIds();

			expect(ids).toContain("alpha");
			expect(ids).toContain("beta");
		});
	});

	describe("findMatch", () => {
		test("should find matching converter by filename", () => {
			const registry = new ClassifierRegistry();
			registry.register(
				createTestConverter({
					id: "invoice",
					heuristics: {
						filenamePatterns: [{ pattern: "invoice", weight: 1.0 }],
						contentMarkers: [],
						threshold: 0.3,
					},
				}),
			);

			const match = registry.findMatch("my-invoice.pdf", "");

			expect(match).not.toBeNull();
			expect(match?.converter.id).toBe("invoice");
		});

		test("should find matching converter by content", () => {
			const registry = new ClassifierRegistry();
			registry.register(
				createTestConverter({
					id: "invoice",
					heuristics: {
						filenamePatterns: [],
						contentMarkers: [{ pattern: "tax invoice", weight: 1.0 }],
						threshold: 0.3,
					},
				}),
			);

			const match = registry.findMatch("document.pdf", "This is a TAX INVOICE");

			expect(match).not.toBeNull();
			expect(match?.converter.id).toBe("invoice");
		});

		test("should return null when no match found", () => {
			const registry = new ClassifierRegistry();
			registry.register(
				createTestConverter({
					id: "invoice",
					heuristics: {
						filenamePatterns: [{ pattern: "invoice", weight: 1.0 }],
						contentMarkers: [{ pattern: "tax invoice", weight: 1.0 }],
						threshold: 0.9, // High threshold
					},
				}),
			);

			const match = registry.findMatch("random.pdf", "random content");

			expect(match).toBeNull();
		});
	});

	describe("clear", () => {
		test("should remove all converters", () => {
			const registry = new ClassifierRegistry();
			registry.registerAll([
				createTestConverter({ id: "a" }),
				createTestConverter({ id: "b" }),
			]);

			registry.clear();

			expect(registry.size).toBe(0);
			expect(registry.getAll()).toEqual([]);
		});
	});
});

describe("CURRENT_SCHEMA_VERSION", () => {
	test("should be 1", () => {
		expect(CURRENT_SCHEMA_VERSION).toBe(1);
	});
});
