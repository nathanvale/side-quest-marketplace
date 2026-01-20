/**
 * Byte formatting utilities
 *
 * Human-readable byte size formatting with SI units.
 *
 * @example
 * ```ts
 * import { formatBytes } from "@sidequest/core/formatters/bytes";
 *
 * formatBytes(1024); // "1 KB"
 * formatBytes(1048576); // "1 MB"
 * formatBytes(0); // "0 B"
 * ```
 */

/**
 * Format bytes to human-readable size
 *
 * Converts byte counts to human-readable strings with appropriate SI units
 * (B, KB, MB, GB, TB). Uses binary units (1024 base) rather than SI (1000 base).
 *
 * @param bytes - Number of bytes to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Human-readable size string
 *
 * @example
 * ```ts
 * formatBytes(0); // "0 B"
 * formatBytes(1024); // "1 KB"
 * formatBytes(1536, 1); // "1.5 KB"
 * formatBytes(1048576); // "1 MB"
 * formatBytes(1073741824); // "1 GB"
 * formatBytes(1234567, 0); // "1 MB" (no decimals)
 * ```
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return "0 B";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}
