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
 * @module voice-memo/transcriber
 */

import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { pathExistsSync } from "@side-quest/core/fs";

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
 * Validate audio file path for security.
 *
 * **Defense in depth**: While the scanner validates filenames, the transcriber
 * independently validates paths to prevent command injection if called directly.
 *
 * Checks:
 * - Path must be absolute (prevents relative path attacks)
 * - Path must not contain shell metacharacters (prevents injection)
 * - Path must exist (file presence check)
 *
 * @param audioPath - Path to validate
 * @throws Error if path is unsafe or invalid
 */
function validateAudioPath(audioPath: string): void {
	// Must be absolute path (prevents relative path confusion)
	if (!isAbsolute(audioPath)) {
		throw new Error(
			`Audio path must be absolute for security (got: ${audioPath})`,
		);
	}

	// Prevent shell metacharacters (command injection defense)
	// Allow: alphanumeric, /, -, _, ., space
	// Block: ; & | ` $ ( ) < > " ' \ newlines
	const shellMetaPattern = /[;&|`$()<>"'\\]/;
	if (shellMetaPattern.test(audioPath)) {
		throw new Error(
			`Audio path contains unsafe shell metacharacters (got: ${audioPath})`,
		);
	}

	// File must exist (presence validation)
	if (!pathExistsSync(audioPath)) {
		throw new Error(`Audio file does not exist: ${audioPath}`);
	}
}

/**
 * Transcribe a voice memo using parakeet-mlx.
 *
 * Process:
 * 1. Validate audio path (security check)
 * 2. Check dependencies (parakeet-mlx, ffmpeg)
 * 3. Run parakeet-mlx transcription
 * 4. Read transcription text
 * 5. Clean up temp files
 *
 * @param audioPath - Absolute path to audio file (m4a, mp3, wav, etc.)
 * @returns Transcription result with text and metadata
 * @throws Error if path is unsafe, dependencies missing, or transcription fails
 */
export async function transcribeVoiceMemo(
	audioPath: string,
): Promise<TranscriptionResult> {
	// Security: Validate path before any processing
	validateAudioPath(audioPath);

	// Validate dependencies
	if (!(await isParakeetMlxAvailable())) {
		throw new Error(
			"parakeet-mlx not found. Install with: uv tool install parakeet-mlx",
		);
	}

	if (!(await isFfmpegAvailable())) {
		throw new Error("ffmpeg not found. Install with: brew install ffmpeg");
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

		// Check if output file was created
		// Some audio files cause parakeet-mlx to exit with 0 but not create output
		if (!pathExistsSync(txtPath)) {
			// Return empty transcription - will be handled as "skipped" by caller
			return {
				text: "",
				modelUsed: DEFAULT_MODEL,
			};
		}

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
