/**
 * Password module - Secure password hashing using Bun.password
 *
 * Provides secure password hashing with bcrypt and argon2 algorithms.
 * All functions are async by default for non-blocking operation.
 *
 * @example
 * ```ts
 * import { hashPassword, verifyPassword } from "@sidequest/core/password";
 *
 * const hash = await hashPassword("mySecretPassword");
 * const isValid = await verifyPassword("mySecretPassword", hash);
 * ```
 */

/** Supported hashing algorithms */
export type PasswordAlgorithm = "bcrypt" | "argon2id" | "argon2d" | "argon2i";

/** Options for password hashing */
export interface HashOptions {
	/** Hashing algorithm (default: argon2id) */
	algorithm?: PasswordAlgorithm;
	/** Cost factor for bcrypt (4-31, default: 10) */
	cost?: number;
	/** Memory cost for argon2 in KB (default: 65536 = 64MB) */
	memoryCost?: number;
	/** Time cost for argon2 (iterations, default: 2) */
	timeCost?: number;
}

/**
 * Hash a password securely (async)
 *
 * Uses argon2id by default, which is recommended for password hashing.
 * The hash includes algorithm parameters, so verification is automatic.
 *
 * @param password - Plain text password to hash
 * @param options - Hashing options
 * @returns Promise resolving to hash string (includes algorithm info)
 *
 * @example
 * ```ts
 * // Default argon2id (recommended)
 * const hash = await hashPassword("myPassword");
 *
 * // With bcrypt
 * const bcryptHash = await hashPassword("myPassword", {
 *   algorithm: "bcrypt",
 *   cost: 12
 * });
 * ```
 */
export async function hashPassword(
	password: string,
	options?: HashOptions,
): Promise<string> {
	const algorithm = options?.algorithm ?? "argon2id";

	if (algorithm === "bcrypt") {
		return Bun.password.hash(password, {
			algorithm: "bcrypt",
			cost: options?.cost ?? 10,
		});
	}

	return Bun.password.hash(password, {
		algorithm,
		memoryCost: options?.memoryCost ?? 65536,
		timeCost: options?.timeCost ?? 2,
	});
}

/**
 * Hash a password securely (sync)
 *
 * Blocking version - prefer async for server applications.
 *
 * @param password - Plain text password to hash
 * @param options - Hashing options
 * @returns Hash string
 */
export function hashPasswordSync(
	password: string,
	options?: HashOptions,
): string {
	const algorithm = options?.algorithm ?? "argon2id";

	if (algorithm === "bcrypt") {
		return Bun.password.hashSync(password, {
			algorithm: "bcrypt",
			cost: options?.cost ?? 10,
		});
	}

	return Bun.password.hashSync(password, {
		algorithm,
		memoryCost: options?.memoryCost ?? 65536,
		timeCost: options?.timeCost ?? 2,
	});
}

/**
 * Verify a password against a hash (async)
 *
 * Automatically detects the algorithm from the hash string.
 *
 * @param password - Plain text password to verify
 * @param hash - Hash to verify against
 * @returns Promise resolving to true if password matches
 *
 * @example
 * ```ts
 * const isValid = await verifyPassword("myPassword", storedHash);
 * if (!isValid) {
 *   throw new Error("Invalid password");
 * }
 * ```
 */
export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return Bun.password.verify(password, hash);
}

/**
 * Verify a password against a hash (sync)
 *
 * Blocking version - prefer async for server applications.
 *
 * @param password - Plain text password to verify
 * @param hash - Hash to verify against
 * @returns True if password matches
 */
export function verifyPasswordSync(password: string, hash: string): boolean {
	return Bun.password.verifySync(password, hash);
}

/**
 * Check if a hash needs to be rehashed with updated parameters
 *
 * Useful for upgrading hash parameters without forcing password reset.
 *
 * @param hash - Existing hash to check
 * @param options - Desired hash options
 * @returns True if hash should be regenerated
 *
 * @example
 * ```ts
 * // After login, check if we should upgrade the hash
 * if (needsRehash(storedHash, { algorithm: "argon2id", memoryCost: 65536 })) {
 *   const newHash = await hashPassword(password);
 *   await updateUserHash(userId, newHash);
 * }
 * ```
 */
export function needsRehash(hash: string, options?: HashOptions): boolean {
	const algorithm = options?.algorithm ?? "argon2id";

	// Check if algorithm matches
	if (algorithm === "bcrypt" && !hash.startsWith("$2")) {
		return true;
	}
	if (algorithm.startsWith("argon2") && !hash.startsWith("$argon2")) {
		return true;
	}

	// For bcrypt, check cost parameter
	if (algorithm === "bcrypt" && options?.cost) {
		const costMatch = hash.match(/^\$2[aby]?\$(\d+)\$/);
		if (costMatch) {
			const currentCost = Number.parseInt(costMatch[1] ?? "0", 10);
			if (currentCost < options.cost) {
				return true;
			}
		}
	}

	// For argon2, check memory cost in hash
	if (algorithm.startsWith("argon2") && options?.memoryCost) {
		const memMatch = hash.match(/m=(\d+)/);
		if (memMatch) {
			const currentMem = Number.parseInt(memMatch[1] ?? "0", 10);
			if (currentMem < options.memoryCost) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Generate a cryptographically secure random token
 *
 * Useful for password reset tokens, API keys, session IDs, etc.
 *
 * @param length - Length in bytes (default: 32, output is hex so chars = length * 2)
 * @param encoding - Output encoding (default: hex)
 * @returns Random token string
 *
 * @example
 * ```ts
 * const resetToken = generateSecureToken(32); // 64 char hex string
 * const apiKey = generateSecureToken(24, "base64"); // ~32 char base64
 * ```
 */
export function generateSecureToken(
	length = 32,
	encoding: "hex" | "base64" | "base64url" = "hex",
): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));

	if (encoding === "hex") {
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	const buffer = Buffer.from(bytes);
	return encoding === "base64url"
		? buffer.toString("base64url")
		: buffer.toString("base64");
}

/**
 * Generate a random password
 *
 * Creates a cryptographically secure random password with configurable character sets.
 *
 * @param length - Password length (default: 16)
 * @param options - Character set options
 * @returns Random password string
 *
 * @example
 * ```ts
 * const password = generateRandomPassword(20);
 * const simplePassword = generateRandomPassword(12, { symbols: false });
 * ```
 */
export function generateRandomPassword(
	length = 16,
	options?: {
		uppercase?: boolean;
		lowercase?: boolean;
		numbers?: boolean;
		symbols?: boolean;
	},
): string {
	const {
		uppercase = true,
		lowercase = true,
		numbers = true,
		symbols = true,
	} = options ?? {};

	let chars = "";
	if (uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	if (lowercase) chars += "abcdefghijklmnopqrstuvwxyz";
	if (numbers) chars += "0123456789";
	if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

	if (chars.length === 0) {
		chars = "abcdefghijklmnopqrstuvwxyz";
	}

	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join("");
}

/**
 * Time-safe string comparison
 *
 * Prevents timing attacks when comparing secrets.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 *
 * @example
 * ```ts
 * if (!secureCompare(providedToken, storedToken)) {
 *   throw new Error("Invalid token");
 * }
 * ```
 */
export function secureCompare(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);

	if (aBytes.length !== bBytes.length) {
		// Still compare to prevent timing attack on length
		// We need to do constant-time work even on length mismatch
		const maxLen = Math.max(aBytes.length, bBytes.length);
		for (let i = 0; i < maxLen; i++) {
			const _ =
				(aBytes[i % aBytes.length] ?? 0) ^ (bBytes[i % bBytes.length] ?? 0);
		}
		return false;
	}

	let result = 0;
	for (let i = 0; i < aBytes.length; i++) {
		result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	}
	return result === 0;
}
