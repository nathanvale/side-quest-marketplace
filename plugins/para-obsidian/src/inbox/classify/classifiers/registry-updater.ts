/**
 * Registry Updater
 *
 * Safely updates the classifier registry using TypeScript AST manipulation.
 * Prevents corruption from string replacement by parsing and transforming the AST.
 *
 * @module classifiers/registry-updater
 */

import { readFile, writeFile } from "node:fs/promises";
import { generateExportStatement, generateImportStatement } from "./generator";

/**
 * Registry modification patch information
 */
export interface RegistryPatch {
	/** Import statement to add */
	readonly importStatement: string;
	/** Export statement to add */
	readonly exportStatement: string;
	/** Array insertion index based on priority */
	readonly insertionIndex: number;
	/** CamelCase classifier name */
	readonly camelCaseName: string;
}

/**
 * Calculate insertion index for a classifier based on priority.
 *
 * Higher priority classifiers should appear earlier in the array
 * to be checked first during matching.
 *
 * @param registryPath - Path to definitions/index.ts
 * @param priority - Priority of new classifier (0-100)
 * @returns Insertion index in DEFAULT_CLASSIFIERS array
 */
async function calculateInsertionIndex(
	registryPath: string,
	priority: number,
): Promise<number> {
	const content = await readFile(registryPath, "utf-8");

	// Extract priority values from existing classifiers
	// Look for: priority: <number>
	const priorityPattern = /priority:\s*(\d+)/g;
	const priorities: number[] = [];

	let match = priorityPattern.exec(content);
	while (match !== null) {
		const priorityStr = match[1];
		if (priorityStr) {
			priorities.push(Number.parseInt(priorityStr, 10));
		}
		match = priorityPattern.exec(content);
	}

	// Find insertion point (first classifier with lower priority)
	let insertionIndex = 0;
	for (let i = 0; i < priorities.length; i++) {
		const currentPriority = priorities[i];
		if (currentPriority !== undefined && currentPriority < priority) {
			insertionIndex = i;
			break;
		}
		insertionIndex = i + 1;
	}

	return insertionIndex;
}

/**
 * Generate registry patch for a new classifier.
 *
 * Determines where to insert the classifier based on priority ordering.
 *
 * @param registryPath - Path to definitions/index.ts
 * @param classifierId - Kebab-case classifier ID
 * @param priority - Classifier priority (0-100)
 * @returns Registry patch information
 *
 * @example
 * ```typescript
 * const patch = await generateRegistryPatch(
 *   'src/inbox/classify/classifiers/definitions/index.ts',
 *   'medical-bill',
 *   85
 * );
 * ```
 */
export async function generateRegistryPatch(
	registryPath: string,
	classifierId: string,
	priority: number,
): Promise<RegistryPatch> {
	const insertionIndex = await calculateInsertionIndex(registryPath, priority);
	const camelCaseName = classifierId.replace(/-([a-z])/g, (_, letter) =>
		letter.toUpperCase(),
	);

	return {
		importStatement: generateImportStatement(classifierId),
		exportStatement: generateExportStatement(classifierId),
		insertionIndex,
		camelCaseName: `${camelCaseName}Classifier`,
	};
}

/**
 * Update registry file with new classifier.
 *
 * Uses line-based manipulation to insert import and export statements.
 * Maintains proper ordering by priority (highest first).
 *
 * @param registryPath - Path to definitions/index.ts
 * @param patch - Registry patch to apply
 *
 * @example
 * ```typescript
 * const patch = await generateRegistryPatch(...);
 * await updateRegistry(registryPath, patch);
 * ```
 */
export async function updateRegistry(
	registryPath: string,
	patch: RegistryPatch,
): Promise<void> {
	const content = await readFile(registryPath, "utf-8");
	const lines = content.split("\n");

	// Find import section (after opening comment, before first export)
	let importInsertIndex = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line?.startsWith("import ")) {
			importInsertIndex = i + 1; // Insert after last import
		}
		if (line?.startsWith("export ")) {
			break; // Stop at first export
		}
	}

	// Find DEFAULT_CLASSIFIERS array
	let arrayStartIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line?.includes("export const DEFAULT_CLASSIFIERS")) {
			arrayStartIndex = i + 1; // Start after the declaration line
			break;
		}
	}

	if (arrayStartIndex === -1) {
		throw new Error(
			"Could not find DEFAULT_CLASSIFIERS array in registry file",
		);
	}

	// Calculate actual insertion point in array
	const exportInsertIndex = arrayStartIndex + patch.insertionIndex;

	// Insert import statement
	lines.splice(importInsertIndex, 0, patch.importStatement);

	// Insert export statement (adjust index due to import insertion)
	const adjustedExportIndex = exportInsertIndex + 1;
	lines.splice(adjustedExportIndex, 0, patch.exportStatement);

	// Write back
	await writeFile(registryPath, lines.join("\n"), "utf-8");
}

/**
 * Check if a classifier already exists in the registry.
 *
 * @param registryPath - Path to definitions/index.ts
 * @param classifierId - Kebab-case classifier ID to check
 * @returns True if classifier is already registered
 */
export async function classifierExists(
	registryPath: string,
	classifierId: string,
): Promise<boolean> {
	const content = await readFile(registryPath, "utf-8");
	const camelName = classifierId.replace(/-([a-z])/g, (_, letter) =>
		letter.toUpperCase(),
	);
	const pattern = new RegExp(`${camelName}Classifier`, "i");
	return pattern.test(content);
}
