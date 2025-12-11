/**
 * General utilities using Bun primitives
 */

/**
 * Deep equality check using Bun's native deepEquals
 */
export function deepEquals(a: unknown, b: unknown, strict = false): boolean {
	return Bun.deepEquals(a, b, strict);
}

/**
 * Deep clone via JSON round-trip (fast for plain objects)
 */
export function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return Bun.sleep(ms);
}

/**
 * Generate a UUID v4
 */
export function uuid(): string {
	return crypto.randomUUID();
}

/**
 * Check if running in Bun
 */
export function isBun(): boolean {
	return typeof Bun !== "undefined";
}

/**
 * Get Bun version or null if not in Bun
 */
export function bunVersion(): string | null {
	return typeof Bun !== "undefined" ? Bun.version : null;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(content: string, fallback: T): T {
	try {
		return JSON.parse(content);
	} catch {
		return fallback;
	}
}
