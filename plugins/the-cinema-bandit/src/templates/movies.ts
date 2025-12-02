/**
 * Movies list markdown template
 */

import type { Movie } from "../scraper.ts";

/**
 * Renders movies list as markdown
 *
 * @param movies - Array of movies from scraper
 * @returns Markdown formatted string
 *
 * @example Output:
 * ```
 * ## Movies Showing Today
 *
 * **1. Wicked: For Good** (PG)
 *    10:10 am | 1:10 pm | 4:10 pm
 *
 * **2. Zootopia 2** (CTC)
 *    10:25 am | 1:00 pm | 3:30 pm
 *
 * ---
 *
 * Want details on any of these, or pick a time to book?
 * ```
 */
export function renderMoviesMarkdown(movies: Movie[]): string {
	const lines: string[] = [];

	lines.push("## Movies Showing Today");
	lines.push("");

	if (movies.length === 0) {
		lines.push("No movies showing today.");
		lines.push("");
	} else {
		movies.forEach((movie, index) => {
			const sessionTimes = movie.sessionTimes.map((s) => s.time).join(" | ");

			lines.push(`**${index + 1}. ${movie.title}** (${movie.rating})`);
			lines.push(`   ${sessionTimes}`);
			lines.push("");
		});
	}

	lines.push("---");
	lines.push("");
	lines.push("Want details on any of these, or pick a time to book?");

	return lines.join("\n");
}
