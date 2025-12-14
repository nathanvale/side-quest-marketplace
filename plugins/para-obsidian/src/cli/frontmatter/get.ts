/**
 * Frontmatter get command handler
 *
 * @module cli/frontmatter/get
 */

import { readFrontmatterFile } from "../../frontmatter/index";
import type { CommandContext, CommandResult } from "../types";

/**
 * Handle frontmatter get command
 */
export async function handleFrontmatterGet(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, isJson } = ctx;
	const target = positional[0];

	if (!target) {
		console.error("frontmatter get requires <file>");
		return { success: false, exitCode: 1 };
	}

	const { attributes } = readFrontmatterFile(config, target);
	if (isJson) {
		console.log(
			JSON.stringify({ file: target, frontmatter: attributes }, null, 2),
		);
	} else {
		console.log(JSON.stringify(attributes, null, 2));
	}

	return { success: true };
}
