import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expandTilde, normalizePath } from "@sidequest/core/fs";
import {
	isRegexSafe,
	isValidGlob,
	validateGlob,
	validateRegex,
} from "@sidequest/core/validation";
import {
	validateAstSearchInputs,
	validateFileContentInputs,
	validateFileTreeInputs,
	validateGrepInputs,
	validatePath,
	validatePositiveInt,
	validateSemanticInputs,
	validateSymbolsInputs,
	validateUsagesInputs,
} from "./validators";

// ============================================================================
// Path Utilities Tests
// ============================================================================

describe("expandTilde", () => {
	test("expands ~ to home directory", () => {
		expect(expandTilde("~")).toBe(homedir());
	});

	test("expands ~/ prefix", () => {
		expect(expandTilde("~/code")).toBe(join(homedir(), "code"));
	});

	test("expands ~/nested/path", () => {
		expect(expandTilde("~/code/my-second-brain")).toBe(
			join(homedir(), "code/my-second-brain"),
		);
	});

	test("preserves absolute paths", () => {
		expect(expandTilde("/absolute/path")).toBe("/absolute/path");
	});

	test("preserves relative paths without tilde", () => {
		expect(expandTilde("relative/path")).toBe("relative/path");
	});

	test("does not expand tilde in middle of path", () => {
		expect(expandTilde("/some/~path")).toBe("/some/~path");
	});
});

describe("normalizePath", () => {
	test("expands tilde and normalizes", () => {
		const result = normalizePath("~/code");
		expect(result).toBe(join(homedir(), "code"));
	});

	test("resolves relative paths from cwd", () => {
		const result = normalizePath("src");
		expect(result).toBe(resolve(process.cwd(), "src"));
	});

	test("resolves relative paths from custom base", () => {
		const result = normalizePath("src", "/custom/base");
		expect(result).toBe("/custom/base/src");
	});

	test("normalizes .. sequences", () => {
		const result = normalizePath("/a/b/../c");
		expect(result).toBe("/a/c");
	});

	test("normalizes redundant separators", () => {
		const result = normalizePath("/a//b///c");
		expect(result).toBe("/a/b/c");
	});
});

// ============================================================================
// Path Validation Tests
// ============================================================================

describe("validatePath", () => {
	describe("basic validation", () => {
		test("rejects empty string", () => {
			const result = validatePath("");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("cannot be empty");
		});

		test("rejects whitespace-only string", () => {
			const result = validatePath("   ");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("cannot be empty");
		});

		test("validates existing directory", () => {
			const result = validatePath(homedir());
			expect(result.valid).toBe(true);
			expect(result.path).toBe(homedir());
		});

		test("expands tilde in path", () => {
			const result = validatePath("~");
			expect(result.valid).toBe(true);
			expect(result.path).toBe(homedir());
		});

		test("rejects non-existent path by default", () => {
			const result = validatePath("/this/path/does/not/exist");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("does not exist");
		});

		test("allows non-existent path when mustExist is false", () => {
			const result = validatePath("/this/path/does/not/exist", {
				mustExist: false,
			});
			expect(result.valid).toBe(true);
		});
	});

	describe("directory validation", () => {
		test("rejects file when mustBeDirectory is true", () => {
			// package.json should exist and be a file
			const result = validatePath(join(process.cwd(), "package.json"));
			expect(result.valid).toBe(false);
			expect(result.error).toContain("not a directory");
		});

		test("allows file when mustBeDirectory is false", () => {
			const result = validatePath(join(process.cwd(), "package.json"), {
				mustBeDirectory: false,
			});
			expect(result.valid).toBe(true);
		});
	});

	describe("path traversal prevention", () => {
		test("allows paths within base directory", () => {
			const base = homedir();
			const result = validatePath("~/code", { basePath: base });
			expect(result.valid).toBe(true);
		});

		test("rejects paths escaping base directory", () => {
			const base = join(homedir(), "restricted");
			const result = validatePath("/etc/passwd", { basePath: base });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("traversal detected");
		});

		test("rejects .. sequences escaping base", () => {
			const base = join(homedir(), "code");
			const result = validatePath(join(base, "../../etc"), {
				basePath: base,
				mustExist: false,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("traversal detected");
		});
	});
});

// ============================================================================
// Glob Validation Tests
// ============================================================================

describe("isValidGlob", () => {
	test("accepts simple extension pattern", () => {
		expect(isValidGlob("*.ts")).toBe(true);
	});

	test("accepts recursive pattern", () => {
		expect(isValidGlob("**/*.ts")).toBe(true);
	});

	test("accepts character class", () => {
		expect(isValidGlob("[abc].txt")).toBe(true);
	});

	test("accepts brace expansion", () => {
		expect(isValidGlob("*.{ts,js}")).toBe(true);
	});

	test("accepts negation pattern", () => {
		expect(isValidGlob("!*.test.ts")).toBe(true);
	});

	test("accepts complex path pattern", () => {
		expect(isValidGlob("src/**/[a-z]*.{ts,tsx}")).toBe(true);
	});

	test("rejects empty string", () => {
		expect(isValidGlob("")).toBe(false);
	});

	test("rejects pattern with shell injection chars", () => {
		expect(isValidGlob("*.ts; rm -rf /")).toBe(false);
	});

	test("rejects pattern with backticks", () => {
		expect(isValidGlob("`whoami`.ts")).toBe(false);
	});

	test("rejects pattern with $", () => {
		expect(isValidGlob("$HOME/*.ts")).toBe(false);
	});

	test("rejects unbalanced brackets", () => {
		expect(isValidGlob("[abc")).toBe(false);
	});

	test("rejects unbalanced braces", () => {
		expect(isValidGlob("{a,b")).toBe(false);
	});
});

describe("validateGlob", () => {
	test("returns valid for good patterns", () => {
		const result = validateGlob("**/*.ts");
		expect(result.valid).toBe(true);
		expect(result.value).toBe("**/*.ts");
	});

	test("trims whitespace", () => {
		const result = validateGlob("  *.ts  ");
		expect(result.valid).toBe(true);
		expect(result.value).toBe("*.ts");
	});

	test("returns error for invalid patterns", () => {
		const result = validateGlob("*.ts; echo pwned");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid glob pattern");
	});
});

// ============================================================================
// Regex Validation Tests (ReDoS Prevention)
// ============================================================================

describe("isRegexSafe", () => {
	test("accepts simple patterns", () => {
		expect(isRegexSafe("hello")).toBe(true);
		expect(isRegexSafe("foo.*bar")).toBe(true);
		expect(isRegexSafe("^start")).toBe(true);
		expect(isRegexSafe("end$")).toBe(true);
	});

	test("accepts character classes", () => {
		expect(isRegexSafe("[a-z]+")).toBe(true);
		expect(isRegexSafe("\\d{3}-\\d{4}")).toBe(true);
	});

	test("rejects nested quantifiers (ReDoS)", () => {
		expect(isRegexSafe("(a+)+")).toBe(false);
		expect(isRegexSafe("(a*)*")).toBe(false);
	});

	test("rejects overlapping alternation with quantifiers", () => {
		expect(isRegexSafe("(a|a)+")).toBe(false);
	});

	test("rejects patterns with many consecutive quantifiers", () => {
		// Multiple groups with nested quantifiers trigger the safety check
		expect(isRegexSafe("(a+)+(b+)+(c+)+")).toBe(false);
	});

	test("rejects very long patterns", () => {
		const longPattern = "a".repeat(600);
		expect(isRegexSafe(longPattern)).toBe(false);
	});
});

describe("validateRegex", () => {
	test("accepts valid regex", () => {
		const result = validateRegex("function\\s+\\w+");
		expect(result.valid).toBe(true);
		expect(result.value).toBeInstanceOf(RegExp);
		expect(result.value?.source).toBe("function\\s+\\w+");
	});

	test("rejects empty pattern", () => {
		const result = validateRegex("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("cannot be empty");
	});

	test("rejects invalid regex syntax", () => {
		const result = validateRegex("[unclosed");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid regex");
	});

	test("rejects ReDoS patterns", () => {
		const result = validateRegex("(a+)+");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("performance issues");
	});

	test("trims whitespace", () => {
		const result = validateRegex("  hello  ");
		expect(result.valid).toBe(true);
		expect(result.value).toBeInstanceOf(RegExp);
		expect(result.value?.source).toBe("hello");
	});
});

// ============================================================================
// Integer Validation Tests
// ============================================================================

describe("validatePositiveInt", () => {
	test("accepts valid integer", () => {
		const result = validatePositiveInt(10, { name: "count" });
		expect(result.valid).toBe(true);
		expect(result.value).toBe(10);
	});

	test("accepts string number", () => {
		const result = validatePositiveInt("42", { name: "count" });
		expect(result.valid).toBe(true);
		expect(result.value).toBe(42);
	});

	test("uses default value for undefined", () => {
		const result = validatePositiveInt(undefined, {
			name: "count",
			defaultValue: 100,
		});
		expect(result.valid).toBe(true);
		expect(result.value).toBe(100);
	});

	test("rejects undefined without default", () => {
		const result = validatePositiveInt(undefined, { name: "count" });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("required");
	});

	test("rejects non-integer", () => {
		const result = validatePositiveInt(3.14, { name: "count" });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("integer");
	});

	test("rejects below min", () => {
		const result = validatePositiveInt(0, { name: "count", min: 1 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("between");
	});

	test("rejects above max", () => {
		const result = validatePositiveInt(2000, { name: "count", max: 1000 });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("between");
	});

	test("rejects NaN", () => {
		const result = validatePositiveInt("not a number", { name: "count" });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("must be a number");
	});
});

// ============================================================================
// Composite Validator Tests
// ============================================================================

describe("validateGrepInputs", () => {
	const validPath = homedir(); // Use home directory which always exists

	test("validates correct inputs", () => {
		const result = validateGrepInputs({
			pattern: "function",
			path: validPath,
			maxResults: 50,
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.validated?.pattern).toBe("function");
		expect(result.validated?.maxResults).toBe(50);
	});

	test("uses current directory as default path when not provided", () => {
		const result = validateGrepInputs({
			pattern: "test",
		});
		// cwd always exists, so this should pass validation
		expect(result.valid).toBe(true);
		expect(result.validated?.path).toBe(process.cwd());
	});

	test("validates optional include pattern", () => {
		const result = validateGrepInputs({
			pattern: "test",
			path: validPath,
			include: "*.ts",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.include).toBe("*.ts");
	});

	test("validates optional exclude pattern", () => {
		const result = validateGrepInputs({
			pattern: "test",
			path: validPath,
			exclude: "node_modules/**",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.exclude).toBe("node_modules/**");
	});

	test("collects multiple errors", () => {
		const result = validateGrepInputs({
			pattern: "(a+)+", // ReDoS
			path: "/nonexistent/path",
			include: "*.ts; rm -rf /", // injection
		});
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});

	test("uses default maxResults", () => {
		const result = validateGrepInputs({
			pattern: "test",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.maxResults).toBe(100);
	});
});

describe("validateSemanticInputs", () => {
	const validPath = homedir();

	test("validates correct inputs", () => {
		const result = validateSemanticInputs({
			query: "how does authentication work",
			path: validPath,
			topK: 10,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.query).toBe("how does authentication work");
		expect(result.validated?.topK).toBe(10);
	});

	test("rejects empty query", () => {
		const result = validateSemanticInputs({
			query: "",
			path: validPath,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Query"))).toBe(true);
	});

	test("trims query whitespace", () => {
		const result = validateSemanticInputs({
			query: "  find auth code  ",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.query).toBe("find auth code");
	});

	test("uses default topK", () => {
		const result = validateSemanticInputs({
			query: "test query",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.topK).toBe(5);
	});

	test("rejects topK out of range", () => {
		const result = validateSemanticInputs({
			query: "test",
			path: validPath,
			topK: 100,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("topK"))).toBe(true);
	});
});

describe("validateSymbolsInputs", () => {
	const validPath = homedir();

	test("validates correct inputs", () => {
		const result = validateSymbolsInputs({
			path: validPath,
			pattern: "*.ts",
			symbolType: "function",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.pattern).toBe("*.ts");
		expect(result.validated?.symbolType).toBe("function");
	});

	test("validates without optional fields", () => {
		const result = validateSymbolsInputs({
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.pattern).toBeUndefined();
		expect(result.validated?.symbolType).toBeUndefined();
	});

	test("normalizes symbol type to lowercase", () => {
		const result = validateSymbolsInputs({
			path: validPath,
			symbolType: "FUNCTION",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.symbolType).toBe("function");
	});

	test("rejects invalid symbol type", () => {
		const result = validateSymbolsInputs({
			path: validPath,
			symbolType: "banana",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Invalid symbol type"))).toBe(
			true,
		);
	});

	test("validates all allowed symbol types", () => {
		const validTypes = [
			"function",
			"class",
			"variable",
			"type",
			"interface",
			"method",
			"property",
			"constant",
		];
		for (const symbolType of validTypes) {
			const result = validateSymbolsInputs({ path: validPath, symbolType });
			expect(result.valid).toBe(true);
			expect(result.validated?.symbolType).toBe(symbolType);
		}
	});

	test("rejects invalid file pattern", () => {
		const result = validateSymbolsInputs({
			path: validPath,
			pattern: "*.ts; echo pwned",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("File pattern"))).toBe(true);
	});
});

// ============================================================================
// File Tree Validator Tests
// ============================================================================

describe("validateFileTreeInputs", () => {
	const validPath = homedir();

	test("validates correct inputs", () => {
		const result = validateFileTreeInputs({
			path: validPath,
			subpath: "src/components",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.path).toBe(validPath);
		expect(result.validated?.subpath).toBe("src/components");
	});

	test("uses current directory as default path", () => {
		const result = validateFileTreeInputs({});
		expect(result.valid).toBe(true);
		expect(result.validated?.path).toBe(process.cwd());
	});

	test("validates without subpath", () => {
		const result = validateFileTreeInputs({
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.subpath).toBeUndefined();
	});

	test("trims subpath whitespace", () => {
		const result = validateFileTreeInputs({
			path: validPath,
			subpath: "  src/lib  ",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.subpath).toBe("src/lib");
	});

	test("rejects path traversal in subpath", () => {
		const result = validateFileTreeInputs({
			path: validPath,
			subpath: "../../../etc",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("traversal"))).toBe(true);
	});

	test("rejects embedded path traversal in subpath", () => {
		const result = validateFileTreeInputs({
			path: validPath,
			subpath: "src/../../../etc/passwd",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("traversal"))).toBe(true);
	});

	test("rejects non-existent path", () => {
		const result = validateFileTreeInputs({
			path: "/nonexistent/path/abc123",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("does not exist"))).toBe(true);
	});
});

// ============================================================================
// File Content Validator Tests
// ============================================================================

describe("validateFileContentInputs", () => {
	const validPath = homedir();

	test("validates correct inputs", () => {
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: ["src/index.ts", "package.json"],
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.filePaths).toEqual([
			"src/index.ts",
			"package.json",
		]);
	});

	test("uses current directory as default path", () => {
		const result = validateFileContentInputs({
			filePaths: ["README.md"],
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.path).toBe(process.cwd());
	});

	test("rejects empty filePaths array", () => {
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: [],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("At least one"))).toBe(true);
	});

	test("rejects empty string in filePaths", () => {
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: ["valid.ts", "", "another.ts"],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("cannot be empty"))).toBe(true);
	});

	test("trims whitespace from file paths", () => {
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: ["  src/index.ts  ", "  package.json  "],
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.filePaths).toEqual([
			"src/index.ts",
			"package.json",
		]);
	});

	test("rejects path traversal in filePaths", () => {
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: ["../../../etc/passwd"],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("traversal"))).toBe(true);
	});

	test("rejects embedded path traversal", () => {
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: ["src/../../../etc/passwd"],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("traversal"))).toBe(true);
	});

	test("rejects more than 20 files", () => {
		const tooManyFiles = Array.from({ length: 21 }, (_, i) => `file${i}.ts`);
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: tooManyFiles,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("more than 20"))).toBe(true);
	});

	test("accepts exactly 20 files", () => {
		const maxFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
		const result = validateFileContentInputs({
			path: validPath,
			filePaths: maxFiles,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.filePaths).toHaveLength(20);
	});
});

// ============================================================================
// Usages Validator Tests
// ============================================================================

describe("validateUsagesInputs", () => {
	const validPath = homedir();

	test("validates correct inputs", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "AuthService",
			symbolType: "class",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.symbolName).toBe("AuthService");
		expect(result.validated?.symbolType).toBe("class");
	});

	test("uses current directory as default path", () => {
		const result = validateUsagesInputs({
			symbolName: "myFunction",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.path).toBe(process.cwd());
	});

	test("validates without symbolType", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "MyComponent",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.symbolType).toBeUndefined();
	});

	test("rejects empty symbolName", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "",
		});
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Symbol name is required")),
		).toBe(true);
	});

	test("rejects whitespace-only symbolName", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "   ",
		});
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Symbol name is required")),
		).toBe(true);
	});

	test("trims symbolName whitespace", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "  trimMe  ",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.symbolName).toBe("trimMe");
	});

	test("normalizes symbolType to lowercase", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "Test",
			symbolType: "FUNCTION",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.symbolType).toBe("function");
	});

	test("rejects invalid symbolType", () => {
		const result = validateUsagesInputs({
			path: validPath,
			symbolName: "Test",
			symbolType: "banana",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Invalid symbol type"))).toBe(
			true,
		);
	});

	test("validates all allowed symbol types", () => {
		const validTypes = [
			"function",
			"class",
			"variable",
			"type",
			"interface",
			"method",
			"property",
			"constant",
		];
		for (const symbolType of validTypes) {
			const result = validateUsagesInputs({
				path: validPath,
				symbolName: "Test",
				symbolType,
			});
			expect(result.valid).toBe(true);
			expect(result.validated?.symbolType).toBe(symbolType);
		}
	});
});

// ============================================================================
// AST Search Validator Tests
// ============================================================================

describe("validateAstSearchInputs", () => {
	const validPath = homedir();

	test("validates correct inputs", () => {
		const result = validateAstSearchInputs({
			pattern: "async function",
			mode: "simple",
			filePattern: "**/*.ts",
			path: validPath,
			maxResults: 50,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.pattern).toBe("async function");
		expect(result.validated?.mode).toBe("simple");
		expect(result.validated?.filePattern).toBe("**/*.ts");
		expect(result.validated?.maxResults).toBe(50);
	});

	test("uses current directory as default path", () => {
		const result = validateAstSearchInputs({
			pattern: "class",
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.path).toBe(process.cwd());
	});

	test("uses simple as default mode", () => {
		const result = validateAstSearchInputs({
			pattern: "function",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.mode).toBe("simple");
	});

	test("uses 100 as default maxResults", () => {
		const result = validateAstSearchInputs({
			pattern: "import",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.maxResults).toBe(100);
	});

	test("rejects empty pattern", () => {
		const result = validateAstSearchInputs({
			pattern: "",
			path: validPath,
		});
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Pattern cannot be empty")),
		).toBe(true);
	});

	test("rejects whitespace-only pattern", () => {
		const result = validateAstSearchInputs({
			pattern: "   ",
			path: validPath,
		});
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Pattern cannot be empty")),
		).toBe(true);
	});

	test("trims pattern whitespace", () => {
		const result = validateAstSearchInputs({
			pattern: "  async function  ",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.pattern).toBe("async function");
	});

	test("normalizes mode to lowercase", () => {
		const result = validateAstSearchInputs({
			pattern: "class",
			mode: "SIMPLE",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.mode).toBe("simple");
	});

	test("rejects invalid mode", () => {
		const result = validateAstSearchInputs({
			pattern: "function",
			mode: "invalid",
			path: validPath,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Invalid mode"))).toBe(true);
	});

	test("accepts pattern mode", () => {
		const result = validateAstSearchInputs({
			pattern: '{"type": "function_declaration"}',
			mode: "pattern",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.mode).toBe("pattern");
	});

	test("validates filePattern glob", () => {
		const result = validateAstSearchInputs({
			pattern: "class",
			filePattern: "**/*.{ts,tsx}",
			path: validPath,
		});
		expect(result.valid).toBe(true);
		expect(result.validated?.filePattern).toBe("**/*.{ts,tsx}");
	});

	test("rejects invalid filePattern", () => {
		const result = validateAstSearchInputs({
			pattern: "function",
			filePattern: "*.ts; rm -rf /",
			path: validPath,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("File pattern"))).toBe(true);
	});

	test("rejects maxResults below 1", () => {
		const result = validateAstSearchInputs({
			pattern: "import",
			path: validPath,
			maxResults: 0,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("maxResults"))).toBe(true);
	});

	test("rejects maxResults above 500", () => {
		const result = validateAstSearchInputs({
			pattern: "export",
			path: validPath,
			maxResults: 501,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("maxResults"))).toBe(true);
	});

	test("collects multiple errors", () => {
		const result = validateAstSearchInputs({
			pattern: "",
			mode: "invalid",
			filePattern: "*.ts; echo pwned",
			path: "/nonexistent/path",
			maxResults: 9999,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(3);
	});
});
