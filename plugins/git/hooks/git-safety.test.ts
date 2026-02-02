import { describe, expect, test } from "bun:test";
import { checkCommand, checkFileEdit } from "./git-safety";

describe("checkCommand", () => {
	test("blocks git push --force", () => {
		const result = checkCommand("git push --force origin main");
		expect(result.blocked).toBe(true);
		expect(result.reason).toContain("Force push");
	});

	test("blocks git push -f", () => {
		const result = checkCommand("git push -f origin main");
		expect(result.blocked).toBe(true);
	});

	test("blocks git reset --hard", () => {
		const result = checkCommand("git reset --hard HEAD~1");
		expect(result.blocked).toBe(true);
		expect(result.reason).toContain("Hard reset");
	});

	test("blocks git clean -f", () => {
		const result = checkCommand("git clean -f");
		expect(result.blocked).toBe(true);
	});

	test("blocks git clean -fd", () => {
		const result = checkCommand("git clean -fd");
		expect(result.blocked).toBe(true);
	});

	test("blocks git checkout .", () => {
		const result = checkCommand("git checkout .");
		expect(result.blocked).toBe(true);
	});

	test("blocks git restore .", () => {
		const result = checkCommand("git restore .");
		expect(result.blocked).toBe(true);
	});

	test("blocks git branch -D", () => {
		const result = checkCommand("git branch -D feature/old");
		expect(result.blocked).toBe(true);
	});

	test("allows git push (no force)", () => {
		const result = checkCommand("git push origin main");
		expect(result.blocked).toBe(false);
	});

	test("allows git push --force-with-lease", () => {
		// --force-with-lease is the safe alternative to --force
		const result = checkCommand("git push --force-with-lease origin main");
		expect(result.blocked).toBe(false);
	});

	test("allows git reset --soft", () => {
		const result = checkCommand("git reset --soft HEAD~1");
		expect(result.blocked).toBe(false);
	});

	test("allows git status", () => {
		const result = checkCommand("git status");
		expect(result.blocked).toBe(false);
	});

	test("allows git checkout specific file", () => {
		const result = checkCommand("git checkout src/index.ts");
		expect(result.blocked).toBe(false);
	});

	test("allows git branch -d (lowercase)", () => {
		const result = checkCommand("git branch -d feature/merged");
		expect(result.blocked).toBe(false);
	});

	test("allows non-git commands", () => {
		const result = checkCommand("ls -la");
		expect(result.blocked).toBe(false);
	});

	test("allows git restore specific file", () => {
		const result = checkCommand("git restore src/index.ts");
		expect(result.blocked).toBe(false);
	});
});

describe("checkFileEdit", () => {
	test("blocks .env file", () => {
		const result = checkFileEdit("/project/.env");
		expect(result.blocked).toBe(true);
		expect(result.reason).toContain(".env");
	});

	test("blocks .env.local file", () => {
		const result = checkFileEdit("/project/.env.local");
		expect(result.blocked).toBe(true);
		expect(result.reason).toContain(".env");
	});

	test("blocks .env.production file", () => {
		const result = checkFileEdit("/project/.env.production");
		expect(result.blocked).toBe(true);
	});

	test("blocks credentials file", () => {
		const result = checkFileEdit("/home/user/credentials.json");
		expect(result.blocked).toBe(true);
		expect(result.reason).toContain("Credential");
	});

	test("blocks credentials directory file", () => {
		const result = checkFileEdit("/project/credentials/api-key.txt");
		expect(result.blocked).toBe(true);
	});

	test("blocks .git/ directory files", () => {
		const result = checkFileEdit("/project/.git/config");
		expect(result.blocked).toBe(true);
		expect(result.reason).toContain(".git");
	});

	test("blocks .git/hooks/ files", () => {
		const result = checkFileEdit("/project/.git/hooks/pre-commit");
		expect(result.blocked).toBe(true);
	});

	test("allows regular source files", () => {
		const result = checkFileEdit("/project/src/index.ts");
		expect(result.blocked).toBe(false);
	});

	test("allows package.json", () => {
		const result = checkFileEdit("/project/package.json");
		expect(result.blocked).toBe(false);
	});

	test("allows .gitignore (not inside .git/)", () => {
		const result = checkFileEdit("/project/.gitignore");
		expect(result.blocked).toBe(false);
	});

	test("allows README.md", () => {
		const result = checkFileEdit("/project/README.md");
		expect(result.blocked).toBe(false);
	});
});
