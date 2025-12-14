/**
 * Classifier Registry
 *
 * Registry for inbox converters using the Strategy pattern.
 * Enables adding new document type classifiers without modifying core code.
 *
 * @module classify/classifiers/registry
 */

import { findBestConverter } from "../converters/loader";
import type { ConverterMatch, InboxConverter } from "../converters/types";

/**
 * Current schema version for converters.
 * Increment when making breaking changes to InboxConverter structure.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Registry for inbox classifiers (converters).
 *
 * Manages a collection of converters and provides methods to find
 * the appropriate converter for a given document.
 *
 * @example
 * ```typescript
 * import { ClassifierRegistry } from "./classifiers/registry";
 * import { invoiceConverter, bookingConverter } from "./converters";
 *
 * const registry = new ClassifierRegistry();
 * registry.register(invoiceConverter);
 * registry.register(bookingConverter);
 *
 * const match = registry.findMatch("invoice.pdf", "TAX INVOICE...");
 * if (match) {
 *   console.log(`Matched: ${match.converter.displayName}`);
 * }
 * ```
 */
export class ClassifierRegistry {
	private converters: Map<string, InboxConverter> = new Map();

	/**
	 * Register a converter.
	 *
	 * @param converter - The converter to register
	 * @throws Error if converter with same ID is already registered
	 * @throws Error if converter has incompatible schema version
	 */
	register(converter: InboxConverter): void {
		if (this.converters.has(converter.id)) {
			throw new Error(
				`Converter with ID '${converter.id}' is already registered`,
			);
		}

		// Validate schema version
		if (converter.schemaVersion > CURRENT_SCHEMA_VERSION) {
			throw new Error(
				`Converter '${converter.id}' has schema version ${converter.schemaVersion} ` +
					`but registry only supports up to version ${CURRENT_SCHEMA_VERSION}. ` +
					`Please update para-obsidian.`,
			);
		}

		this.converters.set(converter.id, converter);
	}

	/**
	 * Register multiple converters at once.
	 *
	 * @param converters - Array of converters to register
	 */
	registerAll(converters: readonly InboxConverter[]): void {
		for (const converter of converters) {
			this.register(converter);
		}
	}

	/**
	 * Unregister a converter by ID.
	 *
	 * @param id - The converter ID to remove
	 * @returns true if the converter was removed, false if not found
	 */
	unregister(id: string): boolean {
		return this.converters.delete(id);
	}

	/**
	 * Get a converter by ID.
	 *
	 * @param id - The converter ID
	 * @returns The converter or undefined if not found
	 */
	get(id: string): InboxConverter | undefined {
		return this.converters.get(id);
	}

	/**
	 * Check if a converter is registered.
	 *
	 * @param id - The converter ID to check
	 * @returns true if registered
	 */
	has(id: string): boolean {
		return this.converters.has(id);
	}

	/**
	 * Find the best matching converter for a document.
	 *
	 * @param filename - The document filename
	 * @param content - The document content
	 * @returns Match result or null if no converter matches
	 */
	findMatch(filename: string, content: string): ConverterMatch | null {
		return findBestConverter(this.getAll(), filename, content);
	}

	/**
	 * Get all enabled converters.
	 *
	 * @returns Array of enabled converters sorted by priority (highest first)
	 */
	getEnabled(): InboxConverter[] {
		return [...this.converters.values()]
			.filter((c) => c.enabled)
			.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Get all registered converters.
	 *
	 * @returns Array of all converters (enabled and disabled)
	 */
	getAll(): InboxConverter[] {
		return [...this.converters.values()];
	}

	/**
	 * Get all registered converter IDs.
	 *
	 * @returns Array of converter IDs
	 */
	getIds(): string[] {
		return [...this.converters.keys()];
	}

	/**
	 * Get the number of registered converters.
	 */
	get size(): number {
		return this.converters.size;
	}

	/**
	 * Clear all registered converters.
	 */
	clear(): void {
		this.converters.clear();
	}
}
