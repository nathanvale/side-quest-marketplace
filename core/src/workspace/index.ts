/**
 * Workspace utilities for detecting Bun/npm workspace projects.
 *
 * Why: Some tools behave differently in workspaces vs standard projects.
 * For example, `bun --filter '*' typecheck` runs typecheck in all packages,
 * while `tsc --noEmit` only checks the current directory.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Check if the current project is a Bun/npm workspace.
 * Looks for `workspaces` field in package.json at cwd.
 *
 * @returns true if package.json has a non-empty workspaces array
 */
export async function isWorkspaceProject(): Promise<boolean> {
	const pkgPath = join(process.cwd(), "package.json");
	if (!existsSync(pkgPath)) return false;

	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
	} catch {
		return false;
	}
}
