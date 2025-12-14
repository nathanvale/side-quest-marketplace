/**
 * Extractor Registry
 *
 * Registry for content extractors using the Strategy pattern.
 * Enables adding new file format support without modifying the engine.
 *
 * @module extractors/registry
 */

import type { ContentExtractor, ExtractorMatch, InboxFile } from "./types";

/**
 * Registry for content extractors.
 *
 * Manages a collection of extractors and provides methods to find
 * the appropriate extractor for a given file.
 *
 * @example
 * ```typescript
 * const registry = new ExtractorRegistry();
 * registry.register(pdfExtractor);
 * registry.register(imageExtractor);
 *
 * const file = createInboxFile('/vault/Inbox/invoice.pdf');
 * const match = registry.findExtractor(file);
 * if (match) {
 *   const content = await match.extractor.extract(file, 'cid-123');
 * }
 * ```
 */
export class ExtractorRegistry {
	private extractors: Map<string, ContentExtractor> = new Map();

	/**
	 * Register an extractor.
	 *
	 * @param extractor - The extractor to register
	 * @throws Error if an extractor with the same ID is already registered
	 */
	register(extractor: ContentExtractor): void {
		if (this.extractors.has(extractor.id)) {
			throw new Error(
				`Extractor with ID '${extractor.id}' is already registered`,
			);
		}
		this.extractors.set(extractor.id, extractor);
	}

	/**
	 * Unregister an extractor by ID.
	 *
	 * @param id - The extractor ID to remove
	 * @returns true if the extractor was removed, false if not found
	 */
	unregister(id: string): boolean {
		return this.extractors.delete(id);
	}

	/**
	 * Get an extractor by ID.
	 *
	 * @param id - The extractor ID
	 * @returns The extractor or undefined if not found
	 */
	get(id: string): ContentExtractor | undefined {
		return this.extractors.get(id);
	}

	/**
	 * Find an extractor that can handle a file.
	 *
	 * @param file - The inbox file to find an extractor for
	 * @returns Match result or null if no extractor can handle the file
	 */
	findExtractor(file: InboxFile): ExtractorMatch | null {
		for (const extractor of this.extractors.values()) {
			if (extractor.canHandle(file)) {
				return { extractor, file };
			}
		}
		return null;
	}

	/**
	 * Check if any extractor can handle a file.
	 *
	 * @param file - The inbox file to check
	 * @returns true if an extractor can handle the file
	 */
	canHandle(file: InboxFile): boolean {
		return this.findExtractor(file) !== null;
	}

	/**
	 * Get all supported file extensions across all extractors.
	 *
	 * @returns Array of unique extensions (e.g., ['.pdf', '.png', '.jpg'])
	 */
	getSupportedExtensions(): string[] {
		const extensions = new Set<string>();
		for (const extractor of this.extractors.values()) {
			for (const ext of extractor.extensions) {
				extensions.add(ext.toLowerCase());
			}
		}
		return [...extensions];
	}

	/**
	 * Get all registered extractors.
	 *
	 * @returns Array of all extractors
	 */
	getAll(): ContentExtractor[] {
		return [...this.extractors.values()];
	}

	/**
	 * Get the number of registered extractors.
	 */
	get size(): number {
		return this.extractors.size;
	}

	/**
	 * Check availability of all extractors in parallel.
	 *
	 * @returns Map of extractor ID to availability result
	 */
	async checkAllAvailability(): Promise<
		Map<string, { available: boolean; error?: string }>
	> {
		const extractors = [...this.extractors.values()];

		// Run all checks in parallel for better performance
		const checkPromises = extractors.map(async (extractor) => {
			if (extractor.checkAvailability) {
				const result = await extractor.checkAvailability();
				return { id: extractor.id, result };
			}
			// If no check method, assume available
			return { id: extractor.id, result: { available: true } };
		});

		const results = await Promise.all(checkPromises);

		const resultMap = new Map<string, { available: boolean; error?: string }>();
		for (const { id, result } of results) {
			resultMap.set(id, result);
		}

		return resultMap;
	}
}

/**
 * Create a registry with the default extractors registered.
 *
 * Currently includes:
 * - PDF extractor (pdftotext)
 * - Image extractor (Vision AI - placeholder until API configured)
 * - Markdown extractor (frontmatter + content)
 *
 * Uses dynamic ESM imports to enable tree-shaking and graceful failure.
 * If an extractor fails to load, the registry continues with the others.
 */
export async function createDefaultRegistry(): Promise<ExtractorRegistry> {
	const registry = new ExtractorRegistry();

	// Load extractors in parallel with individual error handling
	const extractorLoaders = [
		{
			name: "pdf",
			load: async () => {
				const mod = await import("./pdf");
				return mod.pdfExtractor;
			},
		},
		{
			name: "image",
			load: async () => {
				const mod = await import("./image");
				return mod.imageExtractor;
			},
		},
		{
			name: "markdown",
			load: async () => {
				const mod = await import("./markdown");
				return mod.markdownExtractor;
			},
		},
	];

	const results = await Promise.allSettled(
		extractorLoaders.map(async ({ name, load }) => {
			const extractor = await load();
			return { name, extractor };
		}),
	);

	// Register successful loads, log failures
	for (const result of results) {
		if (result.status === "fulfilled") {
			registry.register(result.value.extractor);
		}
		// Failed loads are silently skipped - caller can check registry.size
	}

	return registry;
}

/**
 * Singleton default registry instance.
 * Use this for simple cases where you don't need custom configuration.
 */
let defaultRegistry: ExtractorRegistry | null = null;

/**
 * Get the default registry instance (singleton).
 * Creates it on first access with default extractors.
 */
export async function getDefaultRegistry(): Promise<ExtractorRegistry> {
	if (!defaultRegistry) {
		defaultRegistry = await createDefaultRegistry();
	}
	return defaultRegistry;
}

/**
 * Reset the default registry (mainly for testing).
 */
export function resetDefaultRegistry(): void {
	defaultRegistry = null;
}
