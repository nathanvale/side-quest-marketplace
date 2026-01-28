/**
 * Create-related CLI command handlers.
 *
 * Handlers for note creation from templates, with optional AI-powered extraction.
 *
 * @module cli/create
 */

import { parseKeyValuePairs } from "@sidequest/core/cli";
import { emphasize } from "@sidequest/core/terminal";
import { DEFAULT_AVAILABLE_MODELS, DEFAULT_MODEL } from "../config/defaults";
import type { ParaObsidianConfig } from "../config/index";
import { updateFrontmatterFile } from "../frontmatter/index";
import { autoCommitChanges, ensureGitGuard } from "../git/index";
import {
	extractMetadata,
	getWikilinkFieldsFromRules,
	validateModel,
} from "../llm/client";
import { createFromTemplate, replaceSections } from "../notes/create";
import type { CommandHandler } from "./types";
import {
	normalizeFlags,
	parseArgOverrides,
	parseAttachments,
	withAutoDiscoveredAttachments,
} from "./utils";

/**
 * Internal handler for AI-powered create from source.
 */
async function handleCreateFromSource(options: {
	config: ParaObsidianConfig;
	template: string;
	sourceFile?: string;
	sourceText?: string;
	model: string;
	preview: boolean;
	title?: string;
	dest?: string;
	flags: Record<string, string | boolean | (string | boolean)[] | undefined>;
	isJson: boolean;
}): Promise<void> {
	const {
		config,
		template,
		sourceFile,
		sourceText,
		model,
		preview,
		title,
		dest,
		flags,
		isJson,
	} = options;
	const argFlags = (flags as { arg?: string | boolean | (string | boolean)[] })
		.arg;
	const argOverrides = parseArgOverrides(argFlags);

	if (preview) {
		try {
			const extracted = await extractMetadata(config, {
				sourceFile,
				sourceContent: sourceText,
				template,
				model,
				extractContent: false,
				argOverrides,
			});

			if (isJson) {
				console.log(
					JSON.stringify(
						{
							metadata: extracted.args,
							title: extracted.title,
							model,
							preview: true,
						},
						null,
						2,
					),
				);
			} else {
				console.log(emphasize.info(`AI Suggestions (using ${model}):`));
				console.log(`  title: ${extracted.title}`);
				for (const [key, value] of Object.entries(extracted.args)) {
					if (value !== null) {
						console.log(`  ${key}: ${value}`);
					}
				}
				console.log("");
				const sourceHint = sourceFile
					? `--source "${sourceFile}"`
					: '--source-text "..."';
				console.log(
					emphasize.info(
						`To create: bun src/cli.ts create --template ${template} ${sourceHint}`,
					),
				);
				console.log(
					emphasize.info(
						'Override fields: --arg "priority=high" --arg "area=[[Work]]"',
					),
				);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Extraction failed";
			console.error(message);
			process.exit(1);
		}
		return;
	}

	try {
		const extracted = await extractMetadata(config, {
			sourceFile,
			sourceContent: sourceText,
			template,
			model,
			extractContent: true,
			argOverrides,
		});

		const resolvedTitle = title ?? extracted.title;

		const nonNullArgs: Record<string, string> = {};
		for (const [key, value] of Object.entries(extracted.args)) {
			if (value !== null) {
				nonNullArgs[key] = value;
			}
		}

		await ensureGitGuard(config);
		const result = createFromTemplate(config, {
			template,
			title: resolvedTitle,
			dest,
			args: nonNullArgs,
		});

		const toWikilink = (val: string | null): string | null => {
			if (!val || val === "null") return null;
			if (val.startsWith("[[") && val.endsWith("]]")) return val;
			return `[[${val}]]`;
		};

		const normalizeUrl = (val: string | null): string | null => {
			if (!val || val === "null" || val === "") return null;
			if (val.startsWith("http://") || val.startsWith("https://")) return val;
			return `https://${val}`;
		};

		const frontmatterCleanup: Record<string, unknown> = {};
		const rules = config.frontmatterRules?.[template];
		const wikilinkFields = getWikilinkFieldsFromRules(rules);
		const urlFields = ["contact_url", "url", "website", "source_url"];

		for (const field of wikilinkFields) {
			const extractedValue = Object.entries(extracted.args).find(([key]) =>
				key.toLowerCase().includes(field),
			)?.[1];
			frontmatterCleanup[field] = toWikilink(extractedValue ?? null);
		}

		for (const field of urlFields) {
			const extractedValue = Object.entries(extracted.args).find(
				([key]) => key.toLowerCase() === field.toLowerCase(),
			)?.[1];
			if (extractedValue) {
				frontmatterCleanup[field] = normalizeUrl(extractedValue);
			}
		}

		if (argOverrides && Object.keys(argOverrides).length > 0) {
			for (const [key, value] of Object.entries(argOverrides)) {
				if (wikilinkFields.includes(key.toLowerCase())) {
					frontmatterCleanup[key] = toWikilink(value);
				} else {
					frontmatterCleanup[key] = value;
				}
			}
		}

		if (Object.keys(frontmatterCleanup).length > 0) {
			updateFrontmatterFile(config, result.filePath, {
				set: frontmatterCleanup,
				dryRun: false,
			});
		}

		let injectionResult:
			| {
					injected: string[];
					skipped: Array<{ heading: string; reason: string }>;
			  }
			| undefined;
		if (extracted.content && Object.keys(extracted.content).length > 0) {
			injectionResult = replaceSections(
				config,
				result.filePath,
				extracted.content,
				{ preserveComments: true },
			);
		}

		const flagsWithoutUndefined = Object.fromEntries(
			Object.entries(flags).filter(([, value]) => value !== undefined),
		) as Record<string, string | boolean | (string | boolean)[]>;

		const attachments = withAutoDiscoveredAttachments(
			config,
			result.filePath,
			parseAttachments(normalizeFlags(flagsWithoutUndefined)),
		);
		if (config.autoCommit) {
			await autoCommitChanges(
				config,
				[result.filePath, ...attachments],
				`create ${result.filePath}`,
			);
		}

		if (isJson) {
			const output: Record<string, unknown> = {
				filePath: result.filePath,
				content: result.content,
				model,
			};
			if (injectionResult) {
				output.sectionsInjected = injectionResult.injected.length;
				output.sectionsSkipped = injectionResult.skipped;
				output.injectedHeadings = injectionResult.injected;
			}
			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log(emphasize.success(`Created ${result.filePath}`));
			if (injectionResult) {
				if (injectionResult.injected.length > 0) {
					console.log(
						emphasize.info(
							`Injected content into ${injectionResult.injected.length} section(s): ${injectionResult.injected.join(", ")}`,
						),
					);
				}
				if (injectionResult.skipped.length > 0) {
					console.log(
						emphasize.warn(
							`Skipped ${injectionResult.skipped.length} section(s):`,
						),
					);
					for (const skip of injectionResult.skipped) {
						console.log(`  - ${skip.heading}: ${skip.reason}`);
					}
				}
			}
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "AI extraction failed";
		console.error(message);
		process.exit(1);
	}
}

/**
 * Handle the `create` command.
 *
 * Creates notes from templates with optional AI-powered metadata extraction.
 */
export const handleCreate: CommandHandler = async (ctx) => {
	const { config, flags, isJson } = ctx;

	const template =
		typeof flags.template === "string" ? flags.template : undefined;
	const title = typeof flags.title === "string" ? flags.title : undefined;
	const dest = typeof flags.dest === "string" ? flags.dest : undefined;
	const contentJson =
		typeof flags.content === "string" ? flags.content : undefined;
	const sourceFile =
		typeof flags.source === "string" ? flags.source : undefined;
	const sourceText =
		typeof flags["source-text"] === "string" ? flags["source-text"] : undefined;
	const preview = flags.preview === true || flags.preview === "true";
	const modelFlag = typeof flags.model === "string" ? flags.model : undefined;

	// Validate required flags based on mode
	if (sourceFile || sourceText) {
		// AI-powered mode
		if (!template) {
			console.error(
				"create with --source or --source-text requires --template",
			);
			return { success: false, exitCode: 1 };
		}

		const availableModels = config.availableModels ?? [
			...DEFAULT_AVAILABLE_MODELS,
		];
		const defaultModel = config.defaultModel ?? DEFAULT_MODEL;
		const model = modelFlag ?? defaultModel;

		try {
			validateModel(model, availableModels);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Invalid model";
			console.error(message);
			return { success: false, exitCode: 1 };
		}

		await handleCreateFromSource({
			config,
			template,
			sourceFile,
			sourceText,
			model,
			preview,
			title,
			dest,
			flags: flags as Record<
				string,
				string | boolean | (string | boolean)[] | undefined
			>,
			isJson,
		});
		return { success: true };
	}

	// Blank template mode
	if (!template || !title) {
		console.error("create requires --template and --title");
		return { success: false, exitCode: 1 };
	}

	let contentSections: Record<string, string> | undefined;
	if (contentJson) {
		try {
			contentSections = JSON.parse(contentJson);
			if (typeof contentSections !== "object" || contentSections === null) {
				throw new Error("--content must be a JSON object");
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Invalid JSON";
			console.error(`Invalid --content JSON: ${msg}`);
			return { success: false, exitCode: 1 };
		}
	}

	const argValues: string[] = [];
	if (flags.arg !== undefined) {
		if (Array.isArray(flags.arg)) {
			argValues.push(
				...(flags.arg.filter((v) => typeof v === "string") as string[]),
			);
		} else if (typeof flags.arg === "string") {
			argValues.push(flags.arg);
		}
	}
	const argsForTemplate = parseKeyValuePairs(argValues);

	await ensureGitGuard(config);

	// Extract source_format for extraFrontmatter so applyTitlePrefix can add the emoji
	// This enables "📚🎬 Title" pattern for resources with source_format: "video"
	const extraFrontmatter: Record<string, unknown> = {};
	if (argsForTemplate.source_format) {
		extraFrontmatter.source_format = argsForTemplate.source_format;
	}

	const result = createFromTemplate(config, {
		template,
		title,
		dest,
		args: argsForTemplate,
		extraFrontmatter:
			Object.keys(extraFrontmatter).length > 0 ? extraFrontmatter : undefined,
	});

	let injectionResult:
		| {
				injected: string[];
				skipped: Array<{ heading: string; reason: string }>;
		  }
		| undefined;
	if (contentSections && Object.keys(contentSections).length > 0) {
		injectionResult = replaceSections(
			config,
			result.filePath,
			contentSections,
			{
				preserveComments: true,
			},
		);
	}

	const attachments = withAutoDiscoveredAttachments(
		config,
		result.filePath,
		parseAttachments(normalizeFlags(flags)),
	);
	if (config.autoCommit) {
		await autoCommitChanges(
			config,
			[result.filePath, ...attachments],
			`create ${result.filePath}`,
		);
	}

	if (isJson) {
		const output: Record<string, unknown> = {
			filePath: result.filePath,
			content: result.content,
		};
		if (injectionResult) {
			output.sectionsInjected = injectionResult.injected.length;
			output.sectionsSkipped = injectionResult.skipped;
			output.injectedHeadings = injectionResult.injected;
		}
		console.log(JSON.stringify(output, null, 2));
	} else {
		console.log(emphasize.success(`Created ${result.filePath}`));
		if (injectionResult) {
			if (injectionResult.injected.length > 0) {
				console.log(
					emphasize.info(
						`Injected content into ${injectionResult.injected.length} section(s): ${injectionResult.injected.join(", ")}`,
					),
				);
			}
			if (injectionResult.skipped.length > 0) {
				console.log(
					emphasize.warn(
						`Skipped ${injectionResult.skipped.length} section(s):`,
					),
				);
				for (const skip of injectionResult.skipped) {
					console.log(`  - ${skip.heading}: ${skip.reason}`);
				}
			}
		}
	}

	return { success: true };
};
