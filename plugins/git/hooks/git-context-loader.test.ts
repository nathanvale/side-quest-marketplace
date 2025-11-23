import { describe, expect, test } from "bun:test";
import { parseGitStatus } from "./git-context-loader";

describe("git-context-loader", () => {
	test("parseGitStatus parses clean status", () => {
		const output = "## main...origin/main";
		const result = parseGitStatus(output);
		expect(result.branch).toBe("main");
		expect(result.status).toEqual({ staged: 0, modified: 0, untracked: 0 });
	});

	test("parseGitStatus parses dirty status", () => {
		const output = `## feature/test...origin/feature/test [ahead 1]
M  modified-file.ts
A  staged-file.ts
?? untracked-file.ts
 D deleted-file.ts`;

		const result = parseGitStatus(output);
		expect(result.branch).toBe("feature/test");
		// M (modified), A (staged), ?? (untracked), D (unstaged delete -> modified)
		// M  -> index: M, worktree: space -> staged
		// A  -> index: A, worktree: space -> staged
		// ?? -> untracked
		//  D -> index: space, worktree: D -> modified

		// Let's check the logic in parseGitStatus:
		// if (code.startsWith("?") || code === "??") untracked++
		// else:
		//   if (code[0] !== " " && code[0] !== "?") staged++
		//   if (code[1] !== " " && code[1] !== "?") modified++

		// M  -> code="M " -> staged++
		// A  -> code="A " -> staged++
		// ?? -> untracked++
		//  D -> code=" D" -> modified++

		expect(result.status).toEqual({ staged: 2, modified: 1, untracked: 1 });
	});

	test("parseGitStatus handles detached head", () => {
		const output = "## HEAD (no branch)";
		const result = parseGitStatus(output);
		expect(result.branch).toBe("HEAD (no branch)");
	});
});
