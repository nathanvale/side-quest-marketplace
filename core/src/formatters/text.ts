/**
 * Text formatting utilities.
 *
 * Provides functions for cleaning and formatting text content.
 *
 * @module formatters/text
 */

/**
 * Remove consecutive duplicate lines from text.
 *
 * Useful for cleaning up transcription output where models can hallucinate
 * repeated phrases when audio becomes quiet or noisy.
 *
 * @example
 * ```ts
 * const text = "Line A\nLine A\nLine A\nLine B";
 * dedupeConsecutiveLines(text); // "Line A\nLine B"
 * ```
 *
 * @param text - Text that may contain repeated lines
 * @returns Text with consecutive duplicates removed
 */
export function dedupeConsecutiveLines(text: string): string {
	const lines = text.split("\n");
	const deduped: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		// Skip empty lines and consecutive duplicates
		if (trimmed && deduped[deduped.length - 1] !== trimmed) {
			deduped.push(trimmed);
		}
	}

	return deduped.join("\n");
}
