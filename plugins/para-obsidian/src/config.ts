import fs from "node:fs";
import path from "node:path";

export interface FrontmatterRules {
	readonly required?: Record<string, FieldRule>;
}

export interface FieldRule {
	readonly type: "string" | "date" | "array" | "wikilink" | "enum";
	readonly enum?: ReadonlyArray<string>;
	readonly includes?: ReadonlyArray<string>;
	readonly defaultValue?: string | ReadonlyArray<string>;
	readonly description?: string;
	readonly optional?: boolean;
}

export interface ParaObsidianConfig {
	readonly vault: string;
	readonly templatesDir?: string;
	readonly indexPath?: string;
	readonly defaultSearchDirs?: ReadonlyArray<string>;
	readonly autoCommit?: boolean;
	readonly gitCommitMessageTemplate?: string;
	readonly suggestedTags?: ReadonlyArray<string>;
	readonly frontmatterRules?: Record<string, FrontmatterRules>;
}

function loadJsonIfExists<T>(filePath: string): Partial<T> | undefined {
	if (!fs.existsSync(filePath)) return undefined;
	try {
		const raw = fs.readFileSync(filePath, "utf8");
		return JSON.parse(raw) as Partial<T>;
	} catch (error) {
		throw new Error(
			`Failed to parse config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function resolveRcFromEnv(): string | undefined {
	const explicit = process.env.PARA_OBSIDIAN_CONFIG;
	return explicit && explicit.trim().length > 0 ? explicit : undefined;
}

function resolveUserRc(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
	return path.join(home, ".config", "para-obsidian", "config.json");
}

const PROJECT_RC = ".para-obsidianrc";

function resolveProjectRc(cwd: string): string | undefined {
	const candidate = path.join(cwd, PROJECT_RC);
	return fs.existsSync(candidate) ? candidate : undefined;
}

export interface LoadConfigOptions {
	readonly cwd?: string;
}

export function loadConfig(
	options: LoadConfigOptions = {},
): ParaObsidianConfig {
	const cwd = options.cwd ?? process.cwd();

	const envVault = process.env.PARA_VAULT;
	if (!envVault || envVault.trim().length === 0) {
		throw new Error("PARA_VAULT env is required to use para-obsidian.");
	}

	const envConfigPath = resolveRcFromEnv();
	const userRc = loadJsonIfExists<ParaObsidianConfig>(resolveUserRc()) ?? {};
	const projectRcPath = resolveProjectRc(cwd);
	const projectRc = projectRcPath
		? (loadJsonIfExists<ParaObsidianConfig>(projectRcPath) ?? {})
		: {};
	const explicitRc = envConfigPath
		? (loadJsonIfExists<ParaObsidianConfig>(envConfigPath) ?? {})
		: {};

	const merged: ParaObsidianConfig = {
		...projectRc,
		...userRc,
		...explicitRc,
		vault: envVault,
	};

	const vault = path.resolve(merged.vault);
	if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
		throw new Error(`PARA_VAULT does not point to a directory: ${vault}`);
	}

	const templatesDir =
		merged.templatesDir ?? path.join(vault, "06_Metadata", "Templates");

	return {
		...merged,
		vault,
		templatesDir,
	};
}
