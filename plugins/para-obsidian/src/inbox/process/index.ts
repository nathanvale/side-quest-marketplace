/**
 * Clipping processing module - converts raw clippings to typed notes.
 *
 * This module handles the transformation of web clippings (captured via
 * Obsidian Web Clipper) into properly typed notes with enriched content
 * and structured frontmatter.
 *
 * @module inbox/process
 */

export {
	findClippings,
	processAllClippings,
	processClipping,
	readClipping,
} from "./clipping-processor.js";

export {
	applyTemplate,
	applyTemplateVariables,
	getTemplatePath,
	readTemplate,
	templateExists,
} from "./template-applier.js";

export type {
	ClippingEnrichment,
	ClippingFrontmatter,
	ClippingProcessResult,
	ClippingType,
	ProcessBatchResult,
	ProcessOptions,
	TemplateVariables,
} from "./types.js";
