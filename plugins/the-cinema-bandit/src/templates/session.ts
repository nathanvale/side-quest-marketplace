/**
 * Session details markdown template
 */

/**
 * Renders session details as markdown
 *
 * @param screenNumber - Screen number (e.g., "Screen 3") or null
 * @param dateTime - Session date/time (e.g., "Fri 29 Nov, 08:15PM") or null
 * @returns Markdown formatted string
 *
 * @example Output:
 * ```
 * **Screen**: Screen 3
 * **Date/Time**: Fri 29 Nov, 08:15PM
 * ```
 */
export function renderSessionMarkdown(
	screenNumber: string | null,
	dateTime: string | null,
): string {
	const lines: string[] = [];

	if (screenNumber) {
		lines.push(`**Screen**: ${screenNumber}`);
	}

	if (dateTime) {
		lines.push(`**Date/Time**: ${dateTime}`);
	}

	if (lines.length === 0) {
		lines.push("Session details not available.");
	}

	return lines.join("\n");
}
