import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

export interface DeleteOptions {
	readonly file: string;
	readonly confirm: boolean;
	readonly dryRun?: boolean;
}

export function deleteFile(
	config: ParaObsidianConfig,
	options: DeleteOptions,
): { deleted: boolean; relative: string } {
	if (!options.confirm) {
		throw new Error("delete requires --confirm");
	}
	const target = resolveVaultPath(config.vault, options.file);
	if (!fs.existsSync(target.absolute)) {
		throw new Error(`File not found: ${options.file}`);
	}
	if (!options.dryRun) {
		fs.rmSync(target.absolute, { recursive: true, force: true });
		// Clean up empty directories up to vault
		let dir = path.dirname(target.absolute);
		while (dir.startsWith(config.vault) && dir !== config.vault) {
			if (fs.readdirSync(dir).length === 0) {
				fs.rmdirSync(dir);
				dir = path.dirname(dir);
			} else {
				break;
			}
		}
	}
	return { deleted: !options.dryRun, relative: target.relative };
}
