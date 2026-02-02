import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { detectInstallCommand } from "./detect-pm.js";

describe("detectInstallCommand", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("returns null when no lockfile exists", () => {
		expect(detectInstallCommand(tmpDir)).toBeNull();
	});

	test("detects bun.lock", () => {
		fs.writeFileSync(path.join(tmpDir, "bun.lock"), "");
		expect(detectInstallCommand(tmpDir)).toBe("bun install");
	});

	test("detects bun.lockb", () => {
		fs.writeFileSync(path.join(tmpDir, "bun.lockb"), "");
		expect(detectInstallCommand(tmpDir)).toBe("bun install");
	});

	test("detects yarn.lock", () => {
		fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
		expect(detectInstallCommand(tmpDir)).toBe("yarn install");
	});

	test("detects pnpm-lock.yaml", () => {
		fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
		expect(detectInstallCommand(tmpDir)).toBe("pnpm install");
	});

	test("detects package-lock.json", () => {
		fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "");
		expect(detectInstallCommand(tmpDir)).toBe("npm install");
	});

	test("bun takes priority over yarn", () => {
		fs.writeFileSync(path.join(tmpDir, "bun.lock"), "");
		fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
		expect(detectInstallCommand(tmpDir)).toBe("bun install");
	});

	test("yarn takes priority over pnpm", () => {
		fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
		fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
		expect(detectInstallCommand(tmpDir)).toBe("yarn install");
	});

	test("pnpm takes priority over npm", () => {
		fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
		fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "");
		expect(detectInstallCommand(tmpDir)).toBe("pnpm install");
	});
});
