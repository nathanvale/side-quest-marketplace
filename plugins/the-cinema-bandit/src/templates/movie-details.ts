/**
 * Movie details markdown template
 */

import type { MovieDetailsResponse } from "../formatters.ts";

/**
 * Renders movie details as markdown
 *
 * @param details - Movie details from scraper
 * @param sessionTimes - Optional session times string (e.g., "3:00 pm | 7:00 pm")
 * @returns Markdown formatted string
 *
 * @example Output:
 * ```
 * ## Wicked: For Good
 *
 * **PG** | 2h 40min | USA
 *
 * And now whatever way our stories end...
 *
 * **Director**: Jon M. Chu
 * **Cast**: Cynthia Erivo, Ariana Grande
 *
 * **Trailer**: https://youtube.com/...
 *
 * ---
 *
 * **Session times**: 3:00 pm | 7:00 pm
 *
 * Want to book? Pick a time above.
 * ```
 */
export function renderMovieDetailsMarkdown(
	details: MovieDetailsResponse,
	sessionTimes?: string,
): string {
	const lines: string[] = [];

	// Title
	lines.push(`## ${details.title}`);
	lines.push("");

	// Metadata line (rating | duration | country)
	const metaParts: string[] = [];
	if (details.rating) metaParts.push(`**${details.rating}**`);
	if (details.duration) metaParts.push(details.duration);
	if (details.country) metaParts.push(details.country);

	if (metaParts.length > 0) {
		lines.push(metaParts.join(" | "));
		lines.push("");
	}

	// Description
	if (details.description) {
		lines.push(details.description);
		lines.push("");
	}

	// Director
	if (details.director) {
		lines.push(`**Director**: ${details.director}`);
	}

	// Cast
	if (details.cast) {
		lines.push(`**Cast**: ${details.cast}`);
	}

	if (details.director || details.cast) {
		lines.push("");
	}

	// Trailer
	if (details.trailerUrl) {
		lines.push(`**Trailer**: ${details.trailerUrl}`);
		lines.push("");
	}

	lines.push("---");
	lines.push("");

	// Session times (if provided)
	if (sessionTimes) {
		lines.push(`**Session times**: ${sessionTimes}`);
		lines.push("");
	}

	lines.push("Want to book? Pick a time above.");

	return lines.join("\n");
}
