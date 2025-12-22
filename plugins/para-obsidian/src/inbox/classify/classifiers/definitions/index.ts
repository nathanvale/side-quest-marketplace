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
import { cvClassifier } from "./cv";
import { documentClassifier } from "./document";
import { invoiceClassifier } from "./invoice";
import { letterClassifier } from "./letter";
import { medicalStatementClassifier } from "./medical-statement";
import { researchClassifier } from "./research";
import { youtubeClassifier } from "./youtube";

// Re-export individual classifiers for direct access
export { bookingClassifier } from "./booking";
export { bookmarkClassifier } from "./bookmark";
export { clippingClassifier } from "./clipping";
export { cvClassifier } from "./cv";
export { documentClassifier } from "./document";
export { invoiceClassifier } from "./invoice";
export { letterClassifier } from "./letter";
export { medicalStatementClassifier } from "./medical-statement";
export { researchClassifier } from "./research";
export { youtubeClassifier } from "./youtube";

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
	invoiceClassifier, // Priority 120 - invoices have strong filename signals
	letterClassifier, // Priority 118 - letters before CVs (follow-up letter != CV)
	cvClassifier, // Priority 115 - CVs/resumes have strong filename signals
	medicalStatementClassifier, // Priority 110 - medical statements before generic invoices
	bookingClassifier, // Priority 90
	researchClassifier, // Priority 85
	youtubeClassifier, // Priority 80 - YouTube videos
	clippingClassifier, // Priority 75 - web clippings before bookmarks
	bookmarkClassifier, // Priority 70
	documentClassifier, // Priority 10 - Type B fallback for unclassified DOCX files
] as const;
