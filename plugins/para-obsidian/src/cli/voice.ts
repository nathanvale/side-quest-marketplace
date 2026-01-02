/**
 * CLI command: para voice
 *
 * Transcribes Apple Voice Memos using whisper.cpp and appends them
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
import {
	createCorrelationId,
	getLogFile,
	initLogger,
	voiceLogger,
} from "../shared/logger";
import { applyDateSubstitutions, getTemplate } from "../templates/index";
import {
	checkFfmpeg,
	checkWhisperCli,
	formatLogEntry,
	isProcessed,
	loadVoiceState,
	markAsProcessed,
	saveVoiceState,
	scanVoiceMemos,
	transcribeVoiceMemo,
} from "../voice";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Get daily note path for a given date.
 *
 * Daily notes are stored at: 000 Timestamps/Daily Notes/YYYY-MM-DD.md
 */
function getDailyNotePath(vaultPath: string, date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const filename = `${year}-${month}-${day}.md`;

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
 * Scans Apple Voice Memos, transcribes new ones using whisper.cpp,
 * and appends formatted entries to daily notes.
 */
export async function handleVoice(ctx: CommandContext): Promise<CommandResult> {
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

	// Check dependencies first
	const depCid = createCorrelationId();
	voiceLogger.debug`voice:checkDeps cid=${depCid} sessionCid=${sessionCid}`;

	if (!isJson) {
		console.log(emphasize.info("Checking dependencies..."));
	}

	const hasWhisper = await checkWhisperCli();
	const hasFfmpeg = await checkFfmpeg();

	voiceLogger.debug`voice:checkDeps:result cid=${depCid} hasWhisper=${hasWhisper} hasFfmpeg=${hasFfmpeg}`;

	if (!hasWhisper) {
		voiceLogger.error`voice:error cid=${depCid} sessionCid=${sessionCid} error=${"whisper-cli not found"}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "whisper-cli not found",
						hint: "Install with: brew install whisper-cpp",
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("whisper-cli not found."));
			console.log("Install with: brew install whisper-cpp");
		}
		session.end({ error: "whisper-cli not found" });
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
	const modelPath = join(
		homedir(),
		".config",
		"para-obsidian",
		"models",
		"ggml-large-v3-turbo.bin",
	);

	// Check model exists
	if (!pathExistsSync(modelPath)) {
		voiceLogger.error`voice:error sessionCid=${sessionCid} error=${"Whisper model not found"} modelPath=${modelPath}`;
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: "Whisper model not found",
						hint: `Download model to: ${modelPath}`,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error("Whisper model not found."));
			console.log(`Download ggml-large-v3-turbo.bin to: ${modelPath}`);
		}
		session.end({ error: "Whisper model not found" });
		return { success: false, exitCode: 1 };
	}

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

	// Load state
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
		session.end({ success: true });
		return { success: true };
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
		session.end({ success: true });
		return { success: true };
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
			// Transcribe
			const transcribeStart = Date.now();
			const result = await transcribeVoiceMemo(memo.path, modelPath);
			const transcribeDurationMs = Date.now() - transcribeStart;

			voiceLogger.info`voice:transcribe:success cid=${memoCid} sessionCid=${sessionCid} filename=${memo.filename} textLength=${result.text.length} durationMs=${transcribeDurationMs}`;

			// Format log entry
			const logEntry = formatLogEntry(memo.timestamp, result.text);

			// Get daily note path
			const dailyNotePath = getDailyNotePath(config.vault, memo.timestamp);
			const dailyNoteRelative = `000 Timestamps/Daily Notes/${memo.timestamp.toISOString().split("T")[0]}.md`;

			// Auto-create daily note if it doesn't exist
			const wasCreated = ensureDailyNote(config, memo.timestamp, dailyNotePath);
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

			// Mark as processed
			newState = markAsProcessed(state, memo.filename, {
				processedAt: new Date().toISOString(),
				transcription: result.text.slice(0, 100),
				dailyNote: memo.timestamp.toISOString().split("T")[0] || "",
			});

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

	// Save state
	if (processed > 0) {
		saveVoiceState(stateFilePath, newState);
		voiceLogger.debug`voice:saveState sessionCid=${sessionCid} processedCount=${processed}`;
	}

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
