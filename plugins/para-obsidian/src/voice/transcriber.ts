/**
 * Voice memo transcription module.
 *
 * Wraps whisper.cpp CLI for audio transcription. Handles:
 * - Dependency checking (whisper-cli, ffmpeg)
 * - Audio format conversion (m4a → wav)
 * - Whisper.cpp invocation
 * - Temporary file cleanup
 *
 * @module voice/transcriber
 */

import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";

/**
 * Result of transcription operation.
 */
export interface TranscriptionResult {
	/** Transcribed text content */
	readonly text: string;
	/** Audio duration in seconds */
	readonly duration: number;
	/** Model filename used for transcription */
	readonly modelUsed: string;
}

/**
 * Check if whisper-cli is installed and available.
 *
 * @returns True if whisper-cli found in PATH
 */
export async function checkWhisperCli(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", "whisper-cli"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Check if ffmpeg is installed and available.
 *
 * @returns True if ffmpeg found in PATH
 */
export async function checkFfmpeg(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", "ffmpeg"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Convert m4a audio to wav format using ffmpeg.
 *
 * Whisper.cpp requires wav input. This converts the Apple Voice Memo
 * m4a format to wav using ffmpeg.
 *
 * @param m4aPath - Path to input .m4a file
 * @param wavPath - Path for output .wav file
 * @throws Error if conversion fails
 */
async function convertM4aToWav(
	m4aPath: string,
	wavPath: string,
): Promise<void> {
	const proc = Bun.spawn(
		[
			"ffmpeg",
			"-i",
			m4aPath,
			"-ar",
			"16000", // 16kHz sample rate (whisper.cpp requirement)
			"-ac",
			"1", // Mono
			"-c:a",
			"pcm_s16le", // 16-bit PCM
			wavPath,
			"-y", // Overwrite output file
		],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`ffmpeg conversion failed: ${stderr}`);
	}
}

/**
 * Run whisper-cli transcription.
 *
 * @param wavPath - Path to input .wav file
 * @param modelPath - Path to whisper.cpp model (.bin file)
 * @param outputPath - Path for output .txt file (without extension)
 * @throws Error if transcription fails
 */
async function runWhisperCli(
	wavPath: string,
	modelPath: string,
	outputPath: string,
): Promise<void> {
	const proc = Bun.spawn(
		[
			"whisper-cli",
			"-m",
			modelPath,
			"-f",
			wavPath,
			"-otxt", // Output as text file
			"-of",
			outputPath, // Output file path (without .txt extension)
		],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`whisper-cli failed: ${stderr}`);
	}
}

/**
 * Transcribe a voice memo using whisper.cpp.
 *
 * Process:
 * 1. Check dependencies (whisper-cli, ffmpeg)
 * 2. Convert m4a → wav
 * 3. Run whisper-cli transcription
 * 4. Read transcription text
 * 5. Clean up temp files
 *
 * @param audioPath - Path to .m4a voice memo file
 * @param modelPath - Path to whisper.cpp model (.bin file)
 * @returns Transcription result with text and metadata
 * @throws Error if dependencies missing or transcription fails
 */
export async function transcribeVoiceMemo(
	audioPath: string,
	modelPath: string,
): Promise<TranscriptionResult> {
	// Validate dependencies
	if (!(await checkWhisperCli())) {
		throw new Error(
			"whisper-cli not found. Install with: brew install whisper-cpp",
		);
	}

	if (!(await checkFfmpeg())) {
		throw new Error("ffmpeg not found. Install with: brew install ffmpeg");
	}

	// Validate input files
	if (!pathExistsSync(audioPath)) {
		throw new Error(`Input file does not exist: ${audioPath}`);
	}

	if (!pathExistsSync(modelPath)) {
		throw new Error(`Model file does not exist: ${modelPath}`);
	}

	// Create temp file paths
	const tempId = `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	const tempDir = tmpdir();
	const wavPath = join(tempDir, `${tempId}.wav`);
	const txtOutputBase = join(tempDir, tempId); // whisper-cli adds .txt
	const txtPath = `${txtOutputBase}.txt`;

	try {
		// Step 1: Convert m4a → wav
		await convertM4aToWav(audioPath, wavPath);

		// Step 2: Run whisper-cli
		await runWhisperCli(wavPath, modelPath, txtOutputBase);

		// Step 3: Read transcription
		const transcriptionFile = Bun.file(txtPath);
		const text = await transcriptionFile.text();

		// Extract model filename from path
		const modelUsed = modelPath.split("/").pop() || "unknown";

		return {
			text: text.trim(),
			duration: 0, // TODO: Could extract from ffmpeg output
			modelUsed,
		};
	} finally {
		// Cleanup temp files
		try {
			if (pathExistsSync(wavPath)) {
				unlinkSync(wavPath);
			}
			if (pathExistsSync(txtPath)) {
				unlinkSync(txtPath);
			}
		} catch {
			// Ignore cleanup errors
		}
	}
}
