/**
 * Voice memo transcription module.
 *
 * Wraps parakeet-mlx CLI for audio transcription. Handles:
 * - Dependency checking (parakeet-mlx, ffmpeg)
 * - Parakeet invocation with text output
 * - Temporary file cleanup
 *
 * Uses NVIDIA Parakeet model via MLX for fast Apple Silicon transcription.
 *
 * @module voice/transcriber
 */

import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";

/**
 * Result of transcription operation.
 */
export interface TranscriptionResult {
	/** Transcribed text content */
	readonly text: string;
	/** Model used for transcription */
	readonly modelUsed: string;
}

/**
 * Check if parakeet-mlx is installed and available.
 *
 * @returns True if parakeet-mlx found in PATH
 */
export async function isParakeetMlxAvailable(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", "parakeet-mlx"], {
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
export async function isFfmpegAvailable(): Promise<boolean> {
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
 * Default Parakeet model to use.
 * This is the latest v3 model optimized for accuracy.
 */
const DEFAULT_MODEL = "mlx-community/parakeet-tdt-0.6b-v3";

/**
 * Run parakeet-mlx transcription.
 *
 * @param audioPath - Path to input audio file
 * @param outputDir - Directory for output .txt file
 * @param model - Hugging Face model to use (default: parakeet-tdt-0.6b-v3)
 * @returns Path to the output .txt file
 * @throws Error if transcription fails
 */
async function runParakeetMlx(
	audioPath: string,
	outputDir: string,
	model: string = DEFAULT_MODEL,
): Promise<string> {
	const proc = Bun.spawn(
		[
			"parakeet-mlx",
			audioPath,
			"--output-format",
			"txt",
			"--output-dir",
			outputDir,
			"--model",
			model,
		],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`parakeet-mlx failed: ${stderr}`);
	}

	// parakeet-mlx outputs {filename}.txt in the output directory
	const inputFilename = basename(audioPath);
	const outputFilename = inputFilename.replace(/\.[^.]+$/, ".txt");
	return join(outputDir, outputFilename);
}

/**
 * Transcribe a voice memo using parakeet-mlx.
 *
 * Process:
 * 1. Check dependencies (parakeet-mlx, ffmpeg)
 * 2. Run parakeet-mlx transcription
 * 3. Read transcription text
 * 4. Clean up temp files
 *
 * @param audioPath - Path to audio file (m4a, mp3, wav, etc.)
 * @returns Transcription result with text and metadata
 * @throws Error if dependencies missing or transcription fails
 */
export async function transcribeVoiceMemo(
	audioPath: string,
): Promise<TranscriptionResult> {
	// Validate dependencies
	if (!(await isParakeetMlxAvailable())) {
		throw new Error(
			"parakeet-mlx not found. Install with: uv tool install parakeet-mlx",
		);
	}

	if (!(await isFfmpegAvailable())) {
		throw new Error("ffmpeg not found. Install with: brew install ffmpeg");
	}

	// Validate input file
	if (!pathExistsSync(audioPath)) {
		throw new Error(`Input file does not exist: ${audioPath}`);
	}

	// Create temp directory for output
	const tempId = `parakeet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	const outputDir = join(tmpdir(), tempId);

	// Create output directory
	await Bun.spawn(["mkdir", "-p", outputDir], {
		stdout: "pipe",
		stderr: "pipe",
	}).exited;

	let txtPath: string | null = null;

	try {
		// Run parakeet-mlx transcription
		txtPath = await runParakeetMlx(audioPath, outputDir);

		// Read transcription
		const transcriptionFile = Bun.file(txtPath);
		const text = await transcriptionFile.text();

		return {
			text: text.trim(),
			modelUsed: DEFAULT_MODEL,
		};
	} finally {
		// Cleanup temp directory
		try {
			if (pathExistsSync(outputDir)) {
				await Bun.spawn(["rm", "-rf", outputDir], {
					stdout: "pipe",
					stderr: "pipe",
				}).exited;
			}
		} catch {
			// Ignore cleanup errors
		}
	}
}

// Legacy exports for backwards compatibility during transition
// These will be removed in a future version

/**
 * @deprecated Use isParakeetMlxAvailable instead. Will be removed in next major version.
 */
export { isParakeetMlxAvailable as checkWhisperCli };

/**
 * @deprecated Use isParakeetMlxAvailable instead.
 */
export { isParakeetMlxAvailable as checkParakeetMlx };

/**
 * @deprecated Use isFfmpegAvailable instead.
 */
export { isFfmpegAvailable as checkFfmpeg };
