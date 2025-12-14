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
 * parseCommand("q")           // { type: "quit" }
 * parseCommand("h")           // { type: "help" }
 */
export function parseCommand(input: string): CLICommand {
	const trimmed = input.trim();

	// Empty input
	if (trimmed === "") {
		return { type: "invalid", input: trimmed };
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
	const lines: string[] = [];

	// Main line: index, confidence, source icon, filename, action
	const mainLine = `${emphasize.info(`[${index}]`)} ${confidence} ${sourceIcon} ${emphasize.info(filename)} → ${suggestion.action}`;
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

	// Display extraction warnings if present
	if (
		suggestion.extractionWarnings &&
		suggestion.extractionWarnings.length > 0
	) {
		lines.push(`    ${emphasize.warn("⚠ Warnings:")}`);
		for (const warning of suggestion.extractionWarnings) {
			lines.push(`      ${emphasize.warn(`• ${warning}`)}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format multiple suggestions as a table/list.
 *
 * @param suggestions - Array of suggestions to format
 * @returns Formatted table string
 */
export function formatSuggestionsTable(suggestions: InboxSuggestion[]): string {
	if (suggestions.length === 0) {
		return "";
	}

	const lines: string[] = [];

	// Header
	lines.push(emphasize.info("═══ Inbox Suggestions ═══"));
	lines.push("");

	// Format each suggestion
	for (const [i, suggestion] of suggestions.entries()) {
		lines.push(formatSuggestion(suggestion, i + 1));
		if (i < suggestions.length - 1) {
			lines.push(""); // Blank line between suggestions
		}
	}

	lines.push("");
	lines.push(emphasize.dim(`${suggestions.length} item(s) to process`));

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
		emphasize.info("═══ Inbox Processing Commands ═══"),
		"",
		`  ${emphasize.success("a")}           Approve all suggestions`,
		`  ${emphasize.success("1,2,5")}       Approve specific items by number`,
		`  ${emphasize.success("e<n> <prompt>")}  Edit suggestion #n with prompt`,
		`                Example: e3 put in Health area`,
		`  ${emphasize.success("s<n>")}        Skip item #n`,
		`  ${emphasize.success("q")}           Quit without processing`,
		`  ${emphasize.success("h")} or ${emphasize.success("?")}     Show this help`,
		"",
		emphasize.dim("Examples:"),
		emphasize.dim("  a              - approve all items"),
		emphasize.dim("  1,3            - approve items 1 and 3"),
		emphasize.dim('  e2 "use Work area" - edit item 2'),
		emphasize.dim("  s4             - skip item 4"),
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
}

/**
 * Run the interactive approval loop.
 *
 * Displays suggestions, accepts user commands, and processes approved items.
 * Returns the IDs of approved suggestions.
 *
 * @param options - Configuration for the interactive loop
 * @returns Array of approved suggestion IDs
 *
 * @example
 * ```typescript
 * const engine = createInboxEngine(config);
 * const suggestions = await engine.scan();
 * const approvedIds = await runInteractiveLoop({ engine, suggestions });
 * const results = await engine.execute(approvedIds);
 * ```
 */
export async function runInteractiveLoop(
	options: InteractiveOptions,
): Promise<SuggestionId[]> {
	const { engine, suggestions } = options;
	const approved = new Set<SuggestionId>();
	const skipped = new Set<SuggestionId>();
	const currentSuggestions = [...suggestions];
	let isProcessing = false;

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

		// Display suggestions and help
		console.log(formatSuggestionsTable(displayable));
		console.log("");
		console.log(getHelpText());
		console.log("");

		// Get user input
		const userInput = await input({ message: "> " });
		const command = parseCommand(userInput);

		switch (command.type) {
			case "quit":
				console.log(emphasize.warn("\nQuitting without executing."));
				return [];

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
					for (const s of displayable) {
						approved.add(s.id);
					}
					console.log(
						emphasize.success(`\nApproved ${displayable.length} items.`),
					);
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
					let approvedCount = 0;
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

						approved.add(targetSuggestion.id);
						approvedCount++;
					}
					console.log(
						emphasize.success(`\nApproved ${approvedCount} item(s).`),
					);
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
				// Help is already shown above, just acknowledge
				console.log(emphasize.dim("(help shown above)"));
				break;

			case "invalid":
				console.log(
					emphasize.error(
						"\nInvalid command. Try: a, 1,2,3, e3 <prompt>, s3, or q",
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
