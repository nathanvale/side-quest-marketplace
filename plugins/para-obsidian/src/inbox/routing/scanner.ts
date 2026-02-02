/**
 * Inbox Scanner for Routable Notes
 *
 * Finds notes in inbox that have `area` or `project` frontmatter
 * and are ready to be moved to their PARA destinations.
 *
 * @module inbox/routing/scanner
 */

import { join, isAbsolute as pathIsAbsolute } from "node:path";
import { readTextFile } from "@side-quest/core/fs";
import { parseFrontmatter } from "../../frontmatter/parse";
import { createCorrelationId, routingLogger } from "../../shared/logger";
import { resolveDestination } from "./resolver";
import type { RoutingCandidate, RoutingScanResult } from "./types";

/**
 * Context for routing operations with correlation tracking.
 */
export interface RoutingContext {
	/** Session correlation ID (trace_id equivalent) */
	sessionCid: string;
	/** Parent operation correlation ID */
	parentCid?: string;
}

/**
 * Safely extract a string value from frontmatter field.
 * Handles string, string[], or other types gracefully.
 */
function extractStringField(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (
		Array.isArray(value) &&
		value.length > 0 &&
		typeof value[0] === "string"
	) {
		return value[0];
	}
	return undefined;
}

/**
 * Scan inbox folder for notes that can be routed to PARA folders.
 *
 * A note is routable if it has either:
 * - `area` field in frontmatter → routes to "02 Areas/{area}"
 * - `project` field in frontmatter → routes to "01 Projects/{project}"
 *
 * @param vaultPath - Absolute path to vault root
 * @param inboxFolder - Inbox folder name (default: "00 Inbox")
 * @param ctx - Optional routing context for correlation tracking
 * @returns Candidates that can be routed and skipped items
 *
 * @example
 * ```typescript
 * const result = await scanForRoutableNotes("/vault", "00 Inbox", { sessionCid: "abc123" });
 * console.log(`Found ${result.candidates.length} routable notes`);
 * ```
 */
export async function scanForRoutableNotes(
	vaultPath: string,
	inboxFolder = "00 Inbox",
	ctx?: RoutingContext,
): Promise<RoutingScanResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();
	const candidates: RoutingCandidate[] = [];
	const skipped: Array<{ path: string; reason: string }> = [];

	const inboxPath = join(vaultPath, inboxFolder);

	if (routingLogger) {
		routingLogger.info`routing:scan:start cid=${cid} sessionCid=${ctx?.sessionCid} parentCid=${ctx?.parentCid ?? ctx?.sessionCid} vaultPath=${vaultPath} inboxFolder=${inboxFolder}`;
	}

	// Find all markdown files in inbox
	const { globFiles } = await import("@side-quest/core/glob");
	const files = await globFiles("**/*.md", inboxPath);

	if (routingLogger) {
		routingLogger.debug`routing:scan:filesFound cid=${cid} sessionCid=${ctx?.sessionCid} count=${files.length}`;
	}

	for (const file of files) {
		// globFiles may return absolute or relative paths depending on input
		// If absolute, extract relative portion by removing inboxPath prefix
		const isAbsolute = pathIsAbsolute(file);
		const relativeToInbox = isAbsolute
			? file.slice(inboxPath.length + 1) // +1 for trailing slash
			: file;

		// Get vault-relative path and absolute path
		const relativePath = join(inboxFolder, relativeToInbox);
		const absolutePath = isAbsolute ? file : join(inboxPath, file);

		try {
			// Read and parse frontmatter
			const content = await readTextFile(absolutePath);
			const { attributes } = parseFrontmatter(content);

			// Extract routing fields
			const title = attributes.title as string | undefined;
			const type = attributes.type as string | undefined;

			// Handle area/project as string or array using safe extraction
			const area = extractStringField(attributes.area);
			const project = extractStringField(attributes.project);

			// Skip if missing title
			if (!title) {
				skipped.push({
					path: relativePath,
					reason: "Missing title in frontmatter",
				});
				if (routingLogger) {
					routingLogger.debug`routing:skip:missingTitle cid=${cid} sessionCid=${ctx?.sessionCid} file=${relativePath}`;
				}
				continue;
			}

			// Skip if no routing fields
			if (!area && !project) {
				skipped.push({
					path: relativePath,
					reason: "Missing area or project in frontmatter",
				});
				if (routingLogger) {
					routingLogger.debug`routing:skip:noFields cid=${cid} sessionCid=${ctx?.sessionCid} file=${relativePath}`;
				}
				continue;
			}

			// Resolve destination
			const resolved = resolveDestination({ area, project }, vaultPath);

			if (!resolved) {
				skipped.push({
					path: relativePath,
					reason: "Destination folder does not exist",
				});
				if (routingLogger) {
					routingLogger.warn`routing:skip:noDestination cid=${cid} sessionCid=${ctx?.sessionCid} file=${relativePath} area=${area} project=${project}`;
				}
				continue;
			}

			// Add to candidates
			candidates.push({
				path: relativePath,
				title,
				type,
				area,
				project,
				destination: resolved.destination,
				colocate: resolved.colocate,
			});

			if (routingLogger) {
				routingLogger.debug`routing:found cid=${cid} sessionCid=${ctx?.sessionCid} file=${relativePath} title=${title} area=${area} project=${project} destination=${resolved.destination} colocate=${resolved.colocate ? "yes" : "no"}`;
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			skipped.push({
				path: relativePath,
				reason: `Parse error: ${errorMessage}`,
			});
			if (routingLogger) {
				routingLogger.error`routing:parse:error cid=${cid} sessionCid=${ctx?.sessionCid} file=${relativePath} error=${errorMessage}`;
			}
		}
	}

	const durationMs = Date.now() - startTime;

	if (routingLogger) {
		routingLogger.info`routing:scan:complete cid=${cid} sessionCid=${ctx?.sessionCid} parentCid=${ctx?.parentCid ?? ctx?.sessionCid} durationMs=${durationMs} candidateCount=${candidates.length} skippedCount=${skipped.length}`;
	}

	return { candidates, skipped };
}
