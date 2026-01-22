/**
 * Voice memo note creation module for para-obsidian.
 *
 * Creates individual note files from voice memo transcriptions.
 * Uses LLM to clean up transcription and generate summary.
 *
 * Directly imports para-obsidian implementations (no dependency injection).
 *
 * @module voice/note-creator
 */

import { join } from "node:path";
import {
	ensureDirSync,
	pathExistsSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { serializeFrontmatter } from "../frontmatter/parse.js";
import { callLLMWithMetadata } from "../inbox/core/llm/client.js";
import { createCorrelationId, voiceLogger } from "../shared/logger.js";

/**
 * Options for creating a voice memo note.
 */
export interface CreateVoiceMemoNoteOptions {
	timestamp: Date;
	transcription: string;
	vaultPath: string;
	inboxFolder?: string;
	source?: string;
	sessionCid?: string;
	isVttSource?: boolean;
}

/**
 * Options for LLM processing.
 */
export interface ProcessWithLLMOptions {
	sessionCid?: string;
	isVttSource?: boolean;
}

/**
 * Result of voice memo note creation.
 */
export interface VoiceMemoNoteResult {
	notePath: string;
	noteTitle: string;
	summary: string;
	llmResult: VoiceMemoLLMResult;
}

/**
 * Result of LLM processing.
 */
export interface VoiceMemoLLMResult {
	cleanedText: string;
	summary: string;
	success: boolean;
	error?: string;
	isFallback?: boolean;
	modelUsed?: string;
}

/**
 * Format time for use in filenames (no colons).
 * Format: "h-mmam/pm" (no space)
 */
export function formatFilenameTime(date: Date): string {
	const hours24 = date.getHours();
	let hours12 = hours24 % 12;
	if (hours12 === 0) hours12 = 12;
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const period = hours24 < 12 ? "am" : "pm";
	return `${hours12}-${minutes}${period}`;
}

/**
 * Format date as YYYY-MM-DD using local time.
 */
function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Generate note title from timestamp.
 * Format: "🎤 YYYY-MM-DD h-mmam/pm"
 */
export function generateNoteTitle(date: Date): string {
	const dateStr = formatLocalDate(date);
	const timeStr = formatFilenameTime(date);
	return `🎤 ${dateStr} ${timeStr}`;
}

/**
 * Chunk size target for splitting long transcripts (~15 minute segments).
 * Research suggests 15-minute chunks are optimal for meeting transcripts.
 * 15,000 chars ≈ 3,750 words ≈ 15 minutes of speech.
 */
const CHUNK_SIZE_CHARS = 15000;

/**
 * Threshold above which we use chunked processing.
 * Transcripts longer than this will be split into chunks.
 * 20,000 chars ≈ 5,000 words ≈ 20 minutes of speech.
 */
const CHUNK_THRESHOLD_CHARS = 20000;

/**
 * Build LLM prompt for voice memo punctuation and summarization.
 *
 * IMPORTANT: This adds punctuation only - nothing is removed or changed.
 * Uses DocsBot-style simple framing to prevent paraphrasing.
 */
function buildVoiceMemoPrompt(
	transcription: string,
	isVttSource = false,
): string {
	// VTT files have speaker labels in "Speaker: text" format that must be preserved
	const speakerInstructions = isVttSource
		? `5. CRITICAL: Preserve ALL speaker labels exactly as written (e.g., "Nathan Vale:", "June Xu:")
6. Add a BLANK LINE before each new speaker label to separate speaker turns
7. When the same speaker continues, their subsequent lines should NOT have a label`
		: `5. Keep speaker labels (e.g., "Sonny Hartley:") at the start of their sections`;

	return `Add punctuation and paragraph breaks to this transcript. DO NOT change any words.

YOUR TASK:
1. Add periods and capital letters where necessary
2. Add paragraph breaks to separate different topics or speakers
3. Remove only filler sounds (um, uh, uhm) and timestamp markers
4. Retain all original words and content without deletion
${speakerInstructions}

ABSOLUTELY DO NOT:
- Rephrase, paraphrase, or reword anything
- Convert direct speech to third person
- Add words that weren't spoken
- Remove any sentences or content
- Summarize or condense
${isVttSource ? "- Remove or modify speaker labels\n- Merge speakers into a single narrative" : ""}

After adding punctuation, write a brief 1-2 sentence summary.

TRANSCRIPT:
${transcription}

Respond with ONLY valid JSON:
{"cleanedText": "transcript with punctuation added", "summary": "1-2 sentence summary"}`;
}

/**
 * Build LLM prompt for adding punctuation to a chunk (no summary needed).
 * Uses simple framing to prevent paraphrasing.
 */
function buildChunkCleanupPrompt(
	chunk: string,
	chunkIndex: number,
	isVttSource = false,
): string {
	// VTT files have speaker labels in "Speaker: text" format that must be preserved
	const speakerInstructions = isVttSource
		? `5. CRITICAL: Preserve ALL speaker labels exactly as written (e.g., "Nathan Vale:", "June Xu:")
6. Add a BLANK LINE before each new speaker label to separate speaker turns
7. When the same speaker continues, their subsequent lines should NOT have a label`
		: `5. Keep speaker labels (e.g., "Sonny Hartley:") at the start of their sections`;

	return `Add punctuation and paragraph breaks to part ${chunkIndex + 1} of this transcript. DO NOT change any words.

YOUR TASK:
1. Add periods and capital letters where necessary
2. Add paragraph breaks to separate different topics or speakers
3. Remove only filler sounds (um, uh, uhm) and timestamp markers
4. Retain all original words and content without deletion
${speakerInstructions}

ABSOLUTELY DO NOT:
- Rephrase, paraphrase, or reword anything
- Convert direct speech to third person
- Add words that weren't spoken
- Remove any sentences or content
${isVttSource ? "- Remove or modify speaker labels\n- Merge speakers into a single narrative" : ""}

TRANSCRIPT CHUNK:
${chunk}

Respond with ONLY valid JSON:
{"cleanedText": "chunk with punctuation added"}`;
}

/**
 * Build LLM prompt for generating summary from first chunk.
 */
function buildSummaryPrompt(firstChunkCleaned: string): string {
	return `Based on the beginning of this meeting/voice memo transcript, generate a brief 1-2 sentence summary of what it's about.

TRANSCRIPT START:
${firstChunkCleaned}

Respond with ONLY valid JSON (no markdown code blocks):
{"summary": "1-2 sentence summary of the meeting/memo topic"}`;
}

/**
 * Split text into chunks at natural boundaries (paragraphs or lines).
 *
 * Tries paragraph boundaries first (double newlines), but falls back to
 * line boundaries (single newlines) for text like VTT extractions that
 * don't have paragraph breaks.
 */
function splitIntoChunks(text: string): string[] {
	const chunks: string[] = [];

	// Try paragraph-based splitting first
	const paragraphs = text.split(/\n\n+/);

	// If we only have one "paragraph" that's too big, split on single newlines instead
	if (paragraphs.length === 1 && text.length > CHUNK_SIZE_CHARS) {
		return splitOnLines(text);
	}

	let currentChunk = "";

	for (const para of paragraphs) {
		if (
			currentChunk.length + para.length > CHUNK_SIZE_CHARS &&
			currentChunk.length > 0
		) {
			chunks.push(currentChunk.trim());
			currentChunk = para;
		} else {
			currentChunk += (currentChunk ? "\n\n" : "") + para;
		}
	}

	if (currentChunk.trim()) {
		chunks.push(currentChunk.trim());
	}

	return chunks;
}

/**
 * Split text into chunks at line boundaries.
 * Used when text doesn't have paragraph breaks (e.g., VTT extractions).
 */
function splitOnLines(text: string): string[] {
	const chunks: string[] = [];
	const lines = text.split(/\n/);

	let currentChunk = "";

	for (const line of lines) {
		if (
			currentChunk.length + line.length > CHUNK_SIZE_CHARS &&
			currentChunk.length > 0
		) {
			chunks.push(currentChunk.trim());
			currentChunk = line;
		} else {
			currentChunk += (currentChunk ? "\n" : "") + line;
		}
	}

	if (currentChunk.trim()) {
		chunks.push(currentChunk.trim());
	}

	return chunks;
}

/**
 * Parse LLM response, handling JSON extraction and code fence removal.
 */
function parseVoiceMemoResponse(response: string): {
	cleanedText?: string;
	summary?: string;
} {
	let json = response.trim();
	if (json.startsWith("```json")) {
		json = json.slice(7);
	} else if (json.startsWith("```")) {
		json = json.slice(3);
	}
	if (json.endsWith("```")) {
		json = json.slice(0, -3);
	}
	json = json.trim();

	try {
		const parsed = JSON.parse(json);
		return {
			cleanedText:
				typeof parsed.cleanedText === "string"
					? parsed.cleanedText.trim()
					: undefined,
			summary:
				typeof parsed.summary === "string"
					? parsed.summary.trim().replace(/\n+/g, " ")
					: undefined,
		};
	} catch {
		return { cleanedText: json };
	}
}

/**
 * Basic cleanup fallback when LLM fails.
 * Removes common filler words and normalizes whitespace.
 */
export function basicCleanup(text: string): string {
	return text
		.trim()
		.replace(/\b(um|uh|like|you know|sort of|kind of)\b/gi, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

/**
 * Generate unique note path, handling collisions.
 */
function generateUniqueNotePath(basePath: string): string {
	if (!pathExistsSync(basePath)) {
		return basePath;
	}

	const ext = ".md";
	const baseWithoutExt = basePath.slice(0, -ext.length);
	let counter = 1;
	let candidatePath = `${baseWithoutExt} ${counter}${ext}`;

	while (pathExistsSync(candidatePath)) {
		counter++;
		candidatePath = `${baseWithoutExt} ${counter}${ext}`;
	}

	return candidatePath;
}

/**
 * Format VTT-extracted text for display.
 * Adds blank lines between speaker turns for readability.
 *
 * Input format (from extractTextFromVtt):
 *   Speaker A: text
 *   more text from A
 *   Speaker B: text
 *
 * Output format:
 *   Speaker A: text
 *   more text from A
 *
 *   Speaker B: text
 */
function formatVttForDisplay(text: string): string {
	const lines = text.split("\n");
	const result: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const prevLine = i > 0 ? lines[i - 1] : "";

		// Add blank line before speaker labels (lines containing "Name:")
		// but not at the start or if there's already a blank line
		if (i > 0 && line.match(/^[A-Z][^:]+:/) && prevLine?.trim() !== "") {
			result.push("");
		}
		result.push(line);
	}

	return result.join("\n");
}

/**
 * Format datetime for frontmatter in Obsidian's native ISO format.
 * Format: "YYYY-MM-DDTHH:mm"
 */
function formatDateTime(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Maximum concurrent LLM calls for parallel chunk processing */
const MAX_PARALLEL_CHUNKS = 4;

/**
 * Process a single chunk with LLM cleanup.
 */
async function processChunk(
	chunk: string,
	chunkIndex: number,
	sessionCid?: string,
	isVttSource = false,
): Promise<{ cleanedText: string; modelUsed?: string }> {
	const prompt = buildChunkCleanupPrompt(chunk, chunkIndex, isVttSource);
	const result = await callLLMWithMetadata(prompt, "haiku", undefined, {
		sessionCid,
	});
	const parsed = parseVoiceMemoResponse(result.response);

	if (!parsed.cleanedText || parsed.cleanedText.length < 10) {
		// Fallback to basic cleanup for this chunk
		return { cleanedText: basicCleanup(chunk), modelUsed: result.modelUsed };
	}

	return { cleanedText: parsed.cleanedText, modelUsed: result.modelUsed };
}

/**
 * Generate summary from cleaned first chunk.
 */
async function generateSummary(
	firstChunkCleaned: string,
	sessionCid?: string,
): Promise<string> {
	const prompt = buildSummaryPrompt(firstChunkCleaned);
	const result = await callLLMWithMetadata(prompt, "haiku", undefined, {
		sessionCid,
	});
	const parsed = parseVoiceMemoResponse(result.response);
	return parsed.summary ?? "";
}

/**
 * Process long transcript using chunking strategy with parallel processing.
 * Processes up to MAX_PARALLEL_CHUNKS concurrently for speed.
 */
async function processWithChunking(
	transcription: string,
	cid: string,
	sessionCid?: string,
	isVttSource = false,
): Promise<VoiceMemoLLMResult> {
	const chunks = splitIntoChunks(transcription);
	voiceLogger.info`voice:llm:chunking cid=${cid} sessionCid=${sessionCid ?? "none"} chunkCount=${chunks.length} parallel=${MAX_PARALLEL_CHUNKS} isVtt=${isVttSource}`;

	let modelUsed: string | undefined;
	let isFallback = false;

	// Process chunks in parallel batches of MAX_PARALLEL_CHUNKS
	const results: Array<{ index: number; text: string }> = [];

	for (
		let batchStart = 0;
		batchStart < chunks.length;
		batchStart += MAX_PARALLEL_CHUNKS
	) {
		const batchEnd = Math.min(batchStart + MAX_PARALLEL_CHUNKS, chunks.length);
		const batch = chunks.slice(batchStart, batchEnd);

		voiceLogger.debug`voice:llm:batch cid=${cid} sessionCid=${sessionCid ?? "none"} batchStart=${batchStart} batchSize=${batch.length}`;

		// Process batch in parallel
		const batchPromises = batch.map(async (chunk, batchIndex) => {
			const globalIndex = batchStart + batchIndex;
			if (!chunk) return { index: globalIndex, text: "" };

			try {
				const result = await processChunk(
					chunk,
					globalIndex,
					sessionCid,
					isVttSource,
				);
				if (result.modelUsed) modelUsed = result.modelUsed;
				return { index: globalIndex, text: result.cleanedText };
			} catch {
				voiceLogger.warn`voice:llm:chunkFailed cid=${cid} sessionCid=${sessionCid ?? "none"} chunkIndex=${globalIndex}`;
				isFallback = true;
				return { index: globalIndex, text: basicCleanup(chunk) };
			}
		});

		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);
	}

	// Sort by index to maintain order and extract cleaned text
	results.sort((a, b) => a.index - b.index);
	const cleanedChunks = results.map((r) => r.text).filter((t) => t.length > 0);

	// Generate summary from first cleaned chunk
	let summary = "";
	const firstChunk = cleanedChunks[0];
	if (firstChunk) {
		try {
			summary = await generateSummary(firstChunk, sessionCid);
		} catch {
			voiceLogger.warn`voice:llm:summaryFailed cid=${cid} sessionCid=${sessionCid ?? "none"}`;
		}
	}

	const cleanedText = cleanedChunks.join("\n\n");

	voiceLogger.info`voice:llm:chunkingComplete cid=${cid} sessionCid=${sessionCid ?? "none"} cleanedLength=${cleanedText.length} summaryLength=${summary.length} chunks=${chunks.length}`;

	return {
		cleanedText,
		summary,
		success: true,
		isFallback,
		modelUsed,
	};
}

/**
 * Process voice memo transcription with LLM cleanup and summarization.
 *
 * For long transcripts (>20000 chars), uses chunked processing:
 * 1. Split into ~15000 char chunks at paragraph boundaries
 * 2. Clean each chunk separately
 * 3. Generate summary from first chunk
 * 4. Combine all cleaned chunks
 *
 * @param transcription - Raw transcript text
 * @param options - Processing options including sessionCid and isVttSource
 */
export async function processWithLLM(
	transcription: string,
	options: ProcessWithLLMOptions = {},
): Promise<VoiceMemoLLMResult> {
	const { sessionCid, isVttSource = false } = options;
	const cid = createCorrelationId();

	if (transcription.trim().length < 20) {
		voiceLogger.debug`voice:llm:skip cid=${cid} sessionCid=${sessionCid ?? "none"} reason=too-short length=${transcription.length}`;
		return {
			cleanedText: transcription.trim(),
			summary: "",
			success: true,
		};
	}

	try {
		voiceLogger.info`voice:llm:start cid=${cid} sessionCid=${sessionCid ?? "none"} inputLength=${transcription.length} isVtt=${isVttSource}`;

		// Use chunked processing for long transcripts
		if (transcription.length > CHUNK_THRESHOLD_CHARS) {
			return await processWithChunking(
				transcription,
				cid,
				sessionCid,
				isVttSource,
			);
		}

		// Short transcripts: single LLM call
		const prompt = buildVoiceMemoPrompt(transcription, isVttSource);
		// Use Haiku for better instruction following on long transcripts
		const result = await callLLMWithMetadata(prompt, "haiku", undefined, {
			sessionCid,
		});
		const parsed = parseVoiceMemoResponse(result.response);

		if (!parsed.cleanedText || parsed.cleanedText.length < 10) {
			throw new Error("LLM returned empty or invalid cleaned text");
		}

		voiceLogger.info`voice:llm:success cid=${cid} sessionCid=${sessionCid ?? "none"} cleanedLength=${parsed.cleanedText.length} summaryLength=${parsed.summary?.length ?? 0} model=${result.modelUsed}`;

		return {
			cleanedText: parsed.cleanedText,
			summary: parsed.summary ?? "",
			success: true,
			isFallback: result.isFallback,
			modelUsed: result.modelUsed,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		voiceLogger.error`voice:llm:error cid=${cid} sessionCid=${sessionCid ?? "none"} error=${errorMsg}`;

		return {
			cleanedText: basicCleanup(transcription),
			summary: "",
			success: false,
			error: errorMsg,
		};
	}
}

/**
 * Create a voice memo note in the inbox folder.
 *
 * @param options - Note creation options
 * @returns Note creation result with path, title, and LLM result
 */
export async function createVoiceMemoNote(
	options: CreateVoiceMemoNoteOptions,
): Promise<VoiceMemoNoteResult> {
	const {
		timestamp,
		transcription,
		vaultPath,
		inboxFolder = "00 Inbox",
		source = "apple-voice-memos",
		sessionCid,
		isVttSource = false,
	} = options;

	const cid = createCorrelationId();
	voiceLogger.info`voice:createNote:start cid=${cid} sessionCid=${sessionCid ?? "none"} isVtt=${isVttSource}`;

	// VTT files already have punctuation and speaker labels - skip LLM
	// Only raw transcriptions (voice memos, plain text) need LLM cleanup
	let llmResult: VoiceMemoLLMResult;
	if (isVttSource) {
		voiceLogger.info`voice:createNote:skipLlm cid=${cid} sessionCid=${sessionCid ?? "none"} reason=vtt-already-formatted`;
		llmResult = {
			cleanedText: formatVttForDisplay(transcription),
			summary: "",
			success: true,
		};
	} else {
		llmResult = await processWithLLM(transcription, { sessionCid });
	}

	// Generate title and path
	const noteTitle = generateNoteTitle(timestamp);
	const inboxPath = join(vaultPath, inboxFolder);
	ensureDirSync(inboxPath);

	const basePath = join(inboxPath, `${noteTitle}.md`);
	const notePath = generateUniqueNotePath(basePath);
	const relativeNotePath = notePath.replace(`${vaultPath}/`, "");

	// Build frontmatter (summary goes here, not in body)
	// Note: recorded is omitted for VTT sources because file mtime is unreliable
	// (changes on download/copy). Users should provide --date when creating meetings from VTT.
	// areas/projects are empty arrays for users to optionally fill in before distilling
	const frontmatterData: Record<string, unknown> = {
		type: "transcription",
		created: formatDateTime(new Date()),
		source,
		template_version: 1,
		meeting: "",
		areas: [],
		projects: [],
	};

	// Only include recorded for non-VTT sources (voice memos have reliable timestamps)
	if (!isVttSource) {
		frontmatterData.recorded = formatDateTime(timestamp);
	}

	// Add summary to frontmatter if present
	if (llmResult.summary) {
		frontmatterData.summary = llmResult.summary;
	}

	// Build note content - dynamic title and full cleaned transcript
	const body = `# \`= this.file.name\`\n\n${llmResult.cleanedText}\n`;

	const noteContent = serializeFrontmatter(frontmatterData, body);

	// Write note
	writeTextFileSync(notePath, noteContent);

	voiceLogger.info`voice:createNote:success cid=${cid} sessionCid=${sessionCid ?? "none"} notePath=${relativeNotePath}`;

	return {
		notePath: relativeNotePath,
		noteTitle,
		summary: llmResult.summary,
		llmResult,
	};
}
