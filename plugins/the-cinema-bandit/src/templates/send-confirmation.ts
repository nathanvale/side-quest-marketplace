/**
 * Booking confirmation markdown template
 */

/**
 * Data required for booking confirmation display
 */
export interface SendConfirmationData {
	/** Movie title */
	movieTitle: string;
	/** Session date/time (e.g., "Fri 29 Nov, 08:15PM") */
	sessionDateTime: string;
	/** Screen number (e.g., "Screen 3") */
	screenNumber: string;
	/** Seat(s) booked (e.g., "J6, J7") */
	seats: string;
	/** Total amount paid */
	totalAmount: string;
}

/**
 * Renders booking confirmation as markdown
 *
 * @param data - Booking confirmation data
 * @returns Markdown formatted string
 *
 * @example Output:
 * ```
 * Your ticket has been sent to your email.
 *
 * ---
 *
 * **Wicked: For Good**
 * - **Date**: Fri 29 Nov, 08:15PM
 * - **Screen**: Screen 3
 * - **Seat(s)**: J6, J7
 * - **Total**: $55.90
 *
 * Enjoy the film!
 * ```
 */
export function renderSendConfirmationMarkdown(
	data: SendConfirmationData,
): string {
	const lines: string[] = [];

	lines.push("Your ticket has been sent to your email.");
	lines.push("");
	lines.push("---");
	lines.push("");

	lines.push(`**${data.movieTitle}**`);
	lines.push(`- **Date**: ${data.sessionDateTime}`);
	lines.push(`- **Screen**: ${data.screenNumber}`);
	lines.push(`- **Seat(s)**: ${data.seats}`);
	lines.push(`- **Total**: $${data.totalAmount}`);
	lines.push("");

	lines.push("Enjoy the film!");

	return lines.join("\n");
}
