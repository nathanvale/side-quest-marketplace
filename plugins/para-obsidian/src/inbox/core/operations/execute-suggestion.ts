/**
 * Single suggestion execution for inbox processing.
 *
 * Handles the execution of a single inbox suggestion:
 * - Moving attachments to dated names
 * - Creating notes from templates
 * - Injecting attachment links
 *
 * @module inbox/core/operations/execute-suggestion
 */

import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
	ensureDirSync,
	moveFile,
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { DEFAULT_PARA_FOLDERS } from "../../../config/defaults";
import { loadConfig } from "../../../config/index";
import {
	parseFrontmatter,
	serializeFrontmatter,
} from "../../../frontmatter/parse";
// Note: autoCommitChanges removed - commits are now batched at session level in engine.ts
import { createFromTemplate, injectSections } from "../../../notes/create";
import { withFileLock } from "../../../shared/file-lock";
import { resolveVaultPath } from "../../../shared/fs";
import { categorizeError, observe } from "../../../shared/instrumentation";
import { executeLogger } from "../../../shared/logger";
import {
	DEFAULT_CLASSIFIERS,
	mapFieldsToTemplate,
} from "../../classify/classifiers";
import {
	type createRegistry,
	hashFile,
} from "../../registry/processed-registry";
import type { ExecutionResult, InboxSuggestion } from "../../types";
import {
	generateFilename,
	generateUniquePath,
	getHashPrefix,
} from "../engine-utils";
import { rollbackOperation } from "../staging/rollback";

/**
 * Engine configuration for suggestion execution.
 */
export interface ExecuteSuggestionConfig {
	readonly vaultPath: string;
	readonly inboxFolder: string;
	readonly attachmentsFolder: string;
	readonly templatesFolder: string;
}

/**
 * Validate that a destination path is safe and doesn't escape the vault boundary.
 *
 * **Security**: Uses realpath canonicalization to prevent symlink-based path traversal attacks.
 * This defends against attackers creating symlinks that escape the vault boundary.
 *
 * @param destination - The destination path to validate
 * @param vaultPath - The vault root path
 * @throws Error if path contains unsafe patterns or escapes vault
 */
function validatePathSafety(destination: string, vaultPath: string): void {
	// Reject suspicious patterns immediately
	if (
		destination.includes("..") ||
		destination.includes("~") ||
		destination.startsWith("/")
	) {
		throw new Error(`Unsafe path pattern in destination: "${destination}"`);
	}

	// Resolve symbolic links and normalize paths to prevent symlink attacks
	const resolved = resolve(vaultPath, destination);
	const vaultResolved = resolve(vaultPath);

	// Canonicalize paths using realpath if they exist
	// This prevents symlink-based path traversal (e.g., symlink pointing outside vault)
	let canonicalResolved = resolved;
	let canonicalVault = vaultResolved;

	try {
		// Try to canonicalize vault path (should always exist)
		canonicalVault = realpathSync(vaultResolved);
	} catch {
		// Vault doesn't exist - use resolved path (safe for validation)
	}

	try {
		// Try to canonicalize destination (may not exist yet)
		// Walk up to find existing parent and canonicalize from there
		let current = resolved;
		while (!pathExistsSync(current) && current !== vaultResolved) {
			current = dirname(current);
		}
		if (pathExistsSync(current)) {
			const canonicalParent = realpathSync(current);
			const relativeSuffix = resolved.slice(current.length);
			canonicalResolved = canonicalParent + relativeSuffix;
		}
	} catch {
		// Path doesn't exist yet - use resolved path (creation will fail if symlink attack)
	}

	// Check boundary using canonicalized paths
	if (
		!canonicalResolved.startsWith(`${canonicalVault}/`) &&
		canonicalResolved !== canonicalVault
	) {
		throw new Error(
			`Path traversal detected: "${destination}" escapes vault boundary`,
		);
	}
}

/**
 * Resolve semantic PARA folder names to numbered folder paths.
 *
 * Maps short semantic names like "Resources" to actual vault folder paths like "03 Resources".
 * Throws an error if the destination looks like a PARA name but isn't mapped.
 * Passes through full paths (e.g., "02 Areas/Finance") unchanged.
 *
 * @param destination - The destination string from suggestion (e.g., "Resources", "02 Areas/Finance")
 * @param paraFolders - PARA folder mappings from config (e.g., { resources: "03 Resources" })
 * @param vaultPath - Optional vault path to validate the resolved folder exists
 * @param options - Optional resolution options
 * @param options.areaPathMap - Map of area names (lowercase) to full paths (e.g., "health" → "02 Areas/Health")
 * @param options.projectPathMap - Map of project names (lowercase) to full paths (e.g., "tax 2024" → "01 Projects/Tax 2024")
 * @returns Resolved folder path
 * @throws Error if destination looks like unmapped PARA name
 * @throws Error if vaultPath provided and resolved folder doesn't exist
 * @throws Error if destination is unknown and maps are provided
 */
export function resolveParaFolder(
	destination: string,
	paraFolders: Record<string, string> = DEFAULT_PARA_FOLDERS,
	vaultPath?: string,
	options?: {
		areaPathMap?: Map<string, string>;
		projectPathMap?: Map<string, string>;
	},
): string {
	// Validate path safety first
	if (vaultPath) {
		validatePathSafety(destination, vaultPath);
	}

	// Check if it's already a full path (contains "/" or starts with number)
	if (destination.includes("/") || /^\d{2}\s/.test(destination)) {
		const resolved = destination;

		// Validate folder exists if vaultPath provided
		if (vaultPath) {
			const fullPath = join(vaultPath, resolved);
			if (!pathExistsSync(fullPath)) {
				throw new Error(`Destination folder does not exist: ${resolved}`);
			}
		}

		return resolved;
	}

	// Map semantic PARA names to numbered folders
	const semanticName = destination.toLowerCase();
	const mapping: Record<string, string> = {
		inbox: paraFolders.inbox ?? DEFAULT_PARA_FOLDERS.inbox ?? "00 Inbox",
		projects:
			paraFolders.projects ?? DEFAULT_PARA_FOLDERS.projects ?? "01 Projects",
		areas: paraFolders.areas ?? DEFAULT_PARA_FOLDERS.areas ?? "02 Areas",
		resources:
			paraFolders.resources ?? DEFAULT_PARA_FOLDERS.resources ?? "03 Resources",
		archives:
			paraFolders.archives ?? DEFAULT_PARA_FOLDERS.archives ?? "04 Archives",
	};

	// If it's a known PARA name, return the mapped value
	if (semanticName in mapping) {
		const resolved = mapping[semanticName];
		if (!resolved) {
			throw new Error(
				`PARA folder mapping returned undefined for: "${destination}"`,
			);
		}

		// Validate folder exists if vaultPath provided
		if (vaultPath) {
			const fullPath = join(vaultPath, resolved);
			if (!pathExistsSync(fullPath)) {
				throw new Error(`Destination folder does not exist: ${resolved}`);
			}
		}

		return resolved;
	}

	// If it looks like a PARA name but isn't mapped, throw error
	// (Prevents silent failures where "Resources" becomes a new folder in vault root)
	const paraNamesPattern = /^(inbox|projects|areas|resources|archives)$/i;
	if (paraNamesPattern.test(destination)) {
		throw new Error(
			`Unmapped PARA folder name: "${destination}". Expected mapping in paraFolders config.`,
		);
	}

	// 3. Try to resolve as area name (case-insensitive)
	if (options?.areaPathMap) {
		const areaPath = options.areaPathMap.get(semanticName);
		if (areaPath) {
			if (vaultPath && !pathExistsSync(join(vaultPath, areaPath))) {
				throw new Error(`Area folder does not exist: ${areaPath}`);
			}
			return areaPath;
		}
	}

	// 4. Try to resolve as project name (case-insensitive)
	if (options?.projectPathMap) {
		const projectPath = options.projectPathMap.get(semanticName);
		if (projectPath) {
			if (vaultPath && !pathExistsSync(join(vaultPath, projectPath))) {
				throw new Error(`Project folder does not exist: ${projectPath}`);
			}
			return projectPath;
		}
	}

	// 5. Unknown with maps provided → error with helpful message
	if (options?.areaPathMap && options?.projectPathMap) {
		const availableAreas = [...options.areaPathMap.values()];
		const availableProjects = [...options.projectPathMap.values()];
		throw new Error(
			`Unknown destination: "${destination}". ` +
				`Not a PARA folder name, area, or project. ` +
				`Available areas: ${availableAreas.length > 0 ? availableAreas.join(", ") : "none"}.` +
				(availableProjects.length > 0
					? ` Available projects: ${availableProjects.join(", ")}.`
					: ""),
		);
	}

	// Fallback: Not a PARA name, no maps provided - return unchanged (backward compatibility)
	const resolved = destination;

	// Validate folder exists if vaultPath provided
	if (vaultPath) {
		const fullPath = join(vaultPath, resolved);
		if (!pathExistsSync(fullPath)) {
			throw new Error(`Destination folder does not exist: ${resolved}`);
		}
	}

	return resolved;
}

/**
 * Execute a single suggestion.
 *
 * For create-note actions:
 * 1. Move PDF to Attachments folder with dated name
 * 2. Create note with template (TBD - for now just moves attachment)
 * 3. Update registry
 *
 * @param suggestion - The suggestion to execute
 * @param config - Engine configuration
 * @param registry - Registry instance for tracking processed items
 * @param cid - Correlation ID for logging
 * @param options - Optional execution options
 * @param options.areaPathMap - Pre-built map of area names to paths (performance optimization)
 * @param options.projectPathMap - Pre-built map of project names to paths (performance optimization)
 * @param options.sessionCid - Session-level correlation ID for trace hierarchy
 * @returns Execution result
 */
export async function executeSuggestion(
	suggestion: InboxSuggestion,
	config: ExecuteSuggestionConfig,
	registry: ReturnType<typeof createRegistry>,
	cid: string,
	options?: {
		areaPathMap?: Map<string, string>;
		projectPathMap?: Map<string, string>;
		sessionCid?: string;
	},
): Promise<ExecutionResult> {
	const { sessionCid } = options ?? {};

	return await observe(
		executeLogger,
		"execute:suggestion",
		async () => {
			const sourcePath = join(config.vaultPath, suggestion.source);
			const filename = basename(suggestion.source);

			// Load para-obsidian config once for all operations (template creation, staging, injection, auto-commit)
			const paraConfig = loadConfig();

			if (executeLogger) {
				executeLogger.debug`Executing suggestion id=${suggestion.id} action=${suggestion.action} source=${filename} ${cid}`;
			}

			// Hash the SOURCE file FIRST - this provides our unique ID for filename generation
			let hash: string;
			try {
				hash = await hashFile(sourcePath);
			} catch (error) {
				const errorCode = categorizeError(error);
				return {
					suggestionId: suggestion.id,
					success: false,
					action: suggestion.action,
					error: `Failed to hash source file [${errorCode}]: ${error instanceof Error ? error.message : "unknown"}`,
				};
			}

			// Generate attachment filename with hash prefix
			// Format: YYYYMMDD-hash4-description.ext (hash guarantees uniqueness)
			let hashedFilename: string;

			// Extract suggestedAttachmentName if present on the suggestion type
			// (available on create-note, move, rename, and link suggestions)
			const suggestedName =
				"suggestedAttachmentName" in suggestion
					? suggestion.suggestedAttachmentName
					: undefined;

			const hashPrefix = getHashPrefix(hash);

			if (suggestedName) {
				// Use the pre-generated attachment name from scan phase
				hashedFilename = suggestedName;
			} else {
				// Fallback: generate filename using available suggestion data
				const noteType =
					"suggestedNoteType" in suggestion
						? suggestion.suggestedNoteType
						: undefined;
				const fields =
					"extractedFields" in suggestion
						? suggestion.extractedFields
						: undefined;
				hashedFilename = generateFilename(
					suggestion.source,
					hash,
					noteType,
					fields,
				);
			}

			const attachmentDest = join(
				config.vaultPath,
				config.attachmentsFolder,
				hashedFilename,
			);
			const movedAttachmentPath = join(
				config.attachmentsFolder,
				hashedFilename,
			);

			if (executeLogger) {
				executeLogger.debug`Generated filename=${hashedFilename} hash=${hashPrefix} ${cid}`;
			}

			let createdNotePath: string | undefined;
			let stagingNotePath: string | undefined;

			// Layer 2: Mark operation as in-progress in registry before any writes
			// This allows cleanup job to detect interrupted operations
			const inProgressMarker = {
				sourceHash: hash,
				sourcePath: suggestion.source,
				processedAt: new Date().toISOString(),
				inProgress: true,
			};
			registry.markInProgress(inProgressMarker);
			await registry.save();

			// Bookmarks are special: the source .md file IS the note (already has frontmatter+content)
			// Skip template creation and move the file directly to destination instead of Attachments
			const isBookmark =
				suggestion.action === "create-note" &&
				suggestion.suggestedNoteType === "bookmark";

			// Type A documents: markdown is the source of truth (e.g., CVs, letters)
			// The extracted markdown is embedded directly in the note body
			// The source file (DOCX) is deleted - NOT moved to Attachments
			const isTypeA =
				suggestion.action === "create-note" &&
				"sourceOfTruth" in suggestion &&
				suggestion.sourceOfTruth === "markdown" &&
				"suggestedContent" in suggestion &&
				typeof suggestion.suggestedContent === "string" &&
				suggestion.suggestedContent.length > 0;

			if (executeLogger) {
				executeLogger.debug`Type detection: isBookmark=${isBookmark} isTypeA=${isTypeA} sourceOfTruth=${"sourceOfTruth" in suggestion ? suggestion.sourceOfTruth : "n/a"} contentLength=${"suggestedContent" in suggestion ? ((suggestion.suggestedContent as string)?.length ?? 0) : 0} ${cid}`;
			}

			// Create note FIRST if action is create-note (before moving attachment)
			// Layer 1: Use staging directory pattern for atomic operations
			if (
				suggestion.action === "create-note" &&
				suggestion.suggestedNoteType &&
				suggestion.suggestedTitle &&
				!isBookmark // Skip template creation for bookmarks
			) {
				try {
					// Build args from suggestion using converter field mappings
					let args: Record<string, string> = {};

					// Find converter for this note type to get field mappings
					const converter = DEFAULT_CLASSIFIERS.find(
						(c) => c.id === suggestion.suggestedNoteType,
					);

					// Map extracted fields using converter (LLM keys → Templater prompts)
					if (suggestion.extractedFields && converter) {
						args = mapFieldsToTemplate(suggestion.extractedFields, converter);
					} else if (suggestion.extractedFields) {
						// Fallback: use raw field names if no converter found
						for (const [key, value] of Object.entries(
							suggestion.extractedFields,
						)) {
							if (typeof value === "string") {
								args[key] = value;
							} else if (value !== null && value !== undefined) {
								args[key] = String(value);
							}
						}
					}

					// Note: Area/project routing removed - all items go to inbox
					// User assigns area/project manually in Obsidian after review

					// Create note in staging directory first (.inbox-staging)
					const stagingDir = join(config.vaultPath, ".inbox-staging");
					ensureDirSync(stagingDir);

					// Use classifier's template name if available (e.g., "generic" ID → "document" template)
					const templateName =
						converter?.template.name ?? suggestion.suggestedNoteType;
					const result = createFromTemplate(paraConfig, {
						template: templateName,
						title: suggestion.suggestedTitle,
						dest: ".inbox-staging", // Stage in temp location
						args,
					});

					stagingNotePath = result.filePath;

					if (executeLogger) {
						executeLogger.info`Created note in staging path=${stagingNotePath} ${cid}`;
					}

					// TYPE A: Inject extracted markdown content into the note body
					// This replaces the default empty note with the actual DOCX content
					if (isTypeA && "suggestedContent" in suggestion) {
						try {
							const stagingAbsolute = join(config.vaultPath, stagingNotePath);
							const existingContent = readTextFileSync(stagingAbsolute);

							// Parse existing frontmatter and body
							const { attributes, body: existingBody } =
								parseFrontmatter(existingContent);

							// Build new body with extracted markdown
							// Keep heading and any template comments, append the extracted content
							const extractedMarkdown = suggestion.suggestedContent as string;
							const newBody = `${existingBody.trim()}\n\n${extractedMarkdown}`;

							// Serialize and write back
							const updatedContent = serializeFrontmatter(attributes, newBody);
							writeTextFileSync(stagingAbsolute, updatedContent);

							if (executeLogger) {
								executeLogger.info`Type A: Injected extracted markdown content (${extractedMarkdown.length} chars) into note ${cid}`;
							}
						} catch (error) {
							if (executeLogger) {
								executeLogger.warn`Failed to inject Type A content: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
							}
							// Non-fatal - note still created with template content
						}
					}
				} catch (error) {
					// Note creation failed - clean up in-progress marker
					registry.clearInProgress(hash);
					await registry.save();

					if (executeLogger) {
						executeLogger.error`Failed to create note: ${error instanceof Error ? error.message : "unknown"} - attachment remains in inbox for retry ${cid}`;
					}
					return {
						suggestionId: suggestion.id,
						success: false,
						action: suggestion.action,
						error: `Note creation failed: ${error instanceof Error ? error.message : "unknown"}. Attachment remains in inbox - fix the issue and retry.`,
					};
				}
			}

			// For bookmarks: move source .md directly to final destination (it IS the note)
			// For other types: move source to Attachments folder (it's an attachment like PDF)
			let actualDestination: string;
			let movedFilePath: string;

			if (isBookmark) {
				// Determine final destination for bookmark
				let finalDest: string;
				if (
					"suggestedDestination" in suggestion &&
					suggestion.suggestedDestination
				) {
					// Resolve semantic PARA names (e.g., "Resources" → "03 Resources")
					finalDest = resolveParaFolder(
						suggestion.suggestedDestination,
						paraConfig.paraFolders,
						config.vaultPath,
						options,
					);
				} else {
					finalDest =
						paraConfig.defaultDestinations?.[suggestion.suggestedNoteType] ??
						"00 Inbox";
				}

				// Bookmarks go directly to the resolved destination without type-specific subfolders

				// Read frontmatter to get improved title for filename (if enriched)
				// Otherwise fall back to original filename
				let bookmarkFilename = basename(sourcePath);
				try {
					const sourceContent = readTextFileSync(sourcePath);
					const { attributes } = parseFrontmatter(sourceContent);
					// Use improvedTitle if available (set by Firecrawl enrichment)
					// This is the clean, LLM-generated title without emoji prefix
					if (
						typeof attributes.improvedTitle === "string" &&
						attributes.improvedTitle.trim()
					) {
						// Apply emoji prefix from config (e.g., "✂️ ")
						const { applyTitlePrefix } = await import("../../../utils/title");
						const prefixedTitle = applyTitlePrefix(
							attributes.improvedTitle,
							"bookmark",
							paraConfig,
						);

						// Sanitize title for filename: remove unsafe characters
						const sanitized = prefixedTitle
							.trim()
							.replace(/[<>:"/\\|?*]/g, "") // Remove Windows-unsafe chars
							.replace(/\s+/g, " ") // Normalize whitespace
							.slice(0, 100); // Limit length
						bookmarkFilename = `${sanitized}.md`;
						if (executeLogger) {
							executeLogger.debug`Using improved title for bookmark filename: ${bookmarkFilename} ${cid}`;
						}
					}
				} catch {
					// If we can't read frontmatter, use original filename
					if (executeLogger) {
						executeLogger.debug`Could not read frontmatter for bookmark, using original filename ${cid}`;
					}
				}
				const bookmarkDest = join(
					config.vaultPath,
					finalDest,
					bookmarkFilename,
				);

				// Ensure unique path
				actualDestination = generateUniquePath(bookmarkDest);
				movedFilePath = join(finalDest, basename(actualDestination));

				if (executeLogger) {
					executeLogger.info`Moving bookmark to ${movedFilePath} ${cid}`;
				}
			} else if (isTypeA) {
				// TYPE A: Delete source file (content already embedded in note)
				// No attachment to move - the DOCX content is now in the markdown note
				try {
					const { unlink } = await import("node:fs/promises");
					await unlink(sourcePath);
					if (executeLogger) {
						executeLogger.info`Type A: Deleted source DOCX (content embedded in note) ${cid}`;
					}
				} catch (error) {
					// Non-fatal - log warning but continue
					if (executeLogger) {
						executeLogger.warn`Type A: Failed to delete source file: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
					}
				}
				// No attachment path for Type A
				actualDestination = "";
				movedFilePath = "";
			} else {
				// Standard attachment workflow
				actualDestination = attachmentDest;
				movedFilePath = movedAttachmentPath;
			}

			// Now move the file (bookmark or standard attachment - NOT Type A)
			if (!isTypeA && actualDestination) {
				ensureDirSync(dirname(actualDestination));

				// File-level locking to prevent TOCTOU race conditions
				// Protects against file being deleted/modified between existence check and move
				const lockId = `file:${basename(sourcePath)}`;
				try {
					await withFileLock(lockId, async () => {
						// TOCTOU protection: Check file still exists before moving
						// File was hashed earlier, but could have been deleted by another process
						if (!pathExistsSync(sourcePath)) {
							throw new Error(
								`Source file no longer exists: ${sourcePath}. It may have been moved or deleted by another process.`,
							);
						}

						// Move file atomically while holding lock
						await moveFile(sourcePath, actualDestination);
					});
				} catch (error) {
					const _errorCode = categorizeError(error);
					// ROLLBACK: Clean up staging note and in-progress marker
					await rollbackOperation(
						config.vaultPath,
						stagingNotePath,
						hash,
						registry,
						cid,
					);

					// Log the failure and return error
					if (executeLogger) {
						executeLogger.error`Failed to move file: ${error instanceof Error ? error.message : "unknown"} - file remains in inbox ${cid}`;
					}

					return {
						suggestionId: suggestion.id,
						success: false,
						action: suggestion.action,
						error: `Operation failed and was rolled back: ${error instanceof Error ? error.message : "unknown"}. File remains in inbox - fix the issue and retry.`,
					};
				}
			}

			// SUCCESS: Move staged note to final destination atomically
			if (stagingNotePath) {
				try {
					// Determine final destination:
					// 1. Use explicit suggestedDestination if set
					// 2. Resolve suggestedArea to "02 Areas/{area}" if area exists in vault
					// 3. Resolve suggestedProject to "01 Projects/{project}" if project exists in vault
					// 4. Fall back to defaultDestinations for the note type
					// All items now go to inbox - no area/project routing
					// User assigns area/project manually in Obsidian after review
					let finalDest: string;
					if (
						"suggestedDestination" in suggestion &&
						suggestion.suggestedDestination
					) {
						// Resolve semantic PARA names (e.g., "Resources" → "03 Resources")
						finalDest = resolveParaFolder(
							suggestion.suggestedDestination,
							paraConfig.paraFolders,
							config.vaultPath,
							options,
						);
					} else {
						// PARA method: all notes go to inbox by default
						finalDest = "00 Inbox";
					}

					// Note: Bookmarks are handled earlier in the bookmark-specific branch
					// Non-bookmark notes go directly to the resolved destination without type-specific subfolders

					const stagingAbsolute = resolveVaultPath(
						paraConfig.vault,
						stagingNotePath,
					);
					const finalRelative = join(finalDest, basename(stagingNotePath));
					const finalAbsolute = resolveVaultPath(
						paraConfig.vault,
						finalRelative,
					);

					// Atomic rename from staging to final location
					await moveFile(stagingAbsolute.absolute, finalAbsolute.absolute);
					createdNotePath = finalRelative;

					if (executeLogger) {
						executeLogger.info`Moved note from staging to final destination=${createdNotePath} ${cid}`;
					}
				} catch (error) {
					const errorCode = categorizeError(error);
					// Critical: attachment moved but note stuck in staging
					// Log error but don't fail - cleanup job will handle orphans
					if (executeLogger) {
						executeLogger.error`Failed to move note from staging [${errorCode}]: ${error instanceof Error ? error.message : "unknown"} - note left in staging for cleanup ${cid}`;
					}

					// Mark staging path in registry for cleanup detection
					registry.markProcessed({
						sourceHash: hash,
						sourcePath: suggestion.source,
						processedAt: new Date().toISOString(),
						createdNote: stagingNotePath,
						movedAttachment: movedAttachmentPath,
						orphanedInStaging: true,
					});
					await registry.save();

					return {
						suggestionId: suggestion.id,
						success: true,
						action: suggestion.action,
						createdNote: undefined,
						movedAttachment: movedAttachmentPath,
						warning:
							"Note created in staging but move failed - will be cleaned up automatically",
					};
				}
			}

			// For bookmarks: the moved file IS the note
			// Update frontmatter with LLM-extracted fields
			if (isBookmark) {
				// Set createdNote to the bookmark file path
				createdNotePath = movedFilePath;

				// Update frontmatter with extracted fields
				if (suggestion.action === "create-note" && suggestion.extractedFields) {
					try {
						const target = resolveVaultPath(paraConfig.vault, createdNotePath);
						const content = readTextFileSync(target.absolute);
						const { attributes, body } = parseFrontmatter(content);

						// Note: Area/project routing removed - user assigns manually

						// Update fields from LLM extraction
						for (const [key, value] of Object.entries(
							suggestion.extractedFields,
						)) {
							if (key === "category" || key === "author") {
								// Strip wikilinks from category/author fields
								// "[[Documentation]]" → "Documentation"
								if (typeof value === "string") {
									attributes[key] = value.replace(/\[\[([^\]]+)\]\]/g, "$1");
								}
							} else if (value !== null && value !== undefined) {
								attributes[key] = value;
							}
						}

						// Write updated frontmatter
						const updated = serializeFrontmatter(attributes, body);
						writeTextFileSync(target.absolute, updated);

						if (executeLogger) {
							executeLogger.info`Updated bookmark frontmatter with LLM fields ${cid}`;
						}
					} catch (error) {
						const errorCode = categorizeError(error);
						if (executeLogger) {
							executeLogger.warn`Failed to update bookmark frontmatter [${errorCode}]: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
						}
						// Don't fail - file moved successfully, just missing frontmatter updates
					}
				}
			} else if (createdNotePath && !isTypeA) {
				// Inject attachment link into the note (if note was created and NOT Type A)
				// Type A documents have content embedded in the note body - no attachments
				try {
					const attachmentWikilink = `![[${movedFilePath}]]`;
					const injectionResult = injectSections(paraConfig, createdNotePath, {
						Attachments: attachmentWikilink,
					});

					if (injectionResult.injected.length > 0) {
						if (executeLogger) {
							executeLogger.info`Injected attachment link into section=Attachments ${cid}`;
						}
					} else if (injectionResult.skipped.length > 0) {
						// Section doesn't exist - append to end of file
						if (executeLogger) {
							executeLogger.warn`No Attachments section found - appending to end of file ${cid}`;
						}
						const target = resolveVaultPath(paraConfig.vault, createdNotePath);
						const content = readTextFileSync(target.absolute);
						const updatedContent = `${content.trimEnd()}\n\n## Attachments\n\n${attachmentWikilink}\n`;
						writeTextFileSync(target.absolute, updatedContent);
						if (executeLogger) {
							executeLogger.info`Created Attachments section and added link ${cid}`;
						}
					}
				} catch (error) {
					const errorCode = categorizeError(error);
					if (executeLogger) {
						executeLogger.warn`Failed to inject attachment link [${errorCode}]: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
					}
					// Don't fail - note and attachment move succeeded, just missing link
				}
			}

			// Update registry - clear in-progress flag and mark as completed
			// IMPORTANT: In-memory state changes must succeed atomically with disk save.
			// If save() fails after modifying state, we'd have inconsistent registry.
			// Registry modifications are deferred - save() happens in engine.ts after this returns.
			// If save() throws, the entire operation is rolled back via catch handler in engine.ts.
			registry.clearInProgress(hash);

			// Mark processed based on document type:
			// - Type A: Track as "note" (markdown is source of truth, no attachment)
			// - Type B: Track as "attachment" (attachment is source of truth)
			// - Bookmarks: Skip registry (handled separately)
			if (!isBookmark) {
				if (isTypeA) {
					// Type A: Track the note itself (no attachment exists)
					registry.markProcessed({
						sourceHash: hash,
						sourcePath: suggestion.source,
						processedAt: new Date().toISOString(),
						createdNote: createdNotePath,
						// Use createdNote as movedAttachment for registry validation
						// This satisfies restrictRegistryToAttachments check while tracking Type A docs
						movedAttachment: createdNotePath ?? "",
						itemType: "note",
					});
				} else if (movedFilePath) {
					// Type B: Track the attachment (standard behavior)
					registry.markProcessed({
						sourceHash: hash,
						sourcePath: suggestion.source,
						processedAt: new Date().toISOString(),
						createdNote: createdNotePath,
						movedAttachment: movedFilePath,
						itemType: "attachment",
					});
				}
			}

			// NOTE: registry.save() is called in engine.ts (line 1079) after this function returns.
			// If save() fails, it throws REG_WRITE_FAILED which is caught in engine.ts try/catch (line 1099).
			// This ensures the operation is marked as failed and in-memory state changes are abandoned.
			// The registry uses atomic writes (temp file + rename) to prevent corruption on disk.

			// Note: Auto-commit removed from per-operation execution
			// Commits are now batched at session level in engine.ts for cleaner history

			if (executeLogger) {
				const attachment = isTypeA
					? "(Type A: content embedded)"
					: isBookmark
						? movedFilePath
						: hashedFilename;
				executeLogger.info`Executed suggestion id=${suggestion.id} movedTo=${attachment} createdNote=${createdNotePath ?? "none"} ${cid}`;
			}

			return {
				suggestionId: suggestion.id,
				success: true,
				action: suggestion.action,
				createdNote: createdNotePath,
				// Type A and bookmarks don't have attachments
				movedAttachment: isBookmark || isTypeA ? undefined : movedFilePath,
				movedFrom: suggestion.source,
			};
		},
		{
			parentCid: sessionCid,
			context: {
				suggestionId: suggestion.id,
				action: suggestion.action,
				...(sessionCid && { sessionCid }),
			},
		},
	);
}
