/**
 * Booking confirmation markdown template
 */

/**
 * Invoice line item for ticket breakdown
 */
export interface InvoiceLine {
	/** Item description (e.g., "Adult x 2") */
	description: string;
	/** Item price (e.g., "$53.00") */
	price: string;
}

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
	/** Invoice line items (optional) */
	invoiceLines?: InvoiceLine[];
	/** Booking fee (optional) */
	bookingFee?: string;
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
 *
 * **Pricing:**
 * - Adult Ticket x 2: $53.00
 * - Child Ticket x 1: $17.00
 * - Booking Fee: $5.85
 * - **Total**: $75.85
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

	// Add pricing breakdown if invoice lines are provided
	if (data.invoiceLines && data.invoiceLines.length > 0) {
		lines.push("");
		lines.push("**Pricing:**");
		for (const line of data.invoiceLines) {
			lines.push(`- ${line.description}: ${line.price}`);
		}
		if (data.bookingFee) {
			lines.push(`- Booking Fee: ${data.bookingFee}`);
		}
		lines.push(`- **Total**: $${data.totalAmount}`);
	} else {
		lines.push(`- **Total**: $${data.totalAmount}`);
	}

	lines.push("");
	lines.push("Enjoy the film!");

	return lines.join("\n");
}
