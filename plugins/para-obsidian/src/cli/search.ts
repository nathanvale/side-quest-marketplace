/**
 * Search-related CLI command handlers.
 *
 * Handlers for index, search, and semantic search commands.
 *
 * @module cli/search
 */

import { emphasize } from "@sidequest/core/terminal";
import { filterByFrontmatter, searchText } from "../search/index";
import { buildIndex, loadIndex, saveIndex } from "../search/indexer";
import { semanticSearch } from "../search/semantic";
import { validateRegex } from "../shared/validation";
import type { CommandHandler } from "./types";
import {
	matchesDir,
	normalizeFlags,
	normalizeFlagValue,
	parseDirs,
	parseFrontmatterFilters,
} from "./utils";

/**
 * Handle the `index` command.
 *
 * Subcommands:
 * - prime: Build and save the search index
 * - query: Query the index for matching files
 */
export const handleIndex: CommandHandler = async (ctx) => {
	const { config, flags, subcommand, positional, isJson } = ctx;
	const action = subcommand;

	if (!action) {
		console.error("index requires an action (prime|query)");
		return { success: false, exitCode: 1 };
	}

	if (action === "prime") {
		const dirs = parseDirs(
			normalizeFlagValue(flags.dir) ?? positional[0],
			config.defaultSearchDirs,
		);
		const index = buildIndex(config, dirs);
		const path = saveIndex(config, index);
		if (isJson) {
			console.log(
				JSON.stringify(
					{ indexPath: path, count: index.entries.length },
					null,
					2,
				),
			);
		} else {
			console.log(
				emphasize.success(`Indexed ${index.entries.length} files → ${path}`),
			);
		}
		return { success: true };
	}

	if (action === "query") {
		const dirs = parseDirs(
			normalizeFlagValue(flags.dir),
			config.defaultSearchDirs,
		);
		const frontmatter = parseFrontmatterFilters(normalizeFlags(flags));
		const index = loadIndex(config);
		if (!index) {
			console.error("Index not found. Run index prime first.");
			return { success: false, exitCode: 1 };
		}
		const results = index.entries.filter((entry) => {
			if (!matchesDir(entry.file, dirs)) return false;
			for (const [k, v] of Object.entries(frontmatter)) {
				if (entry.frontmatter[k] !== v) return false;
			}
			return true;
		});
		if (isJson) {
			console.log(JSON.stringify({ count: results.length, results }, null, 2));
		} else {
			for (const r of results) console.log(r.file);
		}
		return { success: true };
	}

	console.error(`Unknown index action: ${action}`);
	return { success: false, exitCode: 1 };
};

/**
 * Handle the `search` command.
 *
 * Searches for text in vault notes with optional frontmatter filtering.
 */
export const handleSearch: CommandHandler = async (ctx) => {
	const { config, flags, subcommand, isJson } = ctx;
	const query = subcommand;

	if (!query) {
		console.error("search requires <query>");
		return { success: false, exitCode: 1 };
	}

	const dirs = parseDirs(
		normalizeFlagValue(flags.dir),
		config.defaultSearchDirs,
	);
	const frontmatter = parseFrontmatterFilters(normalizeFlags(flags));
	const globs =
		typeof flags.glob === "string"
			? flags.glob
					.split(",")
					.map((g: string) => g.trim())
					.filter(Boolean)
			: undefined;
	const context =
		typeof flags.context === "string"
			? Number.parseInt(flags.context, 10)
			: undefined;

	const hasFrontmatterFilters = Object.keys(frontmatter).length > 0;
	const fmMatches = hasFrontmatterFilters
		? await filterByFrontmatter(config, { frontmatter, dir: dirs })
		: [];

	// Validate regex pattern if regex mode is enabled
	const isRegexMode = flags.regex === true || flags.regex === "true";
	if (isRegexMode) {
		const validation = validateRegex(query);
		if (!validation.valid) {
			console.error(
				emphasize.error(`Invalid regex pattern: ${validation.error}`),
			);
			return { success: false, exitCode: 1 };
		}
	}

	const hits = await searchText(config, {
		query,
		dir: dirs,
		regex: isRegexMode,
		maxResults:
			typeof flags["max-results"] === "string"
				? Number.parseInt(flags["max-results"], 10)
				: undefined,
		glob: globs,
		context,
		allowedFiles: hasFrontmatterFilters ? fmMatches : undefined,
	});

	if (isJson) {
		console.log(
			JSON.stringify({ query, hits, frontmatter: fmMatches }, null, 2),
		);
	} else {
		for (const hit of hits) {
			console.log(emphasize.info(`${hit.file}:${hit.line}: ${hit.snippet}`));
		}
		if (fmMatches.length > 0) {
			console.log("\nFrontmatter matches:");
			for (const f of fmMatches) console.log(emphasize.info(f));
		}
	}
	return { success: true };
};

/**
 * Handle the `semantic` command.
 *
 * Performs semantic (vector) search across vault notes.
 */
export const handleSemantic: CommandHandler = async (ctx) => {
	const { config, flags, subcommand, isJson } = ctx;
	const query = subcommand;

	if (!query) {
		console.error("semantic requires <query>");
		return { success: false, exitCode: 1 };
	}

	// Parse --dir (explicit directory) or --para (PARA shortcuts)
	const dir = parseDirs(normalizeFlagValue(flags.dir), undefined);
	const para = typeof flags.para === "string" ? flags.para : undefined;
	const limit =
		typeof flags.limit === "string"
			? Number.parseInt(flags.limit, 10)
			: undefined;

	try {
		const hits = await semanticSearch(config, {
			query,
			dir,
			para,
			limit,
		});
		if (isJson) {
			console.log(JSON.stringify({ query, hits }, null, 2));
		} else {
			if (hits.length === 0) {
				console.log(emphasize.warn("No results found."));
			} else {
				for (const hit of hits) {
					const line = hit.line ? `:${hit.line}` : "";
					const score = hit.score.toFixed(3);
					const dirLabel = hit.dir && hit.dir !== "." ? `[${hit.dir}] ` : "";
					console.log(
						emphasize.info(
							`${dirLabel}${hit.file}${line} (${score}) ${hit.snippet ?? ""}`.trim(),
						),
					);
				}
			}
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "semantic search failed";
		console.error(message);
		return { success: false, exitCode: 1 };
	}

	return { success: true };
};
