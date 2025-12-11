#!/usr/bin/env bun
/**
 * FS Wrapper Migration Script
 *
 * Replaces trivial @sidequest/core/fs wrapper functions with direct Node.js equivalents.
 * Updates imports and transforms function calls based on the patterns defined in
 * golden-fluttering-zephyr.md.
 *
 * Run: bun run scripts/migrate-fs-wrappers.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Glob } from "bun";

// Replacement map: wrapper → Node.js equivalent
const replacements: Array<{
	pattern: RegExp;
	replacement: string | ((match: string, ...args: string[]) => string);
	description: string;
}> = [
	// 1:1 renames
	{
		pattern: /\bpathExistsSync\b/g,
		replacement: "existsSync",
		description: "pathExistsSync → existsSync",
	},
	{
		pattern: /\breadDir\(/g,
		replacement: "readdirSync(",
		description: "readDir → readdirSync",
	},

	// Function call transformations with proper encoding
	{
		pattern: /\breadTextFileSync\(([^)]+)\)/g,
		replacement: 'readFileSync($1, "utf8")',
		description: "readTextFileSync(x) → readFileSync(x, 'utf8')",
	},
	{
		pattern: /\bwriteTextFileSync\(([^,]+),\s*([^)]+)\)/g,
		replacement: 'writeFileSync($1, $2, "utf8")',
		description: "writeTextFileSync(x, c) → writeFileSync(x, c, 'utf8')",
	},

	// JSON file operations - handle both generic and non-generic versions
	{
		pattern: /\breadJsonFileSync<([^>]+)>\(([^)]+)\)/g,
		replacement: 'JSON.parse(readFileSync($2, "utf8")) as $1',
		description:
			"readJsonFileSync<T>(x) → JSON.parse(readFileSync(x, 'utf8')) as T",
	},
	{
		pattern: /\breadJsonFileSync\(([^)]+)\)/g,
		replacement: 'JSON.parse(readFileSync($1, "utf8"))',
		description: "readJsonFileSync(x) → JSON.parse(readFileSync(x, 'utf8'))",
	},
	{
		pattern: /\bwriteJsonFileSync\(([^,]+),\s*([^,]+)(?:,\s*(\d+))?\)/g,
		replacement: (
			_match: string,
			path: string,
			value: string,
			spaces?: string,
		) => {
			const spacing = spaces || "2";
			return `writeFileSync(${path}, JSON.stringify(${value}, null, ${spacing}) + "\\n", "utf8")`;
		},
		description:
			"writeJsonFileSync(x, v, s) → writeFileSync(x, JSON.stringify(v, null, s) + '\\n', 'utf8')",
	},

	// Binary file operations
	{
		pattern: /\breadBinaryFileSync\(([^)]+)\)/g,
		replacement: "readFileSync($1)",
		description: "readBinaryFileSync(x) → readFileSync(x)",
	},
	{
		pattern: /\bwriteBinaryFileSync\(([^,]+),\s*([^)]+)\)/g,
		replacement: "writeFileSync($1, $2)",
		description: "writeBinaryFileSync(x, c) → writeFileSync(x, c)",
	},

	// Directory operations
	{
		pattern: /\bensureDir\(([^)]+)\)(?!\s*,)/g,
		replacement: "mkdir($1, { recursive: true })",
		description: "ensureDir(x) → mkdir(x, { recursive: true })",
	},
	{
		pattern: /\bensureDirSync\(([^)]+)\)/g,
		replacement: "mkdirSync($1, { recursive: true })",
		description: "ensureDirSync(x) → mkdirSync(x, { recursive: true })",
	},
	{
		pattern: /\bensureParentDir\(([^)]+)\)/g,
		replacement: "mkdir(dirname($1), { recursive: true })",
		description: "ensureParentDir(x) → mkdir(dirname(x), { recursive: true })",
	},
	{
		pattern: /\bensureParentDirSync\(([^)]+)\)/g,
		replacement: "mkdirSync(dirname($1), { recursive: true })",
		description:
			"ensureParentDirSync(x) → mkdirSync(dirname(x), { recursive: true })",
	},

	// File operations
	{
		pattern: /\bcopyFileSync\(([^)]+)\)/g,
		replacement: "copyFileSync($1)",
		description: "copyFileSync (wrapper) → copyFileSync (native)",
	},
	{
		pattern: /\bmoveFileSync\(([^)]+)\)/g,
		replacement: "renameSync($1)",
		description: "moveFileSync → renameSync",
	},
	{
		pattern: /\bunlinkSync\(([^)]+)\)/g,
		replacement: "unlinkSync($1)",
		description: "unlinkSync (wrapper) → unlinkSync (native)",
	},

	// Directory removal
	{
		pattern: /\bremoveDirSync\(([^,]+)(?:,\s*([^)]+))?\)/g,
		replacement: (_match: string, path: string, options?: string) => {
			if (options) {
				return `rmSync(${path}, { recursive: true, ...${options} })`;
			}
			return `rmSync(${path}, { recursive: true })`;
		},
		description:
			"removeDirSync(x, opts) → rmSync(x, { recursive: true, ...opts })",
	},

	// Directory reading
	{
		pattern: /\breadDirRecursiveSync\(([^)]+)\)/g,
		replacement: "readdirSync($1, { recursive: true })",
		description:
			"readDirRecursiveSync(x) → readdirSync(x, { recursive: true })",
	},

	// File appending
	{
		pattern: /\bappendToFileSync\(([^,]+),\s*([^)]+)\)/g,
		replacement: 'appendFileSync($1, $2, "utf8")',
		description: "appendToFileSync(x, c) → appendFileSync(x, c, 'utf8')",
	},

	// File type checks
	{
		pattern: /\bisDirectorySync\(([^)]+)\)/g,
		replacement: "existsSync($1) && statSync($1).isDirectory()",
		description:
			"isDirectorySync(x) → existsSync(x) && statSync(x).isDirectory()",
	},
	{
		pattern: /\bisFileSync\(([^)]+)\)/g,
		replacement: "existsSync($1) && statSync($1).isFile()",
		description: "isFileSync(x) → existsSync(x) && statSync(x).isFile()",
	},

	// Async operations
	{
		pattern: /\bmoveFile\(([^)]+)\)/g,
		replacement: "rename($1)",
		description: "moveFile → rename",
	},
	{
		pattern: /\bremoveDir\(([^,]+)(?:,\s*([^)]+))?\)/g,
		replacement: (_match: string, path: string, options?: string) => {
			if (options) {
				return `rm(${path}, { recursive: true, ...${options} })`;
			}
			return `rm(${path}, { recursive: true })`;
		},
		description: "removeDir(x, opts) → rm(x, { recursive: true, ...opts })",
	},
	{
		pattern: /\breadDirAsync\(([^)]+)\)/g,
		replacement: "readdir($1)",
		description: "readDirAsync → readdir",
	},
	{
		pattern: /\breadDirRecursive\(([^)]+)\)/g,
		replacement: "readdir($1, { recursive: true })",
		description: "readDirRecursive(x) → readdir(x, { recursive: true })",
	},
	{
		pattern: /\bappendToFile\(([^,]+),\s*([^)]+)\)/g,
		replacement: "appendFile($1, $2)",
		description: "appendToFile → appendFile",
	},
];

// Import transformations: wrapper name → Node.js name
const importMap = new Map<string, string>([
	// Sync operations
	["pathExistsSync", "existsSync"],
	["readTextFileSync", "readFileSync"],
	["writeTextFileSync", "writeFileSync"],
	["readJsonFileSync", "readFileSync"], // Also needs JSON.parse
	["writeJsonFileSync", "writeFileSync"], // Also needs JSON.stringify
	["readBinaryFileSync", "readFileSync"],
	["writeBinaryFileSync", "writeFileSync"],
	["readDir", "readdirSync"],
	["readDirRecursiveSync", "readdirSync"],
	["ensureDirSync", "mkdirSync"],
	["ensureParentDirSync", "mkdirSync"], // Also needs dirname
	["copyFileSync", "copyFileSync"],
	["moveFileSync", "renameSync"],
	["renameSync", "renameSync"],
	["unlinkSync", "unlinkSync"],
	["removeDirSync", "rmSync"],
	["appendToFileSync", "appendFileSync"],
	["isDirectorySync", "existsSync"], // Also needs statSync
	["isFileSync", "existsSync"], // Also needs statSync
	["statSync", "statSync"],

	// Async operations
	["ensureDir", "mkdir"],
	["ensureParentDir", "mkdir"], // Also needs dirname
	["moveFile", "rename"],
	["rename", "rename"],
	["unlink", "unlink"],
	["removeDir", "rm"],
	["readDirAsync", "readdir"],
	["readDirRecursive", "readdir"],
	["appendToFile", "appendFile"],
	["stat", "stat"],
]);

// Additional imports needed based on usage
const additionalImports = new Map<string, string[]>([
	["ensureParentDirSync", ["dirname"]],
	["ensureParentDir", ["dirname"]],
	["isDirectorySync", ["statSync"]],
	["isFileSync", ["statSync"]],
]);

interface MigrationResult {
	modified: boolean;
	changes: string[];
}

function migrateFile(filePath: string): MigrationResult {
	let content = readFileSync(filePath, "utf8");
	const originalContent = content;
	const changes: string[] = [];

	// Apply pattern replacements
	for (const replacement of replacements) {
		const { pattern, replacement: repl, description } = replacement;

		if (typeof repl === "function") {
			const matches = content.match(pattern);
			if (matches) {
				content = content.replace(pattern, repl as any);
				changes.push(description);
			}
		} else {
			if (pattern.test(content)) {
				content = content.replace(pattern, repl);
				changes.push(description);
			}
		}
	}

	// Update imports
	const importRegex =
		/import\s+\{([^}]+)\}\s+from\s+["']@sidequest\/core\/fs["'];?/g;
	const matches = Array.from(content.matchAll(importRegex));

	if (matches.length > 0) {
		const nodeImports = new Set<string>();
		const pathImports = new Set<string>();
		const coreImports = new Set<string>();

		for (const match of matches) {
			if (!match[1]) continue;
			const imports = match[1].split(",").map((s) => s.trim());

			for (const imp of imports) {
				const mapped = importMap.get(imp);
				if (mapped) {
					nodeImports.add(mapped);

					// Check for additional imports needed
					const additional = additionalImports.get(imp);
					if (additional) {
						for (const addImp of additional) {
							if (addImp === "dirname") {
								pathImports.add(addImp);
							} else {
								nodeImports.add(addImp);
							}
						}
					}
					changes.push(`Import: ${imp} → ${mapped}`);
				} else {
					// Keep imports that aren't being migrated
					coreImports.add(imp);
				}
			}
		}

		// Build new import statements
		const newImports: string[] = [];

		if (nodeImports.size > 0) {
			newImports.push(
				`import { ${Array.from(nodeImports).sort().join(", ")} } from "node:fs";`,
			);
		}

		if (pathImports.size > 0) {
			newImports.push(
				`import { ${Array.from(pathImports).sort().join(", ")} } from "node:path";`,
			);
		}

		if (coreImports.size > 0) {
			newImports.push(
				`import { ${Array.from(coreImports).sort().join(", ")} } from "@sidequest/core/fs";`,
			);
		}

		// Replace all @sidequest/core/fs imports with new imports
		content = content.replace(importRegex, "");

		// Insert new imports at the first import position
		const firstImportMatch = content.match(/^(import\s+)/m);
		if (firstImportMatch) {
			const insertPos = firstImportMatch.index!;
			content =
				content.slice(0, insertPos) +
				newImports.join("\n") +
				"\n" +
				content.slice(insertPos);
		} else {
			// If no imports found, add at the top after any comments/shebangs
			const afterShebang = content.match(/^#!.*\n/)?.[0].length || 0;
			content =
				content.slice(0, afterShebang) +
				newImports.join("\n") +
				"\n" +
				content.slice(afterShebang);
		}
	}

	// Only write if content changed
	if (content !== originalContent) {
		writeFileSync(filePath, content, "utf8");
		return { modified: true, changes };
	}

	return { modified: false, changes: [] };
}

// Main execution
console.log("🔍 Finding TypeScript files...\n");

const glob = new Glob("**/*.ts");
const allFiles = Array.from(
	glob.scanSync({ cwd: process.cwd(), absolute: true }),
);

// Filter out ignored paths
const files = allFiles.filter((file) => {
	const relativePath = file.replace(`${process.cwd()}/`, "");
	return (
		!relativePath.includes("node_modules/") &&
		!relativePath.endsWith(".test.ts") &&
		!relativePath.startsWith(".test-scratch/") &&
		!relativePath.startsWith("dist/") &&
		!relativePath.startsWith("build/")
	);
});

console.log(`📁 Found ${files.length} TypeScript files\n`);
console.log("🔧 Migrating files...\n");

const results: Array<{ file: string; changes: string[] }> = [];
let errorCount = 0;

for (const file of files) {
	try {
		const result = migrateFile(file);
		if (result.modified) {
			results.push({ file, changes: result.changes });
			const relativePath = file.replace(`${process.cwd()}/`, "");
			console.log(`✓ ${relativePath}`);
			for (const change of result.changes) {
				console.log(`  - ${change}`);
			}
			console.log();
		}
	} catch (error) {
		errorCount++;
		const relativePath = file.replace(`${process.cwd()}/`, "");
		console.error(`✗ ${relativePath}`);
		console.error(
			`  Error: ${error instanceof Error ? error.message : String(error)}`,
		);
		console.log();
	}
}

// Summary
console.log("━".repeat(80));
console.log("\n📊 Migration Summary\n");
console.log(`✅ Successfully migrated: ${results.length} files`);
console.log(`❌ Errors encountered: ${errorCount} files`);
console.log(
	`⏭️  Unchanged: ${files.length - results.length - errorCount} files`,
);

if (results.length > 0) {
	console.log("\n📋 Files modified:");
	for (const { file } of results) {
		const relativePath = file.replace(`${process.cwd()}/`, "");
		console.log(`  • ${relativePath}`);
	}
}

if (errorCount > 0) {
	console.log("\n⚠️  Please review errors above and fix manually.");
	process.exit(1);
}

console.log("\n✨ Migration complete!");
console.log("\n📝 Next steps:");
console.log("  1. Run: bun typecheck");
console.log("  2. Review changes: git diff");
console.log("  3. Run: bun test");
console.log("  4. Run: bun run validate");
