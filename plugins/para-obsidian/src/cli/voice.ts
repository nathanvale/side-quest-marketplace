/**
 * CLI command: para voice
 *
 * Transcribes Apple Voice Memos using parakeet-mlx and appends them
 * as log entries to daily notes.
 *
 * @module cli/voice
 */

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	ensureDirSync,
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { emphasize } from "@sidequest/core/terminal";
import { createSpinner } from "nanospinner";
import type { ParaObsidianConfig } from "../config/index";
import { insertIntoNote } from "../notes/insert";
import { withFileLock } from "../shared/file-lock";
import {
	createCorrelationId,
	getLogFile,
	initLogger,
	voiceLogger,
} from "../shared/logger";
import { applyDateSubstitutions, getTemplate } from "../templates/index";
import {
	createVoiceMemoNote,
	extractTextFromVtt,
	formatWikilinkLogEntry,
	isFfmpegAvailable,
	isParakeetMlxAvailable,
	isProcessed,
	isVttFile,
	loadVoiceState,
	markAsProcessed,
	markAsSkipped,
	saveVoiceState,
	scanVoiceMemos,
	transcribeVoiceMemo,
} from "../voice";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Format a date as YYYY-MM-DD using local time (not UTC).
 *
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Get daily note path for a given date.
 *
 * Daily notes are stored at: 000 Timestamps/Daily Notes/YYYY-MM-DD.md
 */
function getDailyNotePath(vaultPath: string, date: Date): string {
	const filename = `${formatLocalDate(date)}.md`;
	return join(vaultPath, "000 Timestamps", "Daily Notes", filename);
}

/**
 * Create a minimal daily note with just frontmatter and Log section.
 *
 * Used as fallback when daily template doesn't exist.
 */
function createMinimalDailyNote(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const isoDate = `${year}-${month}-${day}`;

	// Get ISO week number
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
	const week1 = new Date(d.getFullYear(), 0, 4);
	const weekNum = Math.ceil(
		((d.getTime() - week1.getTime()) / 86400000 + week1.getDay() + 1) / 7,
	);
	const weekStr = `${d.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`;

	// Format day name
	const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
	const monthName = date.toLocaleDateString("en-US", { month: "long" });
	const dayNum = date.getDate();
	const titleDate = `${dayName}, ${monthName} ${dayNum}, ${year}`;

	return `---
title: "${titleDate}"
created: ${isoDate}
type: daily
week: ${weekStr}
template_version: 4
---

# ${titleDate}

---

## Log

<!-- Voice memo entries go here -->
`;
}

/**
 * Create a daily note for a specific date.
 *
 * Tries to use the daily template if available, otherwise falls back
 * to a minimal daily note with just frontmatter and Log section.
 *
 * @param config - Para-obsidian configuration
 * @param date - Date to create the daily note for
 * @param dailyNotePath - Absolute path where the daily note should be created
 * @returns true if note was created, false if it already exists
 */
function ensureDailyNote(
	config: ParaObsidianConfig,
	date: Date,
	dailyNotePath: string,
): boolean {
	// Already exists, nothing to do
	if (pathExistsSync(dailyNotePath)) {
		return false;
	}

	// Ensure directory exists
	ensureDirSync(dirname(dailyNotePath));

	// Try to get daily template
	const template = getTemplate(config, "daily");

	let content: string;
	if (template) {
		// Use template with date substitutions for the specific date
		content = applyDateSubstitutions(template.content, date);
	} else {
		// Fall back to minimal daily note
		content = createMinimalDailyNote(date);
	}

	// Write the note
	writeTextFileSync(dailyNotePath, content);

	return true;
}

/**
 * Ensure the Log section exists in a daily note.
 *
 * If the note doesn't have a ## Log heading, appends one to the bottom.
 * This handles older daily notes created from templates without a Log section.
 *
 * @param dailyNotePath - Absolute path to the daily note
 * @returns true if Log section was added, false if it already existed
 */
function ensureLogSection(dailyNotePath: string): boolean {
	const content = readTextFileSync(dailyNotePath);

	// Check if Log heading already exists (## Log)
	if (/^## Log\s*$/m.test(content)) {
		return false;
	}

	// Append Log section to the end of the file
	const logSection = `\n---\n\n## Log\n\n<!-- Voice memo entries go here -->\n`;
	writeTextFileSync(dailyNotePath, content.trimEnd() + logSection);

	return true;
}

/**
 * Handle the 'voice' command.
 *
 * Scans Apple Voice Memos, transcribes new ones using parakeet-mlx,
 * and appends formatted entries to daily notes.
 */
export async function handleVoice(ctx: CommandContext): Promise<CommandResult> {
	const { subcommand } = ctx;

	// Route to subcommand
	if (subcommand === "convert") {
		return await handleVoiceConvert(ctx);
	}

	// Default: existing voice transcription
	return await handleVoiceTranscribe(ctx);
}

/**
 * Handle the main 'voice' command (transcription).
 */
async function handleVoiceTranscribe(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, isJson, flags } = ctx;

	// Parse flags from ctx.flags
	const dryRun = flags["dry-run"] === true;
	const all = flags.all === true;

	// Parse since date if provided
	let since: Date | undefined;
	if (typeof flags.since === "string") {
		const parsedDate = new Date(flags.since);
		if (!Number.isNaN(parsedDate.getTime())) {
			since = parsedDate;
		}
	}

	// Initialize logger
	await initLogger();

	// Start session with correlation tracking
	const session = startSession("para voice", { silent: isJson });
	const sessionCid = session.sessionCid;

	voiceLogger.info`voice:start sessionCid=${sessionCid} dryRun=${dryRun} all=${all} since=${since?.toISOString() ?? "none"}`;

	// Show log file location
	if (!isJson) {
		console.log(emphasize.info(`Logs: ${getLogFile()}`));
	}

	// Validate vault configuration
	const vaultCid = createCorrelationId();
	if (!config.vault || config.vault.trim() === "") {
		voiceLogger.error`voice:validateVault:missing cid=${vaultCid} sessionCid=${sessionCid}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Vault path not configured",
						hint: "Set PARA_VAULT environment variable",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("Vault path not configured."));
			console.log("Set PARA_VAULT environment variable.");
		}
		session.end({ error: "Vault path not configured" });
		return { success: false, exitCode: 1 };
	}

	if (!pathExistsSync(config.vault)) {
		voiceLogger.error`voice:validateVault:notFound cid=${vaultCid} sessionCid=${sessionCid} vault=${config.vault}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Vault path does not exist",
						path: config.vault,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("Vault path does not exist."));
			console.log(`Path: ${config.vault}`);
		}
		session.end({ error: "Vault path does not exist" });
		return { success: false, exitCode: 1 };
	}

	voiceLogger.debug`voice:validateVault:success cid=${vaultCid} sessionCid=${sessionCid} vault=${config.vault}`;

	// Check dependencies first
	const depCid = createCorrelationId();
	voiceLogger.debug`voice:checkDeps cid=${depCid} sessionCid=${sessionCid}`;

	if (!isJson) {
		console.log(emphasize.info("Checking dependencies..."));
	}

	const hasParakeet = await isParakeetMlxAvailable();
	const hasFfmpeg = await isFfmpegAvailable();

	voiceLogger.debug`voice:checkDeps:result cid=${depCid} hasParakeet=${hasParakeet} hasFfmpeg=${hasFfmpeg}`;

	if (!hasParakeet) {
		voiceLogger.error`voice:error cid=${depCid} sessionCid=${sessionCid} error=${"parakeet-mlx not found"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "parakeet-mlx not found",
						hint: "Install with: uv tool install parakeet-mlx",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("parakeet-mlx not found."));
			console.log("Install with: uv tool install parakeet-mlx");
		}
		session.end({ error: "parakeet-mlx not found" });
		return { success: false, exitCode: 1 };
	}

	if (!hasFfmpeg) {
		voiceLogger.error`voice:error cid=${depCid} sessionCid=${sessionCid} error=${"ffmpeg not found"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "ffmpeg not found",
						hint: "Install with: brew install ffmpeg",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("ffmpeg not found."));
			console.log("Install with: brew install ffmpeg");
		}
		session.end({ error: "ffmpeg not found" });
		return { success: false, exitCode: 1 };
	}

	// Paths
	const recordingsDir = join(
		homedir(),
		"Library",
		"Group Containers",
		"group.com.apple.VoiceMemos.shared",
		"Recordings",
	);
	const stateFilePath = join(
		homedir(),
		".config",
		"para-obsidian",
		"voice-state.json",
	);

	// Scan voice memos
	const scanCid = createCorrelationId();
	voiceLogger.debug`voice:scan cid=${scanCid} sessionCid=${sessionCid} recordingsDir=${recordingsDir}`;

	if (!isJson) {
		console.log(emphasize.info("Scanning voice memos..."));
	}

	const memos = scanVoiceMemos(recordingsDir, {
		since,
	});

	voiceLogger.info`voice:scan:result cid=${scanCid} sessionCid=${sessionCid} memosFound=${memos.length}`;

	if (memos.length === 0) {
		voiceLogger.info`voice:complete sessionCid=${sessionCid} processed=${0} message=${"No voice memos found"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						processed: 0,
						message: "No voice memos found",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.warn("No voice memos found."));
		}
		session.end({ success: true });
		return { success: true };
	}

	// Wrap critical section in file lock to prevent concurrent state modifications
	const { processed, skipped, memosToProcess } = await withFileLock(
		stateFilePath,
		async () => {
			// Load state (inside lock)
			const state = loadVoiceState(stateFilePath);

			// Filter to unprocessed memos (unless --all flag)
			const memosToProcess = all
				? memos
				: memos.filter((m) => !isProcessed(state, m.filename));

			voiceLogger.debug`voice:filter sessionCid=${sessionCid} totalMemos=${memos.length} toProcess=${memosToProcess.length} all=${all}`;

			if (memosToProcess.length === 0) {
				voiceLogger.info`voice:complete sessionCid=${sessionCid} processed=${0} total=${memos.length} message=${"All memos already processed"}`;
				if (isJson) {
					console.log(
						JSON.stringify(
							{
								success: true,
								processed: 0,
								total: memos.length,
								message: "All memos already processed",
								hint: "Use --all to re-process",
								sessionCid,
							},
							null,
							2,
						),
					);
				} else {
					console.log(emphasize.info("All memos already processed."));
					console.log(`Total: ${memos.length} memos`);
					console.log("Use --all to re-process all memos.");
				}
				return { processed: 0, skipped: 0, memosToProcess };
			}

			// Show summary
			if (!isJson) {
				console.log(`Found ${memosToProcess.length} memo(s) to process`);
				console.log("");
			}

			if (dryRun) {
				voiceLogger.info`voice:dryRun sessionCid=${sessionCid} memoCount=${memosToProcess.length}`;
				if (isJson) {
					console.log(
						JSON.stringify(
							{
								dryRun: true,
								memos: memosToProcess.map((m) => ({
									filename: m.filename,
									timestamp: m.timestamp.toISOString(),
								})),
								sessionCid,
							},
							null,
							2,
						),
					);
				} else {
					console.log(emphasize.info("Dry run - would process:"));
					for (const memo of memosToProcess) {
						console.log(`  - ${memo.filename}`);
					}
				}
				return { processed: 0, skipped: 0, memosToProcess };
			}

			// Process each memo
			let processed = 0;
			let skipped = 0;
			let newState = state;

			for (const memo of memosToProcess) {
				const memoCid = createCorrelationId();
				voiceLogger.debug`voice:process cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename}`;

				const spinner = isJson
					? null
					: createSpinner(`Processing ${memo.filename}...`).start();

				try {
					const dailyNotePath = getDailyNotePath(config.vault, memo.timestamp);
					const localDateStr = formatLocalDate(memo.timestamp);
					const dailyNoteRelative = `000 Timestamps/Daily Notes/${localDateStr}.md`;

					// Transcribe
					const transcribeStart = Date.now();
					const result = await transcribeVoiceMemo(memo.path);
					const transcribeDurationMs = Date.now() - transcribeStart;

					voiceLogger.info`voice:transcribe:success cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename} textLength=${result.text.length} durationMs=${transcribeDurationMs}`;

					// Check for empty transcription (parakeet-mlx returns empty for unrecognizable audio)
					if (result.text.trim().length === 0) {
						const skipReason = "empty transcription";
						voiceLogger.warn`voice:transcribe:empty cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename} reason=${skipReason}`;

						// Mark as skipped so we don't retry on next run
						newState = markAsSkipped(newState, memo.filename, skipReason);

						// Save state incrementally
						try {
							saveVoiceState(stateFilePath, newState);
							voiceLogger.debug`voice:saveState:skipped cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename}`;
						} catch (saveError) {
							const saveErr = saveError as Error;
							voiceLogger.error`voice:saveState:failed cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename} error=${saveErr.message}`;
						}

						spinner?.warn({
							text: `Skipped ${memo.filename}: empty transcription`,
						});
						skipped++;
						continue;
					}

					// Create voice memo note in inbox
					const noteResult = await createVoiceMemoNote({
						timestamp: memo.timestamp,
						transcription: result.text,
						vaultPath: config.vault,
						sessionCid,
					});

					// Add wikilink to daily log (instead of full text)
					const logEntry = formatWikilinkLogEntry(
						memo.timestamp,
						noteResult.noteTitle,
					);

					// Auto-create daily note if it doesn't exist
					const wasCreated = ensureDailyNote(
						config,
						memo.timestamp,
						dailyNotePath,
					);
					if (wasCreated) {
						voiceLogger.info`voice:createDailyNote cid=${memoCid} sessionCid=${sessionCid} dailyNote=${dailyNoteRelative}`;
						spinner?.update({
							text: `Created daily note for ${dailyNoteRelative}...`,
						});
					}

					// Ensure Log section exists (for older daily notes without it)
					const logSectionAdded = ensureLogSection(dailyNotePath);
					if (logSectionAdded) {
						voiceLogger.info`voice:addLogSection cid=${memoCid} sessionCid=${sessionCid} dailyNote=${dailyNoteRelative}`;
					}

					// Insert into note
					insertIntoNote(config, {
						file: dailyNotePath,
						heading: "Log",
						content: logEntry,
						mode: "append",
					});

					voiceLogger.debug`voice:insert cid=${memoCid} sessionCid=${sessionCid} dailyNote=${dailyNoteRelative}`;

					// Mark as processed (accumulate into newState)
					newState = markAsProcessed(newState, memo.filename, {
						processedAt: new Date().toISOString(),
						transcription: result.text.slice(0, 100),
						dailyNote: localDateStr,
						notePath: noteResult.notePath,
					});

					// Save state incrementally after each successful processing
					// Wrapped in try/catch - if save fails, state is still in memory for duplicate detection
					try {
						saveVoiceState(stateFilePath, newState);
						voiceLogger.debug`voice:saveState:incremental cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename}`;
					} catch (saveError) {
						const saveErr = saveError as Error;
						voiceLogger.error`voice:saveState:failed cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename} error=${saveErr.message}`;
						// Continue processing - in-memory state still prevents duplicates within this session
					}

					spinner?.success({
						text: `Processed ${memo.filename}`,
					});
					processed++;

					voiceLogger.info`voice:process:success cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename}`;
				} catch (error) {
					const err = error as Error;
					voiceLogger.error`voice:process:error cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename} error=${err.message}`;
					spinner?.error({
						text: `Failed to process ${memo.filename}: ${err.message}`,
					});
					skipped++;
				}
			}

			return { processed, skipped, memosToProcess };
		},
	);

	// Summary
	voiceLogger.info`voice:complete sessionCid=${sessionCid} processed=${processed} skipped=${skipped} total=${memosToProcess.length}`;

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: true,
					processed,
					skipped,
					total: memosToProcess.length,
					sessionCid,
				},
				null,
				2,
			),
		);
	} else {
		console.log("");
		console.log(emphasize.success(`Processed ${processed} memo(s)`));
		if (skipped > 0) {
			console.log(emphasize.warn(`Skipped ${skipped} memo(s)`));
		}
	}

	session.end({ success: true });
	return { success: true };
}

/**
 * Handle the 'voice convert' subcommand.
 *
 * Converts a transcript into a voice memo note with LLM cleanup and summary.
 * Accepts either a file path or inline text via --text flag.
 *
 * Usage:
 *   para voice convert <path>           # Read from file
 *   para voice convert --text "..."     # Use inline text
 */
async function handleVoiceConvert(ctx: CommandContext): Promise<CommandResult> {
	const { config, positional, flags, isJson } = ctx;

	// Initialize logger
	await initLogger();

	// Start session with correlation tracking
	const session = startSession("para voice convert", { silent: isJson });
	const sessionCid = session.sessionCid;

	voiceLogger.info`voice:convert:start sessionCid=${sessionCid}`;

	// Show log file location
	if (!isJson) {
		console.log(emphasize.info(`Logs: ${getLogFile()}`));
	}

	// Validate vault configuration
	if (!config.vault || config.vault.trim() === "") {
		voiceLogger.error`voice:convert:error sessionCid=${sessionCid} error=${"Vault path not configured"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Vault path not configured",
						hint: "Set PARA_VAULT environment variable",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("Vault path not configured."));
			console.log("Set PARA_VAULT environment variable.");
		}
		session.end({ error: "Vault path not configured" });
		return { success: false, exitCode: 1 };
	}

	if (!pathExistsSync(config.vault)) {
		voiceLogger.error`voice:convert:error sessionCid=${sessionCid} error=${"Vault path does not exist"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Vault path does not exist",
						path: config.vault,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("Vault path does not exist."));
			console.log(`Path: ${config.vault}`);
		}
		session.end({ error: "Vault path does not exist" });
		return { success: false, exitCode: 1 };
	}

	// Get transcript from --text flag or file path
	const inlineText = flags.text as string | undefined;
	const filePath = positional[0];

	// Must have one or the other
	if (!inlineText && !filePath) {
		voiceLogger.error`voice:convert:error sessionCid=${sessionCid} error=${"Missing input"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Missing input",
						usage:
							"para voice convert <path> or para voice convert --text '...'",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("Missing input."));
			console.log("Usage: para voice convert <path>");
			console.log("   or: para voice convert --text '...'");
		}
		session.end({ error: "Missing input" });
		return { success: false, exitCode: 1 };
	}

	// Cannot have both
	if (inlineText && filePath) {
		voiceLogger.error`voice:convert:error sessionCid=${sessionCid} error=${"Cannot use both file path and --text"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Cannot use both file path and --text flag",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(
				emphasize.error("Cannot use both file path and --text flag."),
			);
		}
		session.end({ error: "Cannot use both file path and --text" });
		return { success: false, exitCode: 1 };
	}

	// Determine source type for frontmatter
	const isVtt = filePath ? isVttFile(filePath) : false;
	const source = inlineText
		? "inline-text"
		: isVtt
			? "vtt-file"
			: "transcript-file";

	try {
		let transcription: string;
		let fileTimestamp: Date = new Date(); // Default to current time for inline text

		if (inlineText) {
			// Use inline text directly
			transcription = inlineText;
			voiceLogger.debug`voice:convert:source sessionCid=${sessionCid} source=${"inline-text"} length=${transcription.length}`;
		} else {
			// Read from file (filePath is guaranteed to be defined here due to earlier check)
			const inputFile = filePath as string;
			if (!pathExistsSync(inputFile)) {
				voiceLogger.error`voice:convert:error sessionCid=${sessionCid} error=${"File not found"} path=${inputFile}`;
				if (isJson) {
					console.log(
						JSON.stringify(
							{
								success: false,
								error: "File not found",
								path: inputFile,
								sessionCid,
							},
							null,
							2,
						),
					);
				} else {
					console.log(emphasize.error(`File not found: ${inputFile}`));
				}
				session.end({ error: "File not found" });
				return { success: false, exitCode: 1 };
			}

			const bunFile = Bun.file(inputFile);
			const fileContent = await bunFile.text();

			// Get file modification time for the recorded timestamp
			const fileStat = await Bun.file(inputFile).stat();
			fileTimestamp = fileStat?.mtime ? new Date(fileStat.mtime) : new Date();

			// Parse VTT files to extract just the text
			if (isVtt) {
				transcription = extractTextFromVtt(fileContent);
				voiceLogger.debug`voice:convert:source sessionCid=${sessionCid} source=${"vtt-file"} path=${inputFile} rawLength=${fileContent.length} extractedLength=${transcription.length}`;
			} else {
				transcription = fileContent;
				voiceLogger.debug`voice:convert:source sessionCid=${sessionCid} source=${"file"} path=${inputFile} length=${transcription.length}`;
			}
		}

		if (transcription.trim().length === 0) {
			voiceLogger.warn`voice:convert:error sessionCid=${sessionCid} error=${"File is empty"}`;
			if (isJson) {
				console.log(
					JSON.stringify(
						{
							success: false,
							error: "File is empty",
							path: filePath,
							sessionCid,
						},
						null,
						2,
					),
				);
			} else {
				console.log(emphasize.error("File is empty."));
			}
			session.end({ error: "File is empty" });
			return { success: false, exitCode: 1 };
		}

		voiceLogger.info`voice:convert:process sessionCid=${sessionCid} inputLength=${transcription.length}`;

		// Create voice memo note (no daily log entry)
		// Use file modification time for recorded timestamp (for files), current time for inline text
		const noteResult = await createVoiceMemoNote({
			timestamp: fileTimestamp,
			transcription,
			vaultPath: config.vault,
			source,
			sessionCid,
			isVttSource: isVtt,
		});

		voiceLogger.info`voice:convert:success sessionCid=${sessionCid} notePath=${noteResult.notePath}`;

		// Output result
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						notePath: noteResult.notePath,
						noteTitle: noteResult.noteTitle,
						summary: noteResult.summary,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.success(`Created: ${noteResult.notePath}`));
			if (noteResult.summary) {
				console.log(`Summary: ${noteResult.summary}`);
			}
		}

		session.end({ success: true });
		return { success: true };
	} catch (error) {
		const err = error as Error;
		voiceLogger.error`voice:convert:error sessionCid=${sessionCid} error=${err.message}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: err.message,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error(`Error: ${err.message}`));
		}
		session.end({ error: err.message });
		return { success: false, exitCode: 1 };
	}
}
