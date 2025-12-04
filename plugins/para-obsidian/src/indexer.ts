import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { parseFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";

export interface IndexEntry {
	readonly file: string;
	readonly tags: string[];
	readonly frontmatter: Record<string, unknown>;
	readonly headings: string[];
}

export interface VaultIndex {
	readonly generatedAt: string;
	readonly entries: IndexEntry[];
}

function collectHeadings(content: string): string[] {
	const lines = content.split("\n");
	return lines
		.filter((line) => /^#+\s/.test(line))
		.map((line) => line.replace(/^#+\s*/, "").trim());
}

function walkMarkdownFiles(root: string, dir: string, out: string[]) {
	const current = path.join(root, dir);
	const entries = fs.readdirSync(current, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			walkMarkdownFiles(root, path.join(dir, entry.name), out);
		} else if (entry.name.endsWith(".md")) {
			out.push(path.join(dir, entry.name));
		}
	}
}

export function buildIndex(
	config: ParaObsidianConfig,
	dir?: string,
): VaultIndex {
	const root = dir
		? resolveVaultPath(config.vault, dir).absolute
		: config.vault;
	const files: string[] = [];
	walkMarkdownFiles(root, ".", files);

	const entries: IndexEntry[] = [];
	for (const rel of files) {
		const full = path.join(root, rel);
		const content = fs.readFileSync(full, "utf8");
		const { attributes } = parseFrontmatter(content);
		const tags = Array.isArray(attributes.tags)
			? (attributes.tags as string[])
			: [];
		const headings = collectHeadings(content);
		entries.push({
			file: path.relative(config.vault, full),
			tags,
			frontmatter: attributes,
			headings,
		});
	}

	return {
		generatedAt: new Date().toISOString(),
		entries,
	};
}

export function saveIndex(
	config: ParaObsidianConfig,
	index: VaultIndex,
): string {
	const indexPath =
		config.indexPath ?? path.join(config.vault, ".para-obsidian-index.json");
	fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
	return indexPath;
}

export function loadIndex(config: ParaObsidianConfig): VaultIndex | undefined {
	const indexPath =
		config.indexPath ?? path.join(config.vault, ".para-obsidian-index.json");
	if (!fs.existsSync(indexPath)) return undefined;
	const raw = fs.readFileSync(indexPath, "utf8");
	return JSON.parse(raw) as VaultIndex;
}
