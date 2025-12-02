/**
 * Seat map markdown template
 */

import { renderSeatMap } from "../formatters.ts";
import type { SeatMap } from "../scraper.ts";

/**
 * Renders seat map as markdown with ASCII visualization
 *
 * @param seatMap - Seat map data from scraper
 * @returns Markdown formatted string with embedded ASCII art
 *
 * @example Output:
 * ```
 * **Screen 3**
 *
 * ```
 * SCREEN 3
 * ══════════════════════════════════════════════════
 *
 * A  [01] [02] [03] [04] [05] [06] [07] [08] [09] [10]
 * B  [01] [02] [XX] [04] [05] [06] [07] [08] [09] [10]
 * ...
 *
 * Legend: [ ] Available  [X] Taken  [W] Wheelchair
 * Available: 68 / 70 seats
 * ```
 *
 * 68 / 70 available
 *
 * Pick a seat (e.g., "E8").
 * ```
 */
export function renderSeatsMarkdown(seatMap: SeatMap): string {
	const lines: string[] = [];

	// Header
	lines.push(`**${seatMap.screenNumber}**`);
	lines.push("");

	// ASCII seat map in code block
	lines.push("```");
	lines.push(renderSeatMap(seatMap));
	lines.push("```");
	lines.push("");

	// Summary
	lines.push(`${seatMap.availableCount} / ${seatMap.totalSeats} available`);
	lines.push("");
	lines.push('Pick a seat (e.g., "E8").');

	return lines.join("\n");
}
