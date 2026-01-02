/**
 * YouTube Transcript Errors
 *
 * Custom error types for the YouTube transcript service.
 *
 * @module youtube-transcript/errors
 */

/**
 * Error codes for YouTube transcript operations.
 */
export type YouTubeTranscriptErrorCode =
	| "TRANSCRIPT_DISABLED"
	| "VIDEO_NOT_FOUND"
	| "LANGUAGE_NOT_AVAILABLE"
	| "FETCH_FAILED"
	| "PARSE_FAILED"
	| "TIMEOUT";

/**
 * Custom error for YouTube transcript operations.
 *
 * Provides structured error information with error codes for better error handling.
 */
export class YouTubeTranscriptError extends Error {
	/** Error code for programmatic handling */
	readonly code: YouTubeTranscriptErrorCode;
	/** The video ID that caused the error */
	readonly videoId?: string;
	/** The original error that caused this error */
	override readonly cause?: Error;

	constructor(
		message: string,
		code: YouTubeTranscriptErrorCode,
		options?: { videoId?: string; cause?: Error },
	) {
		super(message);
		this.name = "YouTubeTranscriptError";
		this.code = code;
		this.videoId = options?.videoId;
		this.cause = options?.cause;

		// Maintain proper prototype chain
		Object.setPrototypeOf(this, YouTubeTranscriptError.prototype);
	}

	/**
	 * Create an error for when transcripts are disabled on a video.
	 */
	static transcriptDisabled(videoId: string): YouTubeTranscriptError {
		return new YouTubeTranscriptError(
			`Transcripts are disabled for video: ${videoId}`,
			"TRANSCRIPT_DISABLED",
			{ videoId },
		);
	}

	/**
	 * Create an error for when a video is not found.
	 */
	static videoNotFound(videoId: string): YouTubeTranscriptError {
		return new YouTubeTranscriptError(
			`Video not found: ${videoId}`,
			"VIDEO_NOT_FOUND",
			{ videoId },
		);
	}

	/**
	 * Create an error for when the requested language is not available.
	 */
	static languageNotAvailable(
		videoId: string,
		lang: string,
	): YouTubeTranscriptError {
		return new YouTubeTranscriptError(
			`Language "${lang}" not available for video: ${videoId}`,
			"LANGUAGE_NOT_AVAILABLE",
			{ videoId },
		);
	}

	/**
	 * Create an error for fetch failures.
	 */
	static fetchFailed(videoId: string, cause?: Error): YouTubeTranscriptError {
		return new YouTubeTranscriptError(
			`Failed to fetch transcript for video: ${videoId}`,
			"FETCH_FAILED",
			{ videoId, cause },
		);
	}

	/**
	 * Create an error for parse failures.
	 */
	static parseFailed(videoId: string, cause?: Error): YouTubeTranscriptError {
		return new YouTubeTranscriptError(
			`Failed to parse transcript for video: ${videoId}`,
			"PARSE_FAILED",
			{ videoId, cause },
		);
	}

	/**
	 * Create an error for timeout.
	 */
	static timeout(videoId: string, timeoutMs: number): YouTubeTranscriptError {
		return new YouTubeTranscriptError(
			`Transcript fetch timed out after ${timeoutMs}ms for video: ${videoId}`,
			"TIMEOUT",
			{ videoId },
		);
	}
}
