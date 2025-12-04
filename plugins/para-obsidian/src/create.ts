import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";
import { getTemplate } from "./templates";

export interface CreateOptions {
	readonly template: string;
	readonly title: string;
	readonly dest?: string;
	readonly args?: Record<string, string>;
}

function titleToFilename(title: string): string {
	const cleaned = title
		.trim()
		.replace(/[/\\:*?"<>|]/g, "")
		.replace(/'/g, "")
		.split(" ")
		.filter(Boolean)
		.map((w, i) => {
			if (i === 0) return w[0]?.toUpperCase() + w.slice(1);
			return w[0]?.toUpperCase() + w.slice(1);
		})
		.join(" ");
	return `${cleaned}.md`;
}

export function applyArgsToTemplate(
	content: string,
	args: Record<string, string>,
): string {
	let output = content;
	for (const [key, value] of Object.entries(args)) {
		const needle = `<% tp.system.prompt("${key}") %>`;
		output = output.replaceAll(needle, value);
	}
	return output;
}

export function createFromTemplate(
	config: ParaObsidianConfig,
	options: CreateOptions,
): { filePath: string; content: string } {
	const tpl = getTemplate(config, options.template);
	if (!tpl) throw new Error(`Template not found: ${options.template}`);

	const destDir = options.dest ?? "";
	const filename = titleToFilename(options.title);
	const target = resolveVaultPath(config.vault, path.join(destDir, filename));

	if (fs.existsSync(target.absolute)) {
		throw new Error(`File already exists: ${target.relative}`);
	}

	const filled = options.args
		? applyArgsToTemplate(tpl.content, options.args)
		: tpl.content;

	const { attributes, body } = parseFrontmatter(filled);

	if (
		attributes.template_version === undefined &&
		config.templateVersions?.[options.template] !== undefined
	) {
		attributes.template_version = config.templateVersions[options.template];
	}
	// Inject title if not provided by args/template substitution.
	if (!attributes.title) {
		attributes.title = options.title;
	}
	const content = serializeFrontmatter(attributes, body);

	fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
	fs.writeFileSync(target.absolute, content, "utf8");

	return { filePath: target.relative, content };
}
