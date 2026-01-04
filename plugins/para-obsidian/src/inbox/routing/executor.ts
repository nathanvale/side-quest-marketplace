/**
 * Routing Executor
 *
 * Moves notes from inbox to their PARA destinations using atomic operations.
 * Files are renamed to match their frontmatter title.
 *
 * @module inbox/routing/executor
 */

import { mkdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { moveFile, pathExistsSync } from "@sidequest/core/fs";
import { createCorrelationId, routingLogger } from "../../shared/logger";
import type { RoutingContext } from "./scanner";
import type { RoutingCandidate, RoutingResult } from "./types";

/**
 * Sanitize a title for use as a filename.
 * Removes unsafe characters and limits length.
 */
function sanitizeFilename(title: string): string {
	return title
		.replace(/[/\\?%*:|"<>]/g, "-") // Replace unsafe chars
		.replace(/\s+/g, " ") // Normalize whitespace
		.trim()
		.slice(0, 200); // Limit length
}

/**
 * Generate unique path by appending numeric suffix if file exists.
 * Prevents file overwrite data loss.
 */
function generateUniquePath(basePath: string): string {
	if (!pathExistsSync(basePath)) {
		return basePath;
	}

	const ext = basePath.endsWith(".md") ? ".md" : "";
	const baseWithoutExt = ext ? basePath.slice(0, -ext.length) : basePath;

	let counter = 1;
	let candidatePath = `${baseWithoutExt} ${counter}${ext}`;

	while (pathExistsSync(candidatePath)) {
		counter++;
		candidatePath = `${baseWithoutExt} ${counter}${ext}`;
	}

	return candidatePath;
}

/**
 * Move a note from inbox to its PARA destination.
 *
 * Uses atomic rename operation for safety. If the destination file
 * already exists, the operation will fail.
 *
 * @param candidate - Routable note with source and destination
 * @param vaultPath - Absolute vault root path
 * @param ctx - Optional routing context for correlation tracking
 * @returns Result with success status and paths
 *
 * @example
 * ```typescript
 * const candidate = {
 *   path: "00 Inbox/Note.md",
 *   destination: "02 Areas/Health",
 *   title: "Medical Note"
 * };
 *
 * const result = await moveNote(candidate, "/vault", { sessionCid: "abc123" });
 * if (result.success) {
 *   console.log(`Moved to ${result.movedTo}`);
 * }
 * ```
 */
export async function moveNote(
	candidate: RoutingCandidate,
	vaultPath: string,
	ctx?: RoutingContext,
): Promise<RoutingResult> {
	const cid = createCorrelationId();
	const startTime = Date.now();
	const { path: sourcePath, destination } = candidate;

	if (routingLogger) {
		routingLogger.info`routing:move:start cid=${cid} sessionCid=${ctx?.sessionCid} parentCid=${ctx?.parentCid ?? ctx?.sessionCid} file=${sourcePath} destination=${destination} title=${candidate.title}`;
	}

	try {
		// Build absolute paths
		const sourceAbsolute = resolve(join(vaultPath, sourcePath));
		// Use sanitized title as filename (BREAKING: no longer preserves original filename)
		const sanitizedTitle = sanitizeFilename(candidate.title);
		const filename = `${sanitizedTitle}.md`;
		const baseDestAbsolute = resolve(join(vaultPath, destination, filename));
		// Generate collision-safe destination path
		const destAbsolute = generateUniquePath(baseDestAbsolute);
		const vaultResolved = resolve(vaultPath);

		if (routingLogger) {
			routingLogger.debug`routing:move:paths cid=${cid} sessionCid=${ctx?.sessionCid} source=${sourceAbsolute} dest=${destAbsolute}`;
		}

		// Security: Canonicalize paths to prevent symlink-based path traversal
		// This matches the protection in inbox/core/operations/execute-suggestion.ts
		let canonicalVault = vaultResolved;
		let canonicalSource = sourceAbsolute;
		let canonicalDest = destAbsolute;

		try {
			// Canonicalize vault (should always exist)
			canonicalVault = realpathSync(vaultResolved);
		} catch {
			// Vault doesn't exist - use resolved path
		}

		try {
			// Canonicalize source if it exists
			if (pathExistsSync(sourceAbsolute)) {
				canonicalSource = realpathSync(sourceAbsolute);
			}
		} catch {
			// Source doesn't exist or can't be canonicalized - use resolved
		}

		try {
			// Canonicalize destination parent if it exists
			let current = dirname(destAbsolute);
			while (!pathExistsSync(current) && current !== vaultResolved) {
				current = dirname(current);
			}
			if (pathExistsSync(current)) {
				const canonicalParent = realpathSync(current);
				const relativeSuffix = destAbsolute.slice(current.length);
				canonicalDest = canonicalParent + relativeSuffix;
			}
		} catch {
			// Destination parent doesn't exist - use resolved
		}

		// Security: Verify both paths remain within vault using canonical paths
		if (
			!canonicalSource.startsWith(`${canonicalVault}/`) &&
			canonicalSource !== canonicalVault
		) {
			throw new Error("Source path escapes vault boundary");
		}
		if (
			!canonicalDest.startsWith(`${canonicalVault}/`) &&
			canonicalDest !== canonicalVault
		) {
			throw new Error("Destination path escapes vault boundary");
		}

		// Handle colocate: create folder and move area/project note first
		if (candidate.colocate) {
			const { sourceNotePath, folderPath } = candidate.colocate;
			const folderAbsolute = resolve(join(vaultPath, folderPath));
			const areaSourceAbsolute = resolve(join(vaultPath, sourceNotePath));

			// Security: Verify colocate paths are within vault
			const canonicalAreaSource = pathExistsSync(areaSourceAbsolute)
				? realpathSync(areaSourceAbsolute)
				: areaSourceAbsolute;
			if (
				!canonicalAreaSource.startsWith(`${canonicalVault}/`) &&
				canonicalAreaSource !== canonicalVault
			) {
				throw new Error("Colocate source path escapes vault boundary");
			}

			if (routingLogger) {
				routingLogger.info`routing:colocate:createFolder cid=${cid} sessionCid=${ctx?.sessionCid} folderPath=${folderPath} areaNote=${sourceNotePath}`;
			}

			// 1. Create the folder
			if (!pathExistsSync(folderAbsolute)) {
				mkdirSync(folderAbsolute, { recursive: true });
			}

			// 2. Move the area/project note into the folder as index note
			if (pathExistsSync(areaSourceAbsolute)) {
				const areaFilename = basename(sourceNotePath);
				const areaDestAbsolute = join(folderAbsolute, areaFilename);
				await moveFile(areaSourceAbsolute, areaDestAbsolute);

				if (routingLogger) {
					routingLogger.info`routing:colocate:moveNote cid=${cid} sessionCid=${ctx?.sessionCid} from=${sourceNotePath} to=${join(folderPath, areaFilename)}`;
				}
			}
		}

		// Atomic move (handles cross-filesystem moves)
		await moveFile(sourceAbsolute, destAbsolute);

		// Return vault-relative paths (using actual destination filename)
		const actualFilename = destAbsolute.split("/").pop() ?? filename;
		const movedTo = join(destination, actualFilename);

		const durationMs = Date.now() - startTime;

		if (routingLogger) {
			routingLogger.info`routing:move:success cid=${cid} sessionCid=${ctx?.sessionCid} parentCid=${ctx?.parentCid ?? ctx?.sessionCid} durationMs=${durationMs} from=${sourcePath} to=${movedTo}`;
		}

		return {
			success: true,
			movedFrom: sourcePath,
			movedTo,
		};
	} catch (error) {
		const durationMs = Date.now() - startTime;
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		if (routingLogger) {
			routingLogger.error`routing:move:error cid=${cid} sessionCid=${ctx?.sessionCid} parentCid=${ctx?.parentCid ?? ctx?.sessionCid} durationMs=${durationMs} file=${sourcePath} destination=${destination} error=${errorMessage}`;
		}

		return {
			success: false,
			movedFrom: sourcePath,
			movedTo: "",
			error: `Move failed: ${errorMessage}`,
		};
	}
}
