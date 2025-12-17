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
import { bookmarkClassifier } from "./bookmark";
import { clippingClassifier } from "./clipping";
import { invoiceClassifier } from "./invoice";
import { medicalStatementClassifier } from "./medical-statement";
import { researchClassifier } from "./research";

// Re-export individual classifiers for direct access
export { bookingClassifier } from "./booking";
export { bookmarkClassifier } from "./bookmark";
export { clippingClassifier } from "./clipping";
export { invoiceClassifier } from "./invoice";
export { medicalStatementClassifier } from "./medical-statement";
export { researchClassifier } from "./research";

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
	medicalStatementClassifier, // Priority 110 - medical statements before generic invoices
	invoiceClassifier, // Priority 100
	bookingClassifier, // Priority 90
	researchClassifier, // Priority 85
	clippingClassifier, // Priority 75 - web clippings before bookmarks
	bookmarkClassifier, // Priority 70
] as const;
