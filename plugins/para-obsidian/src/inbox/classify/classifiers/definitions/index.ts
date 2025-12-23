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
import { cvClassifier } from "./cv";
import { documentClassifier } from "./document";
import { employmentContractClassifier } from "./employment-contract";
import { invoiceClassifier } from "./invoice";
import { letterClassifier } from "./letter";
import { medicalStatementClassifier } from "./medical-statement";

// Re-export individual classifiers for direct access
export { bookingClassifier } from "./booking";
export { cvClassifier } from "./cv";
export { documentClassifier } from "./document";
export { employmentContractClassifier } from "./employment-contract";
export { invoiceClassifier } from "./invoice";
export { letterClassifier } from "./letter";
export { medicalStatementClassifier } from "./medical-statement";

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
	employmentContractClassifier, // Priority 125 - employment contracts are important legal documents
	invoiceClassifier, // Priority 120 - invoices have strong filename signals
	letterClassifier, // Priority 118 - letters before CVs (follow-up letter != CV)
	cvClassifier, // Priority 115 - CVs/resumes have strong filename signals
	medicalStatementClassifier, // Priority 110 - medical statements before generic invoices
	bookingClassifier, // Priority 90
	documentClassifier, // Priority 10 - Type B fallback for unclassified DOCX files
] as const;
