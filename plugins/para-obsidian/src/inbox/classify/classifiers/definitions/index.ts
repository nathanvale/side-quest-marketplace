/**
 * Classifier Definitions
 *
 * Export all classifier definitions from this barrel file.
 * Each classifier should be in its own file for maintainability.
 *
 * @module classifiers/definitions
 */

import type { InboxConverter } from "../types";
import { bookingClassifier } from "./booking";
import { invoiceClassifier } from "./invoice";

// Re-export individual classifiers for direct access
export { bookingClassifier } from "./booking";
export { invoiceClassifier } from "./invoice";

/**
 * Default classifiers shipped with para-obsidian.
 *
 * To add a new classifier:
 * 1. Create a new file (e.g., `receipt.ts`)
 * 2. Export it from this file
 * 3. Add it to this array
 *
 * @see _template.ts for classifier template
 */
export const DEFAULT_CLASSIFIERS: readonly InboxConverter[] = [
	invoiceClassifier,
	bookingClassifier,
] as const;
