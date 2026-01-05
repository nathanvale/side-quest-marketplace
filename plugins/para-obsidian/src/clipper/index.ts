/**
 * WebClipper template conversion module.
 *
 * Provides bidirectional conversion between Obsidian WebClipper JSON templates
 * and Templater MD format.
 *
 * @module clipper
 */

// Converter
export {
	compareTemplates,
	extractTemplateMetadata,
	webClipperToTemplater,
} from "./converter";
// Exporter
export type { ExportResult, SyncResult } from "./exporter";
export {
	exportAllToTemplater,
	exportToTemplater,
	exportToWebClipperSettings,
	getTemplate,
	listTemplates,
	syncFromWebClipperSettings,
} from "./exporter";
// Parser
export {
	getTemplatesDirectory,
	loadTemplatesFromDirectory,
	parseSettings,
	parseSettingsFile,
	parseTemplate,
	parseTemplateFile,
} from "./parser";
// Types
export type {
	ConversionResult,
	ParseResult,
	TemplateMetadata,
	TemplaterVariable,
	WebClipperBehavior,
	WebClipperProperty,
	WebClipperPropertyType,
	WebClipperPropertyTypeDefinition,
	WebClipperSettings,
	WebClipperTemplate,
	WebClipperVault,
} from "./types";
