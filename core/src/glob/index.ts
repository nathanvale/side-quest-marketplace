/**
 * Glob module - Bun-native glob pattern matching
 *
 * Uses Bun.Glob for fast filesystem pattern matching.
 * All functions return absolute paths by default.
 *
 * @example
 * ```ts
 * import { globFiles, matchGlob } from "@sidequest/core/glob";
 *
 * // Get all TypeScript files
 * const files = globFilesSync("**\/*.ts", "./src");
 *
 * // Check if a path matches a pattern
 * if (matchGlob("*.test.ts", "utils.test.ts")) { ... }
 * ```
 */

import * as path from "node:path";

/** Options for glob operations */
export interface GlobOptions {
	/** Working directory for relative paths (defaults to cwd) */
	cwd?: string;
	/** Include dot files in results */
	dot?: boolean;
	/** Return absolute paths (default: true) */
	absolute?: boolean;
	/** Follow symlinks */
	followSymlinks?: boolean;
	/** Only return directories */
	onlyDirectories?: boolean;
	/** Only return files */
	onlyFiles?: boolean;
}

/**
 * Scan for files matching a glob pattern (async)
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options or cwd string
 * @returns Async iterator of matching file paths
 *
 * @example
 * ```ts
 * for await (const file of scanGlob("**\/*.ts", { cwd: "./src" })) {
 *   console.log(file);
 * }
 * ```
 */
export async function* scanGlob(
	pattern: string,
	options?: GlobOptions | string,
): AsyncGenerator<string> {
	const opts = typeof options === "string" ? { cwd: options } : (options ?? {});
	const cwd = opts.cwd ?? process.cwd();
	const absolute = opts.absolute ?? true;

	const glob = new Bun.Glob(pattern);

	for await (const entry of glob.scan({
		cwd,
		dot: opts.dot,
		followSymlinks: opts.followSymlinks,
		onlyFiles: opts.onlyFiles ?? !opts.onlyDirectories,
	})) {
		yield absolute ? path.resolve(cwd, entry) : entry;
	}
}

/**
 * Scan for files matching a glob pattern (sync)
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options or cwd string
 * @returns Iterator of matching file paths
 *
 * @example
 * ```ts
 * for (const file of scanGlobSync("**\/*.ts", "./src")) {
 *   console.log(file);
 * }
 * ```
 */
export function* scanGlobSync(
	pattern: string,
	options?: GlobOptions | string,
): Generator<string> {
	const opts = typeof options === "string" ? { cwd: options } : (options ?? {});
	const cwd = opts.cwd ?? process.cwd();
	const absolute = opts.absolute ?? true;

	const glob = new Bun.Glob(pattern);

	for (const entry of glob.scanSync({
		cwd,
		dot: opts.dot,
		followSymlinks: opts.followSymlinks,
		onlyFiles: opts.onlyFiles ?? !opts.onlyDirectories,
	})) {
		yield absolute ? path.resolve(cwd, entry) : entry;
	}
}

/**
 * Get all files matching a glob pattern (async)
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options or cwd string
 * @returns Promise of array of matching file paths
 *
 * @example
 * ```ts
 * const files = await globFiles("**\/*.ts", "./src");
 * console.log(`Found ${files.length} TypeScript files`);
 * ```
 */
export async function globFiles(
	pattern: string,
	options?: GlobOptions | string,
): Promise<string[]> {
	const files: string[] = [];
	for await (const file of scanGlob(pattern, options)) {
		files.push(file);
	}
	return files;
}

/**
 * Get all files matching a glob pattern (sync)
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options or cwd string
 * @returns Array of matching file paths
 *
 * @example
 * ```ts
 * const files = globFilesSync("**\/*.ts", "./src");
 * console.log(`Found ${files.length} TypeScript files`);
 * ```
 */
export function globFilesSync(
	pattern: string,
	options?: GlobOptions | string,
): string[] {
	return [...scanGlobSync(pattern, options)];
}

/**
 * Check if a string matches a glob pattern
 *
 * @param pattern - Glob pattern to test against
 * @param input - String to test
 * @returns True if input matches pattern
 *
 * @example
 * ```ts
 * matchGlob("*.ts", "utils.ts"); // true
 * matchGlob("*.ts", "utils.js"); // false
 * matchGlob("**\/*.test.ts", "src/utils.test.ts"); // true
 * ```
 */
export function matchGlob(pattern: string, input: string): boolean {
	const glob = new Bun.Glob(pattern);
	return glob.match(input);
}

/**
 * Create a reusable glob matcher function
 *
 * @param pattern - Glob pattern to compile
 * @returns Function that tests strings against the pattern
 *
 * @example
 * ```ts
 * const isTestFile = createGlobMatcher("*.test.{ts,tsx}");
 * isTestFile("utils.test.ts"); // true
 * isTestFile("utils.ts");      // false
 * ```
 */
export function createGlobMatcher(pattern: string): (input: string) => boolean {
	const glob = new Bun.Glob(pattern);
	return (input: string) => glob.match(input);
}

/**
 * Check if any of multiple patterns match
 *
 * @param patterns - Array of glob patterns
 * @param input - String to test
 * @returns True if input matches any pattern
 *
 * @example
 * ```ts
 * matchAnyGlob(["*.ts", "*.tsx"], "App.tsx"); // true
 * matchAnyGlob(["*.ts", "*.tsx"], "App.js");  // false
 * ```
 */
export function matchAnyGlob(patterns: string[], input: string): boolean {
	return patterns.some((pattern) => matchGlob(pattern, input));
}

/**
 * Filter an array of strings by glob pattern
 *
 * @param pattern - Glob pattern to filter by
 * @param inputs - Array of strings to filter
 * @returns Array of strings that match the pattern
 *
 * @example
 * ```ts
 * const files = ["a.ts", "b.js", "c.ts"];
 * filterGlob("*.ts", files); // ["a.ts", "c.ts"]
 * ```
 */
export function filterGlob(pattern: string, inputs: string[]): string[] {
	const glob = new Bun.Glob(pattern);
	return inputs.filter((input) => glob.match(input));
}

/**
 * Get files matching multiple glob patterns (sync)
 *
 * @param patterns - Array of glob patterns
 * @param options - Glob options or cwd string
 * @returns Array of unique matching file paths
 *
 * @example
 * ```ts
 * const files = globFilesMultiSync(["src/**\/*.ts", "lib/**\/*.ts"]);
 * ```
 */
export function globFilesMultiSync(
	patterns: string[],
	options?: GlobOptions | string,
): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const pattern of patterns) {
		for (const file of scanGlobSync(pattern, options)) {
			if (!seen.has(file)) {
				seen.add(file);
				result.push(file);
			}
		}
	}

	return result;
}

/**
 * Get files matching multiple glob patterns (async)
 *
 * @param patterns - Array of glob patterns
 * @param options - Glob options or cwd string
 * @returns Promise of array of unique matching file paths
 *
 * @example
 * ```ts
 * const files = await globFilesMulti(["src/**\/*.ts", "lib/**\/*.ts"]);
 * ```
 */
export async function globFilesMulti(
	patterns: string[],
	options?: GlobOptions | string,
): Promise<string[]> {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const pattern of patterns) {
		for await (const file of scanGlob(pattern, options)) {
			if (!seen.has(file)) {
				seen.add(file);
				result.push(file);
			}
		}
	}

	return result;
}
