/**
 * Markdown Content Extractor
 *
 * Extracts text content from Markdown files, including:
 * - YAML frontmatter parsing
 * - Body content extraction
 * - Metadata about the note structure
 *
 * Uses the existing frontmatter parsing utilities from the para-obsidian codebase.
 *
 * @module extractors/markdown
 */

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { parseFrontmatter } from "../../../frontmatter/parse";
import { observe } from "../../../shared/instrumentation";
import { inboxLogger } from "../../../shared/logger";
import type { OperationContext } from "../../shared/context";
import type { ContentExtractor, ExtractedContent, InboxFile } from "./types";

/** Supported markdown extensions */
export const MARKDOWN_EXTENSIONS = [
	".md",
	".markdown",
	".mdown",
	".mkd",
] as const;

export type MarkdownExtension = (typeof MARKDOWN_EXTENSIONS)[number];

/**
 * Markdown-specific metadata from extraction.
 */
export interface MarkdownExtractionMetadata {
	/** Whether the file has frontmatter */
	hasFrontmatter: boolean;
	/** Frontmatter field names (for classification hints) */
	frontmatterFields?: readonly string[];
	/** Word count of body content */
	wordCount: number;
	/** Character count of body content */
	charCount: number;
	/** Line count of body content */
	lineCount: number;
	/** Whether the file has any content beyond frontmatter */
	hasBody: boolean;
	/** Title extracted from frontmatter or first heading */
	title?: string;
	/** Tags extracted from frontmatter */
	tags?: readonly string[];
	/** Note type if specified in frontmatter */
	noteType?: string;
}

/**
 * Check if an extension is a supported markdown format.
 */
export function isMarkdownExtension(ext: string): ext is MarkdownExtension {
	return MARKDOWN_EXTENSIONS.includes(ext.toLowerCase() as MarkdownExtension);
}

/**
 * Extract title from frontmatter or first heading.
 * Excludes H1 headings inside code blocks.
 */
function extractTitle(
	attributes: Record<string, unknown>,
	body: string,
): string | undefined {
	// Try frontmatter title first
	if (typeof attributes.title === "string" && attributes.title.trim()) {
		return attributes.title.trim();
	}

	// Try first H1 heading, but exclude code blocks
	// Remove fenced code blocks before searching for H1
	const bodyWithoutCodeBlocks = body.replace(/```[\s\S]*?```/g, "");
	const h1Match = bodyWithoutCodeBlocks.match(/^#\s+(.+)$/m);
	if (h1Match?.[1]) {
		return h1Match[1].trim();
	}

	return undefined;
}

/**
 * Extract tags from frontmatter.
 * Handles both array format and comma-separated string format.
 */
function extractTags(attributes: Record<string, unknown>): readonly string[] {
	const tags = attributes.tags;

	if (Array.isArray(tags)) {
		return tags.filter((t): t is string => typeof t === "string");
	}

	if (typeof tags === "string") {
		// Handle comma-separated tags only (not whitespace, which would split multi-word tags)
		return tags
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
	}

	return [];
}

/**
 * Format frontmatter attributes for LLM context.
 *
 * Converts frontmatter to a readable format that helps the LLM
 * understand the note's metadata and classification.
 */
function formatFrontmatterForLLM(attributes: Record<string, unknown>): string {
	if (Object.keys(attributes).length === 0) {
		return "";
	}

	const lines: string[] = ["[Frontmatter]"];

	for (const [key, value] of Object.entries(attributes)) {
		if (value === null || value === undefined) continue;

		if (Array.isArray(value)) {
			if (value.length > 0) {
				lines.push(`${key}: ${value.join(", ")}`);
			}
		} else if (typeof value === "object") {
			lines.push(`${key}: [complex object]`);
		} else {
			lines.push(`${key}: ${String(value)}`);
		}
	}

	return lines.join("\n");
}

/**
 * Count words in text.
 */
function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Markdown content extractor.
 *
 * Extracts text from Markdown files, parsing YAML frontmatter and body content.
 * This enables LLM classification of existing notes in the inbox.
 *
 * @example
 * ```typescript
 * const file: InboxFile = {
 *   path: '/vault/Inbox/meeting-notes.md',
 *   extension: '.md',
 *   filename: 'meeting-notes.md',
 * };
 *
 * if (markdownExtractor.canHandle(file)) {
 *   const content = await markdownExtractor.extract(file, 'cid-123');
 *   console.log(content.text); // Frontmatter + body content
 * }
 * ```
 */
export const markdownExtractor: ContentExtractor = {
	id: "markdown",
	displayName: "Markdown Extractor",
	extensions: [...MARKDOWN_EXTENSIONS],

	canHandle(file: InboxFile): boolean {
		return isMarkdownExtension(file.extension);
	},

	async checkAvailability(): Promise<{ available: boolean; error?: string }> {
		// Markdown extraction has no external dependencies
		return { available: true };
	},

	async extract(
		file: InboxFile,
		_cid: string,
		parentCid?: string,
		options?: OperationContext,
	): Promise<ExtractedContent> {
		const { sessionCid } = options ?? {};

		return await observe(
			inboxLogger,
			"inbox:extractMarkdown",
			async () => {
				// Read file content with validation
				let rawContent: string;
				try {
					rawContent = await readFile(file.path, "utf-8");
				} catch (error) {
					throw new Error(
						`Failed to read markdown file: ${file.path} - ${error instanceof Error ? error.message : "unknown error"}`,
					);
				}

				// Normalize Windows line endings to Unix
				const normalizedContent = rawContent.replace(/\r\n/g, "\n");

				// Parse frontmatter
				const { attributes, body } = parseFrontmatter(normalizedContent);
				const hasFrontmatter = Object.keys(attributes).length > 0;

				// Extract metadata
				const title = extractTitle(attributes, body);
				const tags = extractTags(attributes);
				const noteType =
					typeof attributes.type === "string" ? attributes.type : undefined;

				// Build text for LLM
				const textParts: string[] = [];

				// Add frontmatter context
				const frontmatterText = formatFrontmatterForLLM(attributes);
				if (frontmatterText) {
					textParts.push(frontmatterText);
				}

				// Add body content
				const trimmedBody = body.trim();
				if (trimmedBody) {
					if (frontmatterText) {
						textParts.push("\n[Content]");
					}
					textParts.push(trimmedBody);
				}

				const text = textParts.join("\n");

				// Build metadata
				const metadata: MarkdownExtractionMetadata = {
					hasFrontmatter,
					frontmatterFields: hasFrontmatter
						? Object.keys(attributes)
						: undefined,
					wordCount: countWords(trimmedBody),
					charCount: trimmedBody.length,
					lineCount: trimmedBody ? trimmedBody.split("\n").length : 0,
					hasBody: trimmedBody.length > 0,
					title,
					tags: tags.length > 0 ? tags : undefined,
					noteType,
				};

				return {
					text,
					source: "markdown",
					filePath: file.path,
					metadata: {
						// durationMs removed - observe() tracks this automatically
						// Include markdown-specific metadata in the standard metadata object
						// by spreading it (cast to satisfy the interface)
						...(metadata as unknown as Record<string, unknown>),
					},
				};
			},
			{
				parentCid,
				context: { filename: file.filename, sessionCid },
			},
		);
	},
};

/**
 * Create an InboxFile from a markdown path.
 * Utility for converting raw paths to the InboxFile interface.
 */
export function createMarkdownInboxFile(filePath: string): InboxFile {
	return {
		path: filePath,
		extension: extname(filePath).toLowerCase(),
		filename: basename(filePath),
	};
}

/**
 * Extract just the frontmatter from a markdown file.
 * Useful for quick metadata inspection without full extraction.
 */
export async function extractFrontmatterOnly(
	filePath: string,
): Promise<Record<string, unknown>> {
	const content = await readFile(filePath, "utf-8");
	const { attributes } = parseFrontmatter(content);
	return attributes;
}
