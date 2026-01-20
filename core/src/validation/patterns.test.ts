import { describe, expect, test } from "bun:test";
import {
	isRegexSafe,
	isValidGlob,
	SHELL_METACHARACTERS,
	validateGlob,
	validateRegex,
	validateShellSafePattern,
} from "./patterns.ts";

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

	test("rejects whitespace-only string", () => {
		expect(isValidGlob("   ")).toBe(false);
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

	test("rejects closing bracket before opening", () => {
		expect(isValidGlob("]abc[")).toBe(false);
	});

	test("rejects closing brace before opening", () => {
		expect(isValidGlob("}abc{")).toBe(false);
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

	test("returns error for empty patterns", () => {
		const result = validateGlob("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid glob pattern");
	});

	test("provides helpful error message", () => {
		const result = validateGlob("[unclosed");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("*.py");
		expect(result.error).toContain("**/*.ts");
	});
});

// ============================================================================
// Regex Validation Tests (ReDoS Prevention)
// ============================================================================

describe("isRegexSafe", () => {
	describe("accepts safe patterns", () => {
		test("simple literal patterns", () => {
			expect(isRegexSafe("hello")).toBe(true);
			expect(isRegexSafe("foo.*bar")).toBe(true);
			expect(isRegexSafe("^start")).toBe(true);
			expect(isRegexSafe("end$")).toBe(true);
		});

		test("character classes", () => {
			expect(isRegexSafe("[a-z]+")).toBe(true);
			expect(isRegexSafe("\\d{3}-\\d{4}")).toBe(true);
		});

		test("word boundaries", () => {
			expect(isRegexSafe("\\bword\\b")).toBe(true);
		});

		test("lookahead/lookbehind", () => {
			expect(isRegexSafe("(?=test)")).toBe(true);
			expect(isRegexSafe("(?<=test)")).toBe(true);
		});
	});

	describe("rejects ReDoS patterns", () => {
		test("nested quantifiers", () => {
			expect(isRegexSafe("(a+)+")).toBe(false);
			expect(isRegexSafe("(a*)*")).toBe(false);
		});

		test("overlapping alternation with quantifiers", () => {
			expect(isRegexSafe("(a|a)+")).toBe(false);
		});

		test("patterns with many consecutive quantifiers", () => {
			// Multiple groups with nested quantifiers trigger the safety check
			expect(isRegexSafe("(a+)+(b+)+(c+)+")).toBe(false);
		});
	});

	describe("length limits", () => {
		test("rejects very long patterns with default limit", () => {
			const longPattern = "a".repeat(600);
			expect(isRegexSafe(longPattern)).toBe(false);
		});

		test("accepts patterns under default limit", () => {
			const okPattern = "a".repeat(400);
			expect(isRegexSafe(okPattern)).toBe(true);
		});

		test("respects custom length limit", () => {
			const pattern = "a".repeat(100);
			expect(isRegexSafe(pattern, 50)).toBe(false);
			expect(isRegexSafe(pattern, 150)).toBe(true);
		});
	});

	describe("quantifier nesting detection", () => {
		test("accepts single quantifiers", () => {
			expect(isRegexSafe("a+")).toBe(true);
			expect(isRegexSafe("a*")).toBe(true);
			expect(isRegexSafe("a?")).toBe(true);
		});

		test("accepts reasonable quantifier combinations", () => {
			expect(isRegexSafe("a+b*")).toBe(true);
			expect(isRegexSafe("(ab)+c*")).toBe(true);
		});

		test("rejects excessive consecutive quantifiers", () => {
			// Note: "a+++" is actually valid regex (a++ followed by +)
			// Testing the detection of multiple quantifier groups instead
			expect(isRegexSafe("a++b++c++")).toBe(false);
			expect(isRegexSafe("a**b**c**")).toBe(false);
		});
	});
});

describe("validateRegex", () => {
	describe("accepts valid regex", () => {
		test("simple patterns", () => {
			const result = validateRegex("function\\s+\\w+");
			expect(result.valid).toBe(true);
			expect(result.value).toBeInstanceOf(RegExp);
			expect(result.value?.source).toBe("function\\s+\\w+");
		});

		test("patterns with character classes", () => {
			const result = validateRegex("[a-zA-Z0-9]+");
			expect(result.valid).toBe(true);
			expect(result.value).toBeInstanceOf(RegExp);
		});

		test("patterns with anchors", () => {
			const result = validateRegex("^start.*end$");
			expect(result.valid).toBe(true);
			expect(result.value).toBeInstanceOf(RegExp);
		});
	});

	describe("rejects invalid patterns", () => {
		test("empty pattern", () => {
			const result = validateRegex("");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("cannot be empty");
		});

		test("whitespace-only pattern", () => {
			const result = validateRegex("   ");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("cannot be empty");
		});

		test("invalid regex syntax", () => {
			const result = validateRegex("[unclosed");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("Invalid regex");
		});

		test("unbalanced parentheses", () => {
			const result = validateRegex("(unclosed");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("Invalid regex");
		});
	});

	describe("rejects ReDoS patterns", () => {
		test("nested quantifiers", () => {
			const result = validateRegex("(a+)+");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("performance issues");
		});

		test("overlapping alternation", () => {
			const result = validateRegex("(a|a)+");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("performance issues");
		});

		test("very long patterns", () => {
			const result = validateRegex("a".repeat(600));
			expect(result.valid).toBe(false);
			expect(result.error).toContain("performance issues");
		});
	});

	describe("trims whitespace", () => {
		test("leading and trailing spaces", () => {
			const result = validateRegex("  hello  ");
			expect(result.valid).toBe(true);
			// Note: RegExp source is always trimmed by the constructor
			expect(result.value?.source).toBe("hello");
		});
	});

	describe("provides helpful error messages", () => {
		test("performance issues message", () => {
			const result = validateRegex("(a+)+");
			expect(result.error).toBe(
				"Pattern may cause performance issues. Simplify nested quantifiers.",
			);
		});

		test("empty pattern message", () => {
			const result = validateRegex("");
			expect(result.error).toBe("Search pattern cannot be empty");
		});

		test("syntax error includes details", () => {
			const result = validateRegex("[unclosed");
			expect(result.error).toContain("Invalid regex:");
		});
	});
});

// ============================================================================
// Shell Safety Validation Tests (Defense-in-Depth)
// ============================================================================

describe("SHELL_METACHARACTERS", () => {
	test("matches semicolon", () => {
		expect(SHELL_METACHARACTERS.test("; rm -rf /")).toBe(true);
	});

	test("matches pipe", () => {
		expect(SHELL_METACHARACTERS.test("test | grep foo")).toBe(true);
	});

	test("matches ampersand", () => {
		expect(SHELL_METACHARACTERS.test("sleep 1 &")).toBe(true);
	});

	test("matches backticks", () => {
		expect(SHELL_METACHARACTERS.test("`whoami`")).toBe(true);
	});

	test("matches dollar sign", () => {
		expect(SHELL_METACHARACTERS.test("$HOME")).toBe(true);
		expect(SHELL_METACHARACTERS.test("$(echo pwned)")).toBe(true);
	});

	test("matches redirect operators", () => {
		expect(SHELL_METACHARACTERS.test("test > file")).toBe(true);
		expect(SHELL_METACHARACTERS.test("test < file")).toBe(true);
	});

	test("matches backslash", () => {
		expect(SHELL_METACHARACTERS.test("test\\ntest")).toBe(true);
	});

	test("does not match safe filenames", () => {
		expect(SHELL_METACHARACTERS.test("test.ts")).toBe(false);
		expect(SHELL_METACHARACTERS.test("src/index.js")).toBe(false);
		expect(SHELL_METACHARACTERS.test("my-file_2.test.ts")).toBe(false);
	});

	test("does not match safe glob patterns", () => {
		expect(SHELL_METACHARACTERS.test("*.ts")).toBe(false);
		expect(SHELL_METACHARACTERS.test("**/*.js")).toBe(false);
		expect(SHELL_METACHARACTERS.test("src/**/*.{ts,tsx}")).toBe(false);
	});
});

describe("validateShellSafePattern", () => {
	describe("accepts safe patterns", () => {
		test("simple filenames", () => {
			expect(() => validateShellSafePattern("test.ts")).not.toThrow();
			expect(() => validateShellSafePattern("index.js")).not.toThrow();
			expect(() => validateShellSafePattern("my-file_2.test.ts")).not.toThrow();
		});

		test("file paths", () => {
			expect(() => validateShellSafePattern("src/index.ts")).not.toThrow();
			expect(() =>
				validateShellSafePattern("test/unit/auth.test.ts"),
			).not.toThrow();
		});

		test("glob patterns", () => {
			expect(() => validateShellSafePattern("*.ts")).not.toThrow();
			expect(() => validateShellSafePattern("**/*.js")).not.toThrow();
			expect(() => validateShellSafePattern("src/**/*.{ts,tsx}")).not.toThrow();
		});

		test("patterns with special characters", () => {
			expect(() => validateShellSafePattern("[a-z]*.ts")).not.toThrow();
			expect(() => validateShellSafePattern("test-[0-9].js")).not.toThrow();
			expect(() => validateShellSafePattern("!*.test.ts")).not.toThrow();
		});
	});

	describe("rejects patterns with shell metacharacters", () => {
		test("semicolon injection", () => {
			expect(() => validateShellSafePattern("; rm -rf /")).toThrow(
				"Pattern contains shell metacharacters: ; rm -rf /",
			);
			expect(() => validateShellSafePattern("test.ts; echo pwned")).toThrow();
		});

		test("pipe injection", () => {
			expect(() => validateShellSafePattern("test | grep foo")).toThrow(
				"Pattern contains shell metacharacters: test | grep foo",
			);
		});

		test("ampersand injection", () => {
			expect(() => validateShellSafePattern("test & sleep 1")).toThrow(
				"Pattern contains shell metacharacters: test & sleep 1",
			);
		});

		test("backtick command substitution", () => {
			expect(() => validateShellSafePattern("`whoami`")).toThrow(
				"Pattern contains shell metacharacters: `whoami`",
			);
			expect(() =>
				validateShellSafePattern("test `cat /etc/passwd`"),
			).toThrow();
		});

		test("dollar sign command substitution", () => {
			expect(() => validateShellSafePattern("$(whoami)")).toThrow(
				"Pattern contains shell metacharacters: $(whoami)",
			);
			expect(() =>
				validateShellSafePattern("test $(cat /etc/passwd)"),
			).toThrow();
		});

		test("environment variable expansion", () => {
			expect(() => validateShellSafePattern("$HOME/test")).toThrow(
				"Pattern contains shell metacharacters: $HOME/test",
			);
		});

		test("redirect operators", () => {
			expect(() => validateShellSafePattern("test > /tmp/output")).toThrow(
				"Pattern contains shell metacharacters: test > /tmp/output",
			);
			expect(() => validateShellSafePattern("test < /tmp/input")).toThrow(
				"Pattern contains shell metacharacters: test < /tmp/input",
			);
		});

		test("backslash escapes", () => {
			expect(() => validateShellSafePattern("test\\nfile")).toThrow(
				"Pattern contains shell metacharacters: test\\nfile",
			);
		});
	});

	describe("edge cases", () => {
		test("empty pattern", () => {
			expect(() => validateShellSafePattern("")).not.toThrow();
		});

		test("pattern with multiple metacharacters", () => {
			expect(() =>
				validateShellSafePattern("; rm -rf / && echo done | tee log"),
			).toThrow();
		});

		test("pattern with metacharacters in middle", () => {
			expect(() => validateShellSafePattern("test;file.ts")).toThrow();
			expect(() => validateShellSafePattern("dir|file.ts")).toThrow();
		});
	});
});
