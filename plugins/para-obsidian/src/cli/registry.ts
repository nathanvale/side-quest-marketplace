/**
 * Registry management commands for PARA Obsidian CLI.
 *
 * Provides commands to view, manage, and clean up the processed items registry.
 * This enables users to debug why files aren't being processed and to reset
 * items for reprocessing without manually editing JSON.
 *
 * @module cli/registry
 */

import { confirm } from "@inquirer/prompts";
import { color, emphasize } from "@side-quest/core/terminal";
import { createRegistry } from "../inbox/registry/processed-registry";
import type { CommandContext, CommandResult } from "./types";

/**
 * Handle registry subcommands.
 *
 * Subcommands:
 * - list: Show all processed items
 * - remove <hash>: Remove a specific item from registry
 * - clear: Clear all items from registry
 */
export async function handleRegistry(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, subcommand, positional, flags, isJson } = ctx;
	const registry = createRegistry(config.vault);

	// Load registry from disk
	await registry.load();

	switch (subcommand) {
		case "list":
			return handleRegistryList(registry, flags, isJson);

		case "remove":
			return handleRegistryRemove(registry, positional, isJson);

		case "clear":
			return handleRegistryClear(registry, flags, isJson);

		default:
			if (isJson) {
				console.log(
					JSON.stringify({
						error: `Unknown subcommand: ${subcommand}`,
						availableCommands: ["list", "remove", "clear"],
					}),
				);
			} else {
				console.log(
					color("red", `Unknown subcommand: ${subcommand || "(none)"}\n`),
				);
				console.log("Available commands:");
				console.log("  registry list              Show all processed items");
				console.log(
					"  registry list --recent 10  Show last 10 processed items",
				);
				console.log(
					"  registry remove <hash>     Remove item by hash (allows reprocessing)",
				);
				console.log(
					"  registry clear             Clear all items (with confirmation)",
				);
			}
			return { success: false, exitCode: 1 };
	}
}

/**
 * List all processed items in the registry.
 */
async function handleRegistryList(
	registry: ReturnType<typeof createRegistry>,
	flags: CommandContext["flags"],
	isJson: boolean,
): Promise<CommandResult> {
	const items = registry.getAllItems();

	// Sort by processedAt (newest first)
	const sorted = [...items].sort(
		(a, b) =>
			new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime(),
	);

	// Apply --recent limit if specified
	const recentLimit =
		typeof flags.recent === "string" ? Number.parseInt(flags.recent, 10) : null;
	const displayed =
		recentLimit && recentLimit > 0 ? sorted.slice(0, recentLimit) : sorted;

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					total: items.length,
					displayed: displayed.length,
					items: displayed,
				},
				null,
				2,
			),
		);
	} else {
		if (items.length === 0) {
			console.log(color("yellow", "\nNo items in registry."));
			console.log(emphasize.info("The registry tracks processed inbox files."));
			console.log("Run 'para scan' to process inbox files.\n");
		} else {
			const showing =
				recentLimit && recentLimit < items.length
					? ` (showing ${displayed.length} of ${items.length})`
					: "";
			console.log(color("cyan", `\nProcessed Items Registry${showing}\n`));

			for (const item of displayed) {
				const date = new Date(item.processedAt).toLocaleString();
				const hashShort = item.sourceHash.slice(0, 12);

				console.log(`  ${color("dim", hashShort)}  ${item.sourcePath}`);
				console.log(`    ${color("dim", "→")} ${date}`);
				if (item.createdNote) {
					console.log(`    ${color("green", "✓")} Note: ${item.createdNote}`);
				}
				if (item.movedAttachment) {
					console.log(
						`    ${color("green", "✓")} Attachment: ${item.movedAttachment}`,
					);
				}
				console.log();
			}

			console.log(emphasize.info(`Total: ${items.length} items`));
			console.log(
				emphasize.info(
					"To reprocess a file: registry remove <first-12-chars-of-hash>",
				),
			);
		}
	}

	return { success: true };
}

/**
 * Remove a specific item from the registry by hash.
 */
async function handleRegistryRemove(
	registry: ReturnType<typeof createRegistry>,
	positional: ReadonlyArray<string>,
	isJson: boolean,
): Promise<CommandResult> {
	const hashPrefix = positional[0];

	if (!hashPrefix) {
		if (isJson) {
			console.log(
				JSON.stringify({
					error: "Missing hash argument",
					usage: "registry remove <hash-prefix>",
				}),
			);
		} else {
			console.log(color("red", "Missing hash argument"));
			console.log("Usage: registry remove <hash-prefix>");
			console.log("       Use first 8-12 characters of the hash");
		}
		return { success: false, exitCode: 1 };
	}

	// Find item by hash prefix
	const items = registry.getAllItems();
	const matches = items.filter((item) =>
		item.sourceHash.toLowerCase().startsWith(hashPrefix.toLowerCase()),
	);

	if (matches.length === 0) {
		if (isJson) {
			console.log(
				JSON.stringify({
					error: "No matching item found",
					hashPrefix,
				}),
			);
		} else {
			console.log(
				color("red", `No item found with hash starting with: ${hashPrefix}`),
			);
			console.log("Run 'registry list' to see all processed items.");
		}
		return { success: false, exitCode: 1 };
	}

	if (matches.length > 1) {
		if (isJson) {
			console.log(
				JSON.stringify({
					error: "Multiple items match - use more characters",
					matches: matches.map((m) => ({
						hash: m.sourceHash.slice(0, 16),
						path: m.sourcePath,
					})),
				}),
			);
		} else {
			console.log(
				color("yellow", "Multiple items match. Use more characters:"),
			);
			for (const match of matches) {
				console.log(`  ${match.sourceHash.slice(0, 16)}  ${match.sourcePath}`);
			}
		}
		return { success: false, exitCode: 1 };
	}

	// We know matches.length === 1 at this point
	const item = matches[0];
	if (!item) {
		// This should never happen given the length check above
		return {
			success: false,
			error: "Unexpected error: item not found",
			exitCode: 1,
		};
	}

	// Remove the item and save
	registry.removeItem(item.sourceHash);
	await registry.save();

	if (isJson) {
		console.log(
			JSON.stringify({
				removed: true,
				hash: item.sourceHash,
				path: item.sourcePath,
			}),
		);
	} else {
		console.log(color("green", "✓ Removed from registry:"));
		console.log(`  ${item.sourcePath}`);
		console.log(
			emphasize.info("\nThis file can now be reprocessed by 'para scan'."),
		);
	}

	return { success: true };
}

/**
 * Clear all items from the registry.
 */
async function handleRegistryClear(
	registry: ReturnType<typeof createRegistry>,
	flags: CommandContext["flags"],
	isJson: boolean,
): Promise<CommandResult> {
	const items = registry.getAllItems();

	if (items.length === 0) {
		if (isJson) {
			console.log(
				JSON.stringify({
					cleared: false,
					message: "Registry is already empty",
				}),
			);
		} else {
			console.log(color("yellow", "Registry is already empty."));
		}
		return { success: true };
	}

	// Require confirmation unless --confirm is passed
	const skipConfirm = flags.confirm === true;

	if (!skipConfirm && !isJson) {
		console.log(
			color(
				"yellow",
				`\nThis will remove ${items.length} items from the registry.`,
			),
		);
		console.log("All inbox files will be eligible for reprocessing.\n");

		const proceed = await confirm({
			message: "Clear the entire registry?",
			default: false,
		});

		if (!proceed) {
			console.log(emphasize.info("\nCancelled. Registry unchanged."));
			return { success: true };
		}
	}

	// Clear the registry and save
	const itemCount = items.length;
	registry.clear();
	await registry.save();

	if (isJson) {
		console.log(
			JSON.stringify({
				cleared: true,
				itemsRemoved: itemCount,
			}),
		);
	} else {
		console.log(color("green", `✓ Cleared ${itemCount} items from registry.`));
		console.log(
			emphasize.info("All inbox files can now be reprocessed by 'para scan'."),
		);
	}

	return { success: true };
}
