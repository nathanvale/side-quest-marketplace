/**
 * Classic Cinemas ticket pricing calculator
 *
 * Calculates ticket totals, booking fees, and generates invoice lines
 * based on guest pricing structure (not member pricing).
 *
 * Pricing structure (as of Nov 2024):
 * - Adult (guest): $27.00
 * - Concession/Child (guest): $21.00
 * - Booking fee: $1.95 per ticket
 */

import { formatCurrency } from "@side-quest/core/formatters";
import type { InvoiceLine, TicketLine } from "./template.ts";

/**
 * Guest ticket prices for Classic Cinemas
 */
export const GUEST_PRICES = {
	adult: 27.0,
	child: 21.0,
	bookingFeePerTicket: 1.95,
} as const;

/**
 * Ticket counts for a booking
 */
export interface TicketCounts {
	/**
	 * Number of adult tickets
	 */
	adults: number;

	/**
	 * Number of child/concession tickets
	 */
	children: number;
}

/**
 * Calculated pricing breakdown
 */
export interface PricingBreakdown {
	/**
	 * Ticket lines for display in email
	 */
	ticketLines: TicketLine[];

	/**
	 * Invoice lines with descriptions and prices
	 */
	invoiceLines: InvoiceLine[];

	/**
	 * Booking fee as formatted string
	 * @example "$3.90"
	 */
	bookingFee: string;

	/**
	 * Total amount including booking fee
	 * @example "$57.90"
	 */
	totalAmount: string;

	/**
	 * Subtotal before booking fee (for reference)
	 */
	ticketSubtotal: number;

	/**
	 * Booking fee as number (for reference)
	 */
	bookingFeeAmount: number;

	/**
	 * Total amount as number (for reference)
	 */
	totalAmountNumber: number;
}

/**
 * Calculates pricing breakdown for a Classic Cinemas booking
 *
 * Uses the guest pricing formula:
 * - Adult tickets: $27.00 each
 * - Child tickets: $21.00 each
 * - Booking fee: $1.95 per ticket
 * - Total: (adults × $27) + (children × $21) + (total tickets × $1.95)
 *
 * @param counts - Number of adult and child tickets
 * @returns Complete pricing breakdown with formatted strings for email template
 *
 * @example
 * ```typescript
 * const breakdown = calculatePricing({ adults: 2, children: 1 });
 * // Returns:
 * // {
 * //   ticketLines: [
 * //     { type: "Adult", quantity: 2 },
 * //     { type: "Concession", quantity: 1 }
 * //   ],
 * //   invoiceLines: [
 * //     { description: "Adult x 2", price: "$54.00" },
 * //     { description: "Concession x 1", price: "$21.00" }
 * //   ],
 * //   bookingFee: "$5.85",
 * //   totalAmount: "$80.85",
 * //   ticketSubtotal: 75.00,
 * //   bookingFeeAmount: 5.85,
 * //   totalAmountNumber: 80.85
 * // }
 * ```
 */
export function calculatePricing(counts: TicketCounts): PricingBreakdown {
	const { adults, children } = counts;

	// Calculate ticket costs
	const adultTotal = adults * GUEST_PRICES.adult;
	const childTotal = children * GUEST_PRICES.child;
	const ticketSubtotal = adultTotal + childTotal;

	// Calculate booking fee
	const totalTickets = adults + children;
	const bookingFeeAmount = totalTickets * GUEST_PRICES.bookingFeePerTicket;

	// Calculate total
	const totalAmountNumber = ticketSubtotal + bookingFeeAmount;

	// Build ticket lines
	const ticketLines: TicketLine[] = [];
	if (adults > 0) {
		ticketLines.push({ type: "Adult", quantity: adults });
	}
	if (children > 0) {
		ticketLines.push({ type: "Concession", quantity: children });
	}

	// Build invoice lines
	const invoiceLines: InvoiceLine[] = [];
	if (adults > 0) {
		invoiceLines.push({
			description: `Adult x ${adults}`,
			price: formatCurrency(adultTotal),
		});
	}
	if (children > 0) {
		invoiceLines.push({
			description: `Concession x ${children}`,
			price: formatCurrency(childTotal),
		});
	}

	return {
		ticketLines,
		invoiceLines,
		bookingFee: formatCurrency(bookingFeeAmount),
		totalAmount: formatCurrency(totalAmountNumber),
		ticketSubtotal,
		bookingFeeAmount,
		totalAmountNumber,
	};
}
