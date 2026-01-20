/**
 * Human-readable name validation utilities.
 *
 * Provides validation for user-facing names with length constraints
 * and character restrictions suitable for display purposes.
 *
 * @module validation/names
 */

/**
 * Validate PARA area name.
 *
 * Ensures area names are non-empty, within length limits, and contain
 * only safe characters. Used for PARA method area categorization.
 *
 * @param area - Area name to validate
 * @returns Validated area name (trimmed)
 * @throws Error if area is invalid
 *
 * @example
 * ```ts
 * const area = validateAreaName('Health'); // ✅ OK
 * validateAreaName('Personal Finance'); // ✅ OK (spaces allowed)
 * validateAreaName('Work-Life'); // ✅ OK (hyphens allowed)
 * validateAreaName('Area_Name'); // ✅ OK (underscores allowed)
 * validateAreaName('  Health  '); // ✅ OK (trimmed to 'Health')
 * validateAreaName(''); // ❌ Error: empty
 * validateAreaName('a'.repeat(200)); // ❌ Error: too long (max 100)
 * validateAreaName('Health@#$'); // ❌ Error: invalid characters
 * ```
 */
export function validateAreaName(area: string): string {
	const trimmed = area.trim();

	if (trimmed.length === 0) {
		throw new Error("Area name cannot be empty");
	}

	if (trimmed.length > 100) {
		throw new Error(
			`Area name too long (max 100 chars, got: ${trimmed.length})`,
		);
	}

	// Allow letters, numbers, spaces, hyphens, underscores
	if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
		throw new Error(`Invalid area name: ${area}`);
	}

	return trimmed;
}

/**
 * Validate display name (human-readable text).
 *
 * Ensures display names are non-empty and within length limits.
 * Less restrictive than area names - allows any printable characters.
 *
 * @param displayName - Display name to validate
 * @returns Validated display name (trimmed)
 * @throws Error if display name is invalid
 *
 * @example
 * ```ts
 * const name = validateDisplayName('Medical Bill'); // ✅ OK
 * validateDisplayName('Invoice & Receipt'); // ✅ OK (special chars allowed)
 * validateDisplayName('  Label  '); // ✅ OK (trimmed to 'Label')
 * validateDisplayName(''); // ❌ Error: empty
 * validateDisplayName('   '); // ❌ Error: empty after trim
 * validateDisplayName('a'.repeat(200)); // ❌ Error: too long (max 100)
 * ```
 */
export function validateDisplayName(displayName: string): string {
	const trimmed = displayName.trim();

	if (trimmed.length === 0) {
		throw new Error("Display name cannot be empty");
	}

	if (trimmed.length > 100) {
		throw new Error(
			`Display name too long (max 100 chars, got: ${trimmed.length})`,
		);
	}

	return trimmed;
}
