import { spawnAndCollect } from "../../../core/src/spawn/index.js";
import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

export interface SemanticHit {
	readonly file: string;
	readonly score: number;
	readonly line?: number;
	readonly snippet?: string;
}

export interface SemanticSearchOptions {
	readonly query: string;
	readonly dir?: string;
	readonly limit?: number;
}

export type SemanticRunner = (
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
) => Promise<ReadonlyArray<SemanticHit>>;

async function runKitSemantic(
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
): Promise<ReadonlyArray<SemanticHit>> {
	const dir = options.dir
		? resolveVaultPath(config.vault, options.dir)
		: undefined;
	const args = [
		"kit",
		"semantic",
		"--path",
		dir?.absolute ?? config.vault,
		"--query",
		options.query,
		"--limit",
		(options.limit ?? 10).toString(),
		"--json",
	];
	const { stdout, exitCode, stderr } = await spawnAndCollect(args, {
		env: { ...process.env },
	});
	if (exitCode !== 0) {
		throw new Error(
			stderr.trim().length > 0
				? `kit semantic failed: ${stderr.trim()}`
				: "kit semantic failed (is kit installed?)",
		);
	}
	try {
		const parsed = JSON.parse(stdout) as { results?: Array<SemanticHit> };
		return parsed.results ?? [];
	} catch (error) {
		throw new Error(
			`Failed to parse kit semantic output: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

export async function semanticSearch(
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
	runner: SemanticRunner = runKitSemantic,
): Promise<ReadonlyArray<SemanticHit>> {
	if (!options.query || options.query.trim().length === 0) {
		throw new Error("query is required for semantic search");
	}
	return runner(config, options);
}
