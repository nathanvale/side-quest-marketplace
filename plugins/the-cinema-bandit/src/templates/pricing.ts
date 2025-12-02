/**
 * Pricing markdown template
 */

import type { TicketType } from "../scraper.ts";

/**
 * Renders pricing/ticket types as markdown
 *
 * @param ticketTypes - Array of available ticket types with prices
 * @param bookingFee - Booking fee per ticket (e.g., "$1.95") or null
 * @returns Markdown formatted string
 *
 * @example Output:
 * ```
 * **Available ticket types:**
 * - ADULT: $27.00
 * - CHILD: $22.00
 * - SENIOR: $22.00
 *
 * **Booking fee**: $1.95 per ticket
 *
 * How many tickets?
 * ```
 */
export function renderPricingMarkdown(
	ticketTypes: TicketType[],
	bookingFee: string | null,
): string {
	const lines: string[] = [];

	lines.push("**Available ticket types:**");

	if (ticketTypes.length === 0) {
		lines.push("- No ticket types available");
	} else {
		for (const ticket of ticketTypes) {
			lines.push(`- ${ticket.name}: ${ticket.price}`);
		}
	}

	lines.push("");

	if (bookingFee) {
		lines.push(`**Booking fee**: $${bookingFee} per ticket`);
		lines.push("");
	}

	lines.push("How many tickets?");

	return lines.join("\n");
}
