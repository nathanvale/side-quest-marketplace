import { describe, expect, test } from "bun:test";
import { parseGitStatus } from "./auto-commit-check";

describe("parseGitStatus", () => {
	test("parses clean status", () => {
		const result = parseGitStatus("");
		expect(result).toEqual({ staged: 0, modified: 0, untracked: 0 });
	});

	test("parses staged files", () => {
		const output = `M  src/index.ts
A  src/new-file.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 2, modified: 0, untracked: 0 });
	});

	test("parses modified files (unstaged)", () => {
		const output = ` M src/index.ts
 M src/other.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 0, modified: 2, untracked: 0 });
	});

	test("parses untracked files", () => {
		const output = `?? src/new-file.ts
?? src/another.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 0, modified: 0, untracked: 2 });
	});

	test("parses mixed status", () => {
		const output = `M  src/staged.ts
 M src/modified.ts
MM src/both.ts
?? src/untracked.ts`;
		const result = parseGitStatus(output);
		// M  = staged only (1)
		//  M = modified only (1)
		// MM = staged AND modified (counts as 1 staged + 1 modified)
		// ?? = untracked (1)
		expect(result).toEqual({ staged: 2, modified: 2, untracked: 1 });
	});

	test("ignores branch line", () => {
		const output = `## main...origin/main
M  src/index.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 1, modified: 0, untracked: 0 });
	});

	test("handles deleted files", () => {
		const output = `D  src/deleted.ts
 D src/deleted-unstaged.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 1, modified: 1, untracked: 0 });
	});

	test("handles renamed files", () => {
		const output = `R  src/old.ts -> src/new.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 1, modified: 0, untracked: 0 });
	});
});
