import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

export interface RenameOptions {
	readonly from: string;
	readonly to: string;
	readonly dryRun?: boolean;
}

export interface RenameResult {
	readonly moved: boolean;
	readonly rewrites: Array<{ file: string; changes: number }>;
}

function replaceLinks(
	content: string,
	fromName: string,
	toName: string,
): { content: string; changes: number } {
	const wikilinkPattern = new RegExp(`\\[\\[${fromName}\\]\\]`, "g");
	const mdLinkPattern = new RegExp(`\\[([^\\]]+)\\]\\(${fromName}\\)`, "g");

	let changes = 0;
	let updated = content.replace(wikilinkPattern, () => {
		changes++;
		return `[[${toName}]]`;
	});

	updated = updated.replace(mdLinkPattern, (_match, text) => {
		changes++;
		return `[${text}](${toName})`;
	});

	return { content: updated, changes };
}

function listMarkdownFiles(root: string): string[] {
	const results: string[] = [];
	const entries = fs.readdirSync(root, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			results.push(...listMarkdownFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(full);
		}
	}
	return results;
}

export function renameWithLinkRewrite(
	config: ParaObsidianConfig,
	options: RenameOptions,
): RenameResult {
	const from = resolveVaultPath(config.vault, options.from);
	const to = resolveVaultPath(config.vault, options.to);

	if (!fs.existsSync(from.absolute)) {
		throw new Error(`Source does not exist: ${options.from}`);
	}
	if (fs.existsSync(to.absolute)) {
		throw new Error(`Destination already exists: ${options.to}`);
	}

	const fromName = path.basename(from.absolute, ".md");
	const toName = path.basename(to.absolute, ".md");

	const rewrites: Array<{ file: string; changes: number }> = [];
	const files = listMarkdownFiles(config.vault);
	for (const file of files) {
		const original = fs.readFileSync(file, "utf8");
		const { content, changes } = replaceLinks(original, fromName, toName);
		if (changes > 0 && !options.dryRun) {
			fs.writeFileSync(file, content, "utf8");
		}
		if (changes > 0) {
			rewrites.push({
				file: path.relative(config.vault, file),
				changes,
			});
		}
	}

	if (!options.dryRun) {
		fs.mkdirSync(path.dirname(to.absolute), { recursive: true });
		fs.renameSync(from.absolute, to.absolute);
	}

	return { moved: !options.dryRun, rewrites };
}
