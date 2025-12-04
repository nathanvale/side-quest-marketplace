import fs from "node:fs";
import path from "node:path";

import { spawnAndCollect } from "../../../core/src/spawn/index.js";
import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

async function getGitRootForDir(dir: string): Promise<string | null> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "rev-parse", "--show-toplevel"],
		{ cwd: dir },
	);
	if (exitCode !== 0) return null;
	return stdout.trim() || null;
}

export async function assertGitRepo(dir: string): Promise<void> {
	const root = await getGitRootForDir(dir);
	if (!root) {
		throw new Error("Vault must be inside a git repository for writes.");
	}

	const realRoot = fs.existsSync(root)
		? fs.realpathSync(root)
		: path.resolve(root);
	const realDir = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
	if (!realDir.startsWith(realRoot)) {
		throw new Error("Vault must be inside a git repository for writes.");
	}
}

export async function gitStatus(dir: string): Promise<{ clean: boolean }> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "status", "--porcelain"],
		{ cwd: dir },
	);
	if (exitCode !== 0) throw new Error("git status failed");
	const output = stdout.trim();
	return { clean: output.length === 0 };
}

export async function gitAdd(dir: string, paths: string[]): Promise<void> {
	const { exitCode, stderr } = await spawnAndCollect(["git", "add", ...paths], {
		cwd: dir,
	});
	if (exitCode !== 0) {
		throw new Error(`git add failed: ${stderr}`);
	}
}

export async function gitCommit(
	dir: string,
	message: string,
): Promise<{ committed: boolean }> {
	const { exitCode } = await spawnAndCollect(["git", "commit", "-m", message], {
		cwd: dir,
	});
	// Non-zero when nothing to commit.
	return { committed: exitCode === 0 };
}

export async function autoCommitChanges(
	config: ParaObsidianConfig,
	paths: ReadonlyArray<string>,
	summary = "update",
): Promise<{
	committed: boolean;
	skipped: boolean;
	message: string;
	paths: ReadonlyArray<string>;
}> {
	if (!config.autoCommit) {
		return { committed: false, skipped: true, message: "", paths: [] };
	}

	await assertGitRepo(config.vault);
	const gitRoot = await getGitRootForDir(config.vault);
	if (!gitRoot) {
		throw new Error("Vault must be inside a git repository for auto-commit.");
	}

	const realGitRoot = fs.realpathSync(gitRoot);

	const normalizedPaths = Array.from(
		new Set(
			paths.map((p) => {
				const resolved = resolveVaultPath(config.vault, p);
				const absolute = fs.realpathSync(resolved.absolute);
				return path.relative(realGitRoot, absolute);
			}),
		),
	).filter(Boolean);

	if (normalizedPaths.length === 0) {
		return { committed: false, skipped: false, message: "", paths: [] };
	}

	await gitAdd(gitRoot, normalizedPaths);

	const template =
		config.gitCommitMessageTemplate ?? "chore: para-obsidian {summary}";
	const message = template
		.replace("{summary}", summary)
		.replace("{files}", normalizedPaths.join(", "));

	const { committed } = await gitCommit(gitRoot, message);
	return { committed, skipped: false, message, paths: normalizedPaths };
}
