import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

export interface SearchOptions {
	readonly query: string;
	readonly dir?: string;
	readonly regex?: boolean;
	readonly tag?: string;
	readonly frontmatter?: Record<string, string>;
	readonly maxResults?: number;
}

export interface SearchHit {
	readonly file: string;
	readonly line: number;
	readonly snippet: string;
}

export interface FrontmatterFilterOptions {
	readonly dir?: string;
	readonly tag?: string;
	readonly frontmatter?: Record<string, string>;
}

function buildRgArgs(options: SearchOptions, root: string): string[] {
	const args = ["rg", "--line-number", "--color", "never"];
	if (options.regex) {
		args.push(options.query);
	} else {
		args.push("--fixed-strings", options.query);
	}
	if (options.maxResults) {
		args.push("--max-count", options.maxResults.toString());
	}
	const dir = options.dir ? resolveVaultPath(root, options.dir).absolute : root;
	args.push(dir);
	return args;
}

export function searchText(
	config: ParaObsidianConfig,
	options: SearchOptions,
): SearchHit[] {
	const args = buildRgArgs(options, config.vault);
	const [cmd, ...cmdArgs] = args;
	const command = cmd ?? "rg";
	const result = spawnSync(command, cmdArgs, {
		stdio: "pipe",
		encoding: "utf8",
	});
	if (result.status !== 0 && result.stdout.trim().length === 0) {
		return [];
	}
	const hits: SearchHit[] = [];
	for (const line of result.stdout.trim().split("\n")) {
		if (!line) continue;
		const [file, lineNo, ...rest] = line.split(":");
		if (!file || !lineNo) continue;
		const snippet = rest.join(":");
		const relative = path.relative(config.vault, file);
		hits.push({
			file: relative,
			line: Number.parseInt(lineNo, 10),
			snippet,
		});
	}
	return hits;
}

export function filterByFrontmatter(
	config: ParaObsidianConfig,
	options: FrontmatterFilterOptions,
): string[] {
	const filters = options.frontmatter ?? {};
	const tagFilter = options.tag;
	if (Object.keys(filters).length === 0 && !tagFilter) return [];

	const matches: string[] = [];

	function hasFrontmatter(filePath: string): boolean {
		const content = fs.readFileSync(filePath, "utf8");
		if (!content.startsWith("---")) return false;
		const end = content.indexOf("\n---", 3);
		if (end === -1) return false;
		const raw = content.slice(3, end + 1);
		const yaml = parse(raw) as Record<string, unknown>;
		for (const [k, v] of Object.entries(filters)) {
			if (yaml[k] !== v) return false;
		}
		if (tagFilter) {
			const tags = yaml.tags;
			if (!Array.isArray(tags) || !tags.includes(tagFilter)) return false;
		}
		return true;
	}

	const dir = options.dir
		? resolveVaultPath(config.vault, options.dir).absolute
		: config.vault;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) continue;
		if (!entry.name.endsWith(".md")) continue;
		const full = path.join(dir, entry.name);
		if (hasFrontmatter(full)) {
			matches.push(path.relative(config.vault, full));
		}
	}
	return matches;
}
