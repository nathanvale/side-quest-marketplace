/**
 * CLI Adapter for Inbox Processing
 *
 * Provides terminal UX for the interactive approval workflow.
 * Thin adapter that calls the engine for actual processing.
 */

import { input } from "@inquirer/prompts";
import { emphasize } from "@sidequest/core/terminal";
import { createSpinner } from "nanospinner";
import type {
	CLICommand,
	Confidence,
	DetectionSource,
	ExecutionResult,
	InboxEngine,
	InboxSuggestion,
	SuggestionId,
} from "../types";
import { isCreateNoteSuggestion } from "../types";

// =============================================================================
// Command Parsing
// =============================================================================

/**
 * Sanitize user-provided prompt to prevent prompt injection attacks.
 *
 * @param prompt - Raw prompt string from user input
 * @returns Sanitized prompt string
 *
 * @internal
 * Removes:
 * - Code blocks (potential instruction injection)
 * - Angle brackets (XML/HTML injection)
 * - Common injection patterns ("ignore previous instructions", etc.)
 * - Excessive length (token stuffing attacks)
 *
 * Logs when sanitization modifies input for security monitoring.
 */
function sanitizePrompt(prompt: string): string {
	const original = prompt;

	const sanitized = prompt
		// Remove potential code blocks that could contain instructions
		.replace(/```[\s\S]*?```/g, "[code removed]")
		// Remove angle brackets (potential XML/HTML injection)
		.replace(/[<>]/g, "")
		// Remove common injection patterns
		.replace(/ignore\s+(all\s+)?previous\s+instructions?/gi, "[filtered]")
		.replace(/instead\s*,?\s*(do|output|return|print)/gi, "[filtered]")
		// Limit length to prevent token stuffing (500 chars is reasonable for edit prompts)
		.slice(0, 500)
		.trim();

	// Log when sanitization modifies input for security monitoring
	if (sanitized !== original) {
		console.warn(
			"[SECURITY] Prompt sanitized. Original length:",
			original.length,
			"Sanitized length:",
			sanitized.length,
		);
	}

	return sanitized;
}

/**
 * Parse user input into a structured CLI command.
 *
 * @param input - Raw user input string
 * @returns Parsed CLICommand
 *
 * @example
 * parseCommand("a")           // { type: "approve-all" }
 * parseCommand("1,2,5")       // { type: "approve", ids: [1,2,5] }
 * parseCommand("e3 prompt")   // { type: "edit", id: 3, prompt: "prompt" }
 * parseCommand("s3")          // { type: "skip", id: 3 }
 * parseCommand("v3")          // { type: "view", id: 3 }
 * parseCommand("u")           // { type: "undo" }
 * parseCommand("n")           // { type: "next-page" }
 * parseCommand("p")           // { type: "prev-page" }
 * parseCommand("q")           // { type: "quit" }
 * parseCommand("h")           // { type: "help" }
 * parseCommand("", true)       // { type: "execute" } (when hasApproved=true)
 * parseCommand("", false)      // { type: "invalid", input: "" }
 */
export function parseCommand(
	input: string,
	hasApprovedItems = false,
): CLICommand {
	const trimmed = input.trim();

	// Empty input: execute if items are approved, otherwise invalid
	// This provides explicit command semantics for Enter key
	if (trimmed === "") {
		return hasApprovedItems
			? { type: "execute" }
			: { type: "invalid", input: trimmed };
	}

	const lower = trimmed.toLowerCase();

	// Single character commands
	if (lower === "a") {
		return { type: "approve-all" };
	}

	if (lower === "q") {
		return { type: "quit" };
	}

	if (lower === "h" || trimmed === "?") {
		return { type: "help" };
	}

	if (lower === "u") {
		return { type: "undo" };
	}

	if (lower === "n") {
		return { type: "next-page" };
	}

	if (lower === "p") {
		return { type: "prev-page" };
	}

	// View command: v<id>
	const viewMatch = trimmed.match(/^[vV](\d+)$/);
	if (viewMatch?.[1]) {
		const id = Number.parseInt(viewMatch[1], 10);
		return { type: "view", id };
	}

	// Edit command: e<id> <prompt>
	const editMatch = trimmed.match(/^[eE](\d+)\s+(.+)$/);
	if (editMatch?.[1] && editMatch[2]) {
		const id = Number.parseInt(editMatch[1], 10);
		let prompt = editMatch[2];
		// Remove surrounding quotes if present
		if (
			(prompt.startsWith('"') && prompt.endsWith('"')) ||
			(prompt.startsWith("'") && prompt.endsWith("'"))
		) {
			prompt = prompt.slice(1, -1);
		}
		// Sanitize prompt to prevent injection attacks
		prompt = sanitizePrompt(prompt);
		// Handle edge case: sanitization results in empty prompt
		if (prompt.length === 0) {
			return { type: "invalid", input: trimmed };
		}
		return { type: "edit", id, prompt };
	}

	// Edit without prompt is invalid
	if (/^[eE]\d*$/.test(trimmed)) {
		return { type: "invalid", input: trimmed };
	}

	// Skip command: s<id>
	const skipMatch = trimmed.match(/^[sS](\d+)$/);
	if (skipMatch?.[1]) {
		const id = Number.parseInt(skipMatch[1], 10);
		return { type: "skip", id };
	}

	// Skip without id is invalid
	if (/^[sS]$/.test(trimmed)) {
		return { type: "invalid", input: trimmed };
	}

	// Approve by IDs: 1,2,5 or 1, 2, 5
	const idsMatch = trimmed.match(/^[\d,\s]+$/);
	if (idsMatch) {
		const ids = trimmed
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s !== "")
			.map((s) => Number.parseInt(s, 10))
			.filter((n) => !Number.isNaN(n));

		if (ids.length > 0) {
			return { type: "approve", ids };
		}
	}

	// Unknown command
	return { type: "invalid", input: trimmed };
}

// =============================================================================
// Display Formatting
// =============================================================================

/**
 * Format confidence level with icon and color.
 *
 * @param confidence - Confidence level
 * @returns Formatted string with icon
 */
export function formatConfidence(confidence: Confidence): string {
	switch (confidence) {
		case "high":
			return emphasize.success("✓");
		case "medium":
			return emphasize.warn("?");
		case "low":
			return emphasize.error("⚠");
	}
}

/**
 * Format detection source with icon.
 * Shows whether LLM contributed to the classification.
 *
 * @param source - Detection source type
 * @returns Formatted string with icon
 */
export function formatDetectionSource(source: DetectionSource): string {
	switch (source) {
		case "llm+heuristic":
			return emphasize.success("🤖✓"); // LLM and heuristics agree
		case "llm":
			return emphasize.info("🤖"); // LLM only
		case "heuristic":
			return emphasize.warn("📋"); // Heuristic only (LLM failed/disagreed)
		case "none":
			return emphasize.dim("—"); // Neither detected
		default:
			return emphasize.dim("?");
	}
}

/**
 * Extract filename from a path.
 */
function getFilename(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] || path;
}

/**
 * Format a single suggestion for display.
 *
 * @param suggestion - The inbox suggestion to format
 * @param index - 1-based index for display
 * @returns Formatted string
 */
export function formatSuggestion(
	suggestion: InboxSuggestion,
	index: number,
): string {
	const filename = getFilename(suggestion.source);
	const confidence = formatConfidence(suggestion.confidence);
	const sourceIcon = formatDetectionSource(suggestion.detectionSource);
	const hasWarnings =
		suggestion.extractionWarnings && suggestion.extractionWarnings.length > 0;
	const lines: string[] = [];

	// Main line: index, confidence, source icon, filename, action, warning indicator
	const warningIndicator = hasWarnings ? emphasize.warn(" ⚠") : "";
	const mainLine = `${emphasize.info(`[${index}]`)} ${confidence} ${sourceIcon} ${emphasize.info(filename)} → ${suggestion.action}${warningIndicator}`;
	lines.push(mainLine);

	// Details on subsequent lines (only for create-note suggestions)
	if (isCreateNoteSuggestion(suggestion)) {
		lines.push(`    Title: ${suggestion.suggestedTitle}`);
		if (suggestion.suggestedArea) {
			lines.push(`    Area: ${suggestion.suggestedArea}`);
		}
		lines.push(`    Type: ${suggestion.suggestedNoteType}`);
	}

	lines.push(`    ${emphasize.dim(suggestion.reason)}`);

	// Display extraction warnings if present (collapsed - use v<n> for details)
	if (hasWarnings) {
		const warningCount = suggestion.extractionWarnings?.length ?? 0;
		lines.push(
			`    ${emphasize.warn(`⚠ ${warningCount} warning(s) - use v${index} for details`)}`,
		);
	}

	return lines.join("\n");
}

/**
 * Format detailed view of a suggestion for the v<n> command.
 *
 * @param suggestion - The inbox suggestion to display
 * @param index - 1-based index for display
 * @returns Formatted details string
 */
export function formatSuggestionDetails(
	suggestion: InboxSuggestion,
	index: number,
): string {
	const filename = getFilename(suggestion.source);
	const lines: string[] = [];

	lines.push(emphasize.info(`── Item ${index}: ${filename} ──`));
	lines.push("");
	lines.push(`  Source:      ${suggestion.source}`);
	lines.push(`  Action:      ${suggestion.action}`);
	lines.push(
		`  Confidence:  ${suggestion.confidence} (${suggestion.detectionSource})`,
	);
	lines.push(`  Reason:      ${suggestion.reason}`);

	if (isCreateNoteSuggestion(suggestion)) {
		lines.push("");
		lines.push(emphasize.dim("  Classification:"));
		lines.push(`    Type:      ${suggestion.suggestedNoteType}`);
		lines.push(`    Title:     ${suggestion.suggestedTitle}`);
		if (suggestion.suggestedDestination) {
			lines.push(`    Dest:      ${suggestion.suggestedDestination}`);
		}
		if (suggestion.suggestedArea) {
			lines.push(`    Area:      ${suggestion.suggestedArea}`);
		}
		if (suggestion.suggestedProject) {
			lines.push(`    Project:   ${suggestion.suggestedProject}`);
		}

		// Show extracted fields if available
		if (
			suggestion.extractedFields &&
			Object.keys(suggestion.extractedFields).length > 0
		) {
			lines.push("");
			lines.push(emphasize.dim("  Extracted Fields:"));
			for (const [key, value] of Object.entries(suggestion.extractedFields)) {
				if (value !== null && value !== undefined && value !== "") {
					lines.push(`    ${key}: ${String(value)}`);
				}
			}
		}

		// Show attachment naming if available
		if (suggestion.suggestedAttachmentName) {
			lines.push("");
			lines.push(emphasize.dim("  Attachment:"));
			lines.push(`    New name:  ${suggestion.suggestedAttachmentName}`);
		}
	}

	// Show warnings in detail
	if (
		suggestion.extractionWarnings &&
		suggestion.extractionWarnings.length > 0
	) {
		lines.push("");
		lines.push(emphasize.warn("  Warnings:"));
		for (const warning of suggestion.extractionWarnings) {
			lines.push(`    ${emphasize.warn(`• ${warning}`)}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/** Default page size for pagination */
export const PAGE_SIZE = 5;

/**
 * Pagination state for the interactive loop.
 */
export interface PaginationState {
	currentPage: number;
	pageSize: number;
	totalItems: number;
}

/**
 * Get paginated slice of suggestions.
 */
export function paginateSuggestions(
	suggestions: InboxSuggestion[],
	page: number,
	pageSize: number = PAGE_SIZE,
): InboxSuggestion[] {
	const start = page * pageSize;
	return suggestions.slice(start, start + pageSize);
}

/**
 * Format multiple suggestions as a table/list with pagination.
 *
 * @param suggestions - Array of suggestions to format (current page only)
 * @param originalIndices - Map of suggestion ID to original 1-based index
 * @param pagination - Pagination state for header/footer
 * @returns Formatted table string
 */
export function formatSuggestionsTable(
	suggestions: InboxSuggestion[],
	originalIndices?: Map<string, number>,
	pagination?: PaginationState,
): string {
	if (suggestions.length === 0) {
		return "";
	}

	const lines: string[] = [];

	// Header with pagination info
	if (pagination && pagination.totalItems > pagination.pageSize) {
		const start = pagination.currentPage * pagination.pageSize + 1;
		const end = Math.min(start + suggestions.length - 1, pagination.totalItems);
		const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
		lines.push(
			emphasize.info(
				`═══ Inbox Suggestions (${start}-${end} of ${pagination.totalItems}) ═══`,
			),
		);
		lines.push(
			emphasize.dim(
				`    Page ${pagination.currentPage + 1}/${totalPages} | n=next, p=prev`,
			),
		);
	} else {
		lines.push(emphasize.info("═══ Inbox Suggestions ═══"));
	}
	lines.push("");

	// Format each suggestion using original indices if provided
	for (const [i, suggestion] of suggestions.entries()) {
		const displayIndex = originalIndices
			? (originalIndices.get(suggestion.id) ?? i + 1)
			: i + 1;
		lines.push(formatSuggestion(suggestion, displayIndex));
		if (i < suggestions.length - 1) {
			lines.push(""); // Blank line between suggestions
		}
	}

	// Footer with warning summary
	const warningCount = suggestions.filter(
		(s) => s.extractionWarnings && s.extractionWarnings.length > 0,
	).length;
	lines.push("");
	if (warningCount > 0) {
		const warningIndices = suggestions
			.filter((s) => s.extractionWarnings && s.extractionWarnings.length > 0)
			.map((s) => (originalIndices ? (originalIndices.get(s.id) ?? "?") : "?"))
			.join(", ");
		lines.push(
			emphasize.warn(
				`⚠ ${warningCount} item(s) have warnings: ${warningIndices}`,
			),
		);
	}
	if (pagination) {
		lines.push(
			emphasize.dim(`${pagination.totalItems} item(s) total | Type ? for help`),
		);
	} else {
		lines.push(
			emphasize.dim(
				`${suggestions.length} item(s) to process | Type ? for help`,
			),
		);
	}

	return lines.join("\n");
}

// =============================================================================
// Help Text
// =============================================================================

/**
 * Get the help text for the interactive CLI.
 *
 * @returns Formatted help string
 */
export function getHelpText(): string {
	const lines = [
		emphasize.info("═══ Commands ═══"),
		"",
		`  ${emphasize.success("a")}           Approve all visible items`,
		`  ${emphasize.success("1,2,5")}       Approve specific items by number`,
		`  ${emphasize.success("v<n>")}        View details of item #n`,
		`  ${emphasize.success("e<n> <hint>")} Edit suggestion #n with hint`,
		`  ${emphasize.success("s<n>")}        Skip item #n`,
		`  ${emphasize.success("u")}           Undo last approval (before execute)`,
		`  ${emphasize.success("n")} / ${emphasize.success("p")}       Next / Previous page`,
		`  ${emphasize.success("q")}           Quit without processing`,
		`  ${emphasize.success("?")}           Show this help`,
		"",
		emphasize.dim("Examples:"),
		emphasize.dim("  3              - approve item 3"),
		emphasize.dim("  1,3,5          - approve items 1, 3, and 5"),
		emphasize.dim("  v2             - view details of item 2"),
		emphasize.dim('  e2 "use Work"  - re-classify item 2'),
	];

	return lines.join("\n");
}

// =============================================================================
// Interactive Loop
// =============================================================================

/**
 * Options for running the interactive approval loop.
 */
export interface InteractiveOptions {
	/** The inbox engine to use for processing */
	engine: InboxEngine;

	/** Suggestions to display and process */
	suggestions: InboxSuggestion[];

	/** Page size for pagination (default: PAGE_SIZE) */
	pageSize?: number;
}

/**
 * Format a confirmation preview for approved items.
 */
function formatConfirmationPreview(
	suggestions: InboxSuggestion[],
	originalIndices: Map<SuggestionId, number>,
): string {
	const lines: string[] = [];
	lines.push("");
	lines.push(emphasize.info("═══ Confirm Execution ═══"));
	lines.push("");
	lines.push(`Will process ${suggestions.length} item(s):`);
	lines.push("");

	for (const s of suggestions) {
		const idx = originalIndices.get(s.id) ?? "?";
		const filename = s.source.split("/").pop() ?? s.source;
		if (isCreateNoteSuggestion(s)) {
			lines.push(`  [${idx}] ${filename}`);
			lines.push(`       → Create: ${s.suggestedTitle}`);
			if (s.suggestedAttachmentName) {
				lines.push(
					`       → Move to: Attachments/${s.suggestedAttachmentName}`,
				);
			}
		} else {
			lines.push(`  [${idx}] ${filename} → ${s.action}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * Run the interactive approval loop.
 *
 * Features:
 * - Pagination (n/p to navigate)
 * - View details (v<n>)
 * - Undo approvals (u)
 * - Confirmation before execute
 *
 * @param options - Configuration for the interactive loop
 * @returns Array of approved suggestion IDs
 */
export async function runInteractiveLoop(
	options: InteractiveOptions,
): Promise<SuggestionId[]> {
	const { engine, suggestions, pageSize = PAGE_SIZE } = options;
	const approved = new Set<SuggestionId>();
	const approvalHistory: SuggestionId[] = []; // For undo
	const skipped = new Set<SuggestionId>();
	const currentSuggestions = [...suggestions];
	let isProcessing = false;
	let currentPage = 0;

	// Create stable ID-to-suggestion map and original index mapping
	const suggestionById = new Map<SuggestionId, InboxSuggestion>();
	const originalIndices = new Map<SuggestionId, number>();
	for (const [i, s] of currentSuggestions.entries()) {
		suggestionById.set(s.id, s);
		originalIndices.set(s.id, i + 1); // Store 1-based display index
	}

	while (true) {
		// Filter out skipped items for display
		const displayable = currentSuggestions.filter((s) => !skipped.has(s.id));

		if (displayable.length === 0) {
			console.log(emphasize.info("\nNo items remaining."));
			break;
		}

		// Pagination
		const totalPages = Math.ceil(displayable.length / pageSize);
		currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));
		const pageItems = paginateSuggestions(displayable, currentPage, pageSize);

		const pagination: PaginationState = {
			currentPage,
			pageSize,
			totalItems: displayable.length,
		};

		// Display suggestions with pagination
		console.log(formatSuggestionsTable(pageItems, originalIndices, pagination));
		console.log("");

		// Show approved count if any
		if (approved.size > 0) {
			console.log(
				emphasize.success(
					`✓ ${approved.size} item(s) approved (press Enter to execute, u to undo)`,
				),
			);
		}

		// Get user input
		const userInput = await input({ message: "> " });

		// Parse command with context about approved state
		// This ensures all user input goes through the discriminated union
		const command = parseCommand(userInput, approved.size > 0);

		switch (command.type) {
			case "execute":
				// Explicit execution command (Enter key when items approved)
				return Array.from(approved);

			case "quit":
				console.log(emphasize.warn("\nQuitting without executing."));
				return [];

			case "next-page":
				if (currentPage < totalPages - 1) {
					currentPage++;
				} else {
					console.log(emphasize.dim("Already on last page."));
				}
				break;

			case "prev-page":
				if (currentPage > 0) {
					currentPage--;
				} else {
					console.log(emphasize.dim("Already on first page."));
				}
				break;

			case "view": {
				// Find suggestion by original index
				const targetSuggestion = currentSuggestions.find(
					(s) => originalIndices.get(s.id) === command.id,
				);

				if (!targetSuggestion) {
					console.log(emphasize.error(`Invalid item number: ${command.id}`));
					break;
				}

				console.log(formatSuggestionDetails(targetSuggestion, command.id));
				break;
			}

			case "undo": {
				if (approvalHistory.length === 0) {
					console.log(emphasize.dim("Nothing to undo."));
					break;
				}

				const lastApproved = approvalHistory.pop();
				if (lastApproved) {
					approved.delete(lastApproved);
					const idx = originalIndices.get(lastApproved) ?? "?";
					console.log(emphasize.warn(`Undid approval of item ${idx}.`));
				}
				break;
			}

			case "approve-all": {
				if (isProcessing) {
					console.log(
						emphasize.warn(
							"\n⏳ Please wait for previous operation to complete...",
						),
					);
					break;
				}
				isProcessing = true;
				try {
					// Track which IDs were added in this operation for potential rollback
					const newlyApproved: SuggestionId[] = [];
					for (const s of displayable) {
						if (!approved.has(s.id)) {
							approved.add(s.id);
							approvalHistory.push(s.id);
							newlyApproved.push(s.id);
						}
					}
					console.log(
						emphasize.success(
							`\nApproved ${newlyApproved.length} new item(s). Total: ${approved.size}`,
						),
					);

					// Show confirmation and wait for user
					const toExecute = currentSuggestions.filter((s) =>
						approved.has(s.id),
					);
					console.log(formatConfirmationPreview(toExecute, originalIndices));

					const confirmInput = await input({
						message: "Execute? [Y/n/u to undo this batch]: ",
					});
					const confirmLower = confirmInput.trim().toLowerCase();

					if (confirmLower === "n" || confirmLower === "no") {
						// Only remove the newly added approvals, preserve previous ones
						for (const id of newlyApproved) {
							approved.delete(id);
							const histIdx = approvalHistory.lastIndexOf(id);
							if (histIdx !== -1) approvalHistory.splice(histIdx, 1);
						}
						console.log(
							emphasize.warn(
								`Cancelled. Removed ${newlyApproved.length} item(s). ${approved.size} still approved.`,
							),
						);
						break;
					}
					if (confirmLower === "u") {
						// Only undo the newly added approvals
						for (const id of newlyApproved) {
							approved.delete(id);
							const histIdx = approvalHistory.lastIndexOf(id);
							if (histIdx !== -1) approvalHistory.splice(histIdx, 1);
						}
						console.log(
							emphasize.warn(
								`Undid ${newlyApproved.length} approval(s). ${approved.size} still approved.`,
							),
						);
						break;
					}

					return Array.from(approved);
				} finally {
					isProcessing = false;
				}
			}

			case "approve": {
				if (isProcessing) {
					console.log(
						emphasize.warn(
							"\n⏳ Please wait for previous operation to complete...",
						),
					);
					break;
				}
				isProcessing = true;
				try {
					// Track which IDs were added in this operation for potential rollback
					const newlyApproved: SuggestionId[] = [];
					for (const targetIndex of command.ids) {
						// Find suggestion by original index, not filtered array position
						const targetSuggestion = currentSuggestions.find(
							(s) => originalIndices.get(s.id) === targetIndex,
						);

						if (!targetSuggestion) {
							console.log(
								emphasize.error(`Item ${targetIndex} not found in list`),
							);
							continue;
						}

						if (skipped.has(targetSuggestion.id)) {
							console.log(
								emphasize.error(
									`Item ${targetIndex} was already skipped and cannot be approved`,
								),
							);
							continue;
						}

						if (!approved.has(targetSuggestion.id)) {
							approved.add(targetSuggestion.id);
							approvalHistory.push(targetSuggestion.id);
							newlyApproved.push(targetSuggestion.id);
						}
					}
					console.log(
						emphasize.success(
							`\nApproved ${newlyApproved.length} new item(s). Total: ${approved.size}`,
						),
					);

					// Show confirmation and wait for user
					const toExecute = currentSuggestions.filter((s) =>
						approved.has(s.id),
					);
					console.log(formatConfirmationPreview(toExecute, originalIndices));

					const confirmInput = await input({
						message: "Execute? [Y/n/u to undo this batch]: ",
					});
					const confirmLower = confirmInput.trim().toLowerCase();

					if (confirmLower === "n" || confirmLower === "no") {
						// Only remove the newly added approvals, preserve previous ones
						for (const id of newlyApproved) {
							approved.delete(id);
							const histIdx = approvalHistory.lastIndexOf(id);
							if (histIdx !== -1) approvalHistory.splice(histIdx, 1);
						}
						console.log(
							emphasize.warn(
								`Cancelled. Removed ${newlyApproved.length} item(s). ${approved.size} still approved.`,
							),
						);
						break;
					}
					if (confirmLower === "u") {
						// Only undo the newly added approvals
						for (const id of newlyApproved) {
							approved.delete(id);
							const histIdx = approvalHistory.lastIndexOf(id);
							if (histIdx !== -1) approvalHistory.splice(histIdx, 1);
						}
						console.log(
							emphasize.warn(
								`Undid ${newlyApproved.length} approval(s). ${approved.size} still approved.`,
							),
						);
						break;
					}

					return Array.from(approved);
				} finally {
					isProcessing = false;
				}
			}

			case "skip": {
				// Find suggestion by original index, not filtered array position
				const targetSuggestion = currentSuggestions.find(
					(s) => originalIndices.get(s.id) === command.id,
				);

				if (!targetSuggestion) {
					console.log(emphasize.error(`Invalid item number: ${command.id}`));
					break;
				}

				if (skipped.has(targetSuggestion.id)) {
					console.log(emphasize.warn(`Item ${command.id} is already skipped.`));
					break;
				}

				skipped.add(targetSuggestion.id);
				// Also remove from approved if it was there
				if (approved.has(targetSuggestion.id)) {
					approved.delete(targetSuggestion.id);
				}
				console.log(emphasize.warn(`Skipped item ${command.id}.`));
				break;
			}

			case "edit": {
				if (isProcessing) {
					console.log(
						emphasize.warn(
							"\n⏳ Please wait for previous operation to complete...",
						),
					);
					break;
				}

				// Find suggestion by original index, not filtered array position
				const targetSuggestion = currentSuggestions.find(
					(s) => originalIndices.get(s.id) === command.id,
				);

				if (!targetSuggestion) {
					console.log(emphasize.error(`Invalid item number: ${command.id}`));
					break;
				}

				if (skipped.has(targetSuggestion.id)) {
					console.log(
						emphasize.error(
							`Item ${command.id} was already skipped and cannot be edited`,
						),
					);
					break;
				}

				isProcessing = true;
				const editSpinner = createSpinner(
					`Re-processing item ${command.id} with: "${command.prompt}"...`,
				).start();
				editSpinner.update({ text: "Extracting PDF + calling LLM..." });
				const editStarted = Date.now();
				try {
					const updated = await engine.editWithPrompt(
						targetSuggestion.id,
						command.prompt,
					);
					// Update in our list
					const originalIndex = currentSuggestions.findIndex(
						(s) => s.id === targetSuggestion.id,
					);
					if (originalIndex >= 0) {
						currentSuggestions[originalIndex] = updated;
					}
					const elapsedMs = Date.now() - editStarted;
					editSpinner.success({
						text: `Updated item ${command.id} (${updated.confidence}) in ${Math.max(1, Math.round(elapsedMs))}ms`,
					});
				} catch (error) {
					editSpinner.error({
						text: `Failed to edit item ${command.id}: ${error instanceof Error ? error.message : "unknown"}`,
					});
				} finally {
					isProcessing = false;
				}
				break;
			}

			case "help":
				console.log("");
				console.log(getHelpText());
				break;

			case "invalid":
				console.log(
					emphasize.error(
						`Unknown command: '${command.input}'. Type ? for help.`,
					),
				);
				break;
		}
	}

	return Array.from(approved);
}

// =============================================================================
// Result Display
// =============================================================================

/**
 * Display execution results in a formatted summary.
 *
 * @param results - Array of execution results to display
 *
 * @example
 * ```typescript
 * const results = await engine.execute(approvedIds);
 * displayResults(results);
 * ```
 */
export function displayResults(results: ExecutionResult[]): void {
	const successes = results.filter((r) => r.success);
	const failures = results.filter((r) => !r.success);

	console.log(`\n${"═".repeat(60)}`);
	console.log(emphasize.info("Execution Complete"));
	console.log(`${"═".repeat(60)}`);

	if (successes.length > 0) {
		console.log(
			emphasize.success(
				`\n✓ ${successes.length} item(s) processed successfully:`,
			),
		);
		for (const result of successes) {
			if (result.createdNote) {
				console.log(`  → Created: ${result.createdNote}`);
			}
			if (result.movedAttachment) {
				console.log(`  → Moved: ${result.movedAttachment}`);
			}
		}
	}

	if (failures.length > 0) {
		console.log(emphasize.error(`\n✗ ${failures.length} item(s) failed:`));
		for (const result of failures) {
			console.log(`  → ${result.suggestionId}: ${result.error}`);
		}
	}

	console.log("");
}
