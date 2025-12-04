import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { DEFAULT_TEMPLATE_VERSIONS } from "./defaults";

export interface TemplateInfo {
	readonly name: string;
	readonly path: string;
	readonly version: number;
	readonly content: string;
}

export function listTemplates(config: ParaObsidianConfig): TemplateInfo[] {
	const dir = config.templatesDir;
	if (!dir || !fs.existsSync(dir)) return [];

	const entries = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort();

	return entries.map((file) => {
		const name = file.replace(/\.md$/, "");
		const version =
			config.templateVersions?.[name] ?? DEFAULT_TEMPLATE_VERSIONS[name] ?? 1;
		const fullPath = path.join(dir, file);
		const content = fs.readFileSync(fullPath, "utf8");
		return { name, path: fullPath, version, content };
	});
}

export function getTemplate(
	config: ParaObsidianConfig,
	name: string,
): TemplateInfo | undefined {
	return listTemplates(config).find((t) => t.name === name);
}
