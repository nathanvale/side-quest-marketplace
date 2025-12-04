import fs from "node:fs";
import path from "node:path";

export interface VaultPath {
	readonly absolute: string;
	readonly relative: string;
}

function isSubPath(parent: string, child: string): boolean {
	const rel = path.relative(parent, child);
	return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function resolveVaultPath(vault: string, inputPath = "."): VaultPath {
	const absolute = path.resolve(vault, inputPath);
	if (!isSubPath(vault, absolute) && path.resolve(vault) !== absolute) {
		throw new Error(`Path escapes vault: ${inputPath}`);
	}
	const relative = path.relative(vault, absolute);
	return { absolute, relative: relative || "." };
}

export function listDir(vault: string, inputPath = "."): Array<string> {
	const { absolute } = resolveVaultPath(vault, inputPath);
	if (!fs.existsSync(absolute)) {
		throw new Error(`Path does not exist: ${inputPath}`);
	}
	if (!fs.statSync(absolute).isDirectory()) {
		throw new Error(`Not a directory: ${inputPath}`);
	}
	return fs.readdirSync(absolute).sort();
}

export function readFile(vault: string, inputPath: string): string {
	const { absolute } = resolveVaultPath(vault, inputPath);
	if (!fs.existsSync(absolute)) {
		throw new Error(`Path does not exist: ${inputPath}`);
	}
	if (!fs.statSync(absolute).isFile()) {
		throw new Error(`Not a file: ${inputPath}`);
	}
	return fs.readFileSync(absolute, "utf8");
}
