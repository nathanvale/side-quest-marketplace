/**
 * Price scraper utilities for Classic Cinemas
 *
 * Provides pricing calculation helpers and validation.
 * Scraping is handled by Playwright-based CLI (src/cli.ts).
 */

import { parsePrice } from "@sidequest/core/formatters";
import { pricingLogger } from "./logger.ts";
import type { SelectorConfig } from "./selectors.ts";

/**
 * Individual ticket type with price
 */
export interface TicketTypePrice {
	/**
	 * Ticket type name (e.g., "ADULT", "SENIOR")
	 */
	name: string;

	/**
	 * Price in dollars (numeric)
	 */
	price: number;
}

/**
 * Scraped pricing data from Classic Cinemas
 */
export interface ScrapedPricing {
	/**
	 * All available ticket types with their prices
	 */
	ticketTypes: TicketTypePrice[];

	/**
	 * Booking fee per ticket in dollars
	 */
	bookingFeePerTicket: number;

	/**
	 * When this pricing was scraped
	 */
	scrapedAt: Date;

	/**
	 * Which selectors worked (for debugging)
	 */
	selectorsUsed: {
		ticketTypes: string;
		bookingFee: string;
	};
}

/**
 * Format ticket type name for display in invoice
 * Converts uppercase names to title case with "Ticket" suffix
 *
 * @param type - Raw ticket type name (e.g., "ADULT", "CHILD", "SENIOR")
 * @returns Formatted name (e.g., "Adult Ticket", "Child Ticket", "Senior Ticket")
 *
 * @example
 * ```typescript
 * formatTicketTypeName("ADULT")     // "Adult Ticket"
 * formatTicketTypeName("CHILD")     // "Child Ticket"
 * formatTicketTypeName("CONCESSION") // "Concession Ticket"
 * ```
 */
export function formatTicketTypeName(type: string): string {
	// Convert to title case: "ADULT" -> "Adult"
	const titleCase = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
	return `${titleCase} Ticket`;
}

/**
 * Parse a price string to a number with logging
 * Wraps core parsePrice function with application-specific logging
 */
function parsePriceWithLogging(priceText: string): number {
	try {
		const price = parsePrice(priceText);
		pricingLogger.debug("Price parsed", { input: priceText, price });
		return price;
	} catch (error) {
		pricingLogger.error("Failed to parse price", {
			input: priceText,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Try to find an element using a selector configuration
 * Returns the text content if found, null if not found
 *
 * This implements a fallback hierarchy for snapshot-based text extraction:
 * 1. Search snapshot text using the textPattern regex
 * 2. Return matched text if found
 * 3. Return null if no match (ultimate fallback - manual input)
 *
 * Note: This is designed for Chrome DevTools snapshot text, not live DOM.
 * Selectors are used by Chrome DevTools MCP tools, but this function handles
 * the text-based fallback when selectors don't work.
 */
export function findWithFallback(
	snapshot: string,
	config: SelectorConfig,
): string | null {
	// If no text pattern is defined, we can't do text-based fallback
	if (!config.textPattern) {
		pricingLogger.debug("No text pattern for fallback", {
			field: config.description,
		});
		return null;
	}

	// Search the snapshot text for the pattern
	const match = snapshot.match(config.textPattern);

	if (!match) {
		pricingLogger.debug("Text pattern not matched", {
			field: config.description,
		});
		return null;
	}

	const result = match[1] ?? match[0];
	pricingLogger.debug("Text pattern matched", {
		field: config.description,
		matched: result,
	});

	// If the regex has a capture group, return the first captured value
	// Otherwise, return the full match
	return result;
}

/**
 * Extract pricing from scraped data
 * This helper validates and structures the scraped pricing
 */
export function validateScrapedPricing(data: {
	ticketTypes: Array<{ name: string; price: string }>;
	bookingFee: string;
	selectorsUsed: {
		ticketTypes: string;
		bookingFee: string;
	};
}): ScrapedPricing {
	pricingLogger.debug("Validating scraped pricing", {
		selectorsUsed: data.selectorsUsed,
		ticketTypeCount: data.ticketTypes.length,
	});

	// Validate we have at least one ticket type
	if (data.ticketTypes.length === 0) {
		pricingLogger.error("No ticket types found");
		throw new Error("No ticket types found in scraped data");
	}

	// Parse and validate each ticket type price
	const ticketTypes: TicketTypePrice[] = data.ticketTypes.map((ticketType) => {
		const price = parsePriceWithLogging(ticketType.price);

		// Validation: ticket prices should be reasonable
		if (price < 5 || price > 100) {
			pricingLogger.error("Ticket price out of range", {
				name: ticketType.name,
				price,
			});
			throw new Error(
				`${ticketType.name} price ${price} seems unreasonable (expected $5-$100)`,
			);
		}

		pricingLogger.debug("Ticket type validated", {
			name: ticketType.name,
			price,
		});

		return {
			name: ticketType.name,
			price,
		};
	});

	const bookingFeePerTicket = parsePriceWithLogging(data.bookingFee);

	// Validate booking fee
	if (bookingFeePerTicket < 0 || bookingFeePerTicket > 10) {
		pricingLogger.error("Booking fee out of range", { bookingFeePerTicket });
		throw new Error(
			`Booking fee ${bookingFeePerTicket} seems unreasonable (expected $0-$10)`,
		);
	}

	pricingLogger.info("Pricing validated successfully", {
		ticketTypesCount: ticketTypes.length,
		ticketTypes: ticketTypes.map((t) => ({ name: t.name, price: t.price })),
		bookingFeePerTicket,
	});

	return {
		ticketTypes,
		bookingFeePerTicket,
		scrapedAt: new Date(),
		selectorsUsed: data.selectorsUsed,
	};
}

/**
 * Ticket selection (type and quantity)
 */
export interface TicketSelection {
	/** Ticket type name (must match a scraped ticket type) */
	type: string;
	/** Number of tickets */
	quantity: number;
}

/**
 * Calculate pricing using scraped prices and dynamic ticket selections
 * This replaces the hardcoded adult/child counts with flexible ticket type selections
 */
export function calculatePricingFromScraped(
	scraped: ScrapedPricing,
	selections: TicketSelection[],
) {
	pricingLogger.debug("Calculating pricing from scraped data", {
		selections,
	});

	// Validate all selected ticket types exist in scraped data
	for (const selection of selections) {
		const ticketType = scraped.ticketTypes.find(
			(t) => t.name === selection.type,
		);
		if (!ticketType) {
			pricingLogger.error("Selected ticket type not found", {
				selectedType: selection.type,
				availableTypes: scraped.ticketTypes.map((t) => t.name),
			});
			throw new Error(
				`Ticket type "${selection.type}" not found in scraped pricing data`,
			);
		}
	}

	// Calculate ticket subtotal
	let ticketSubtotal = 0;
	const ticketLines = [];
	const invoiceLines = [];

	for (const selection of selections) {
		if (selection.quantity === 0) continue;

		const ticketType = scraped.ticketTypes.find(
			(t) => t.name === selection.type,
		)!;
		const lineTotal = selection.quantity * ticketType.price;
		ticketSubtotal += lineTotal;

		ticketLines.push({
			type: selection.type,
			quantity: selection.quantity,
		});

		// Format ticket type name: "ADULT" -> "Adult Ticket"
		const formattedType = formatTicketTypeName(selection.type);

		invoiceLines.push({
			description: `${formattedType} x ${selection.quantity}`,
			price: `$${lineTotal.toFixed(2)}`,
		});
	}

	// Calculate booking fee (per ticket)
	const totalTickets = selections.reduce((sum, s) => sum + s.quantity, 0);
	const bookingFeeAmount = totalTickets * scraped.bookingFeePerTicket;

	const totalAmountNumber = ticketSubtotal + bookingFeeAmount;

	pricingLogger.info("Pricing calculated", {
		selections,
		totalTickets,
		totalAmount: totalAmountNumber,
	});

	return {
		ticketLines,
		invoiceLines,
		bookingFee: `$${bookingFeeAmount.toFixed(2)}`,
		totalAmount: `$${totalAmountNumber.toFixed(2)}`,
		ticketSubtotal,
		bookingFeeAmount,
		totalAmountNumber,
		// Include source pricing for transparency
		sourcePricing: scraped,
	};
}
