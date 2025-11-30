/**
 * Price scraper utilities for Classic Cinemas
 *
 * Provides pricing calculation helpers and validation.
 * Scraping is handled by Playwright-based CLI (src/cli.ts).
 */

import { pricingLogger } from "./logger.ts";
import type { SelectorConfig } from "./selectors.ts";

/**
 * Scraped pricing data from Classic Cinemas
 */
export interface ScrapedPricing {
	/**
	 * Adult ticket price in dollars
	 */
	adultPrice: number;

	/**
	 * Child/Concession ticket price in dollars
	 */
	childPrice: number;

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
		adultPrice: string;
		childPrice: string;
		bookingFee: string;
	};
}

/**
 * Parse a price string to a number
 * Handles formats: "$27.00", "$27", "27.00", "27"
 */
export function parsePrice(priceText: string): number {
	const cleaned = priceText.replace(/[$,\s]/g, "");
	const price = Number.parseFloat(cleaned);

	if (Number.isNaN(price)) {
		pricingLogger.error("Failed to parse price", { input: priceText, cleaned });
		throw new Error(`Invalid price format: "${priceText}"`);
	}

	pricingLogger.debug("Price parsed", { input: priceText, price });
	return price;
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
	adultPrice: string;
	childPrice: string;
	bookingFee: string;
	selectorUsed: {
		adultPrice: string;
		childPrice: string;
		bookingFee: string;
	};
}): ScrapedPricing {
	pricingLogger.debug("Validating scraped pricing", {
		selectorUsed: data.selectorUsed,
	});

	const adultPrice = parsePrice(data.adultPrice);
	const childPrice = parsePrice(data.childPrice);
	const bookingFeePerTicket = parsePrice(data.bookingFee);

	// Validation: prices should be reasonable
	if (adultPrice < 10 || adultPrice > 100) {
		pricingLogger.error("Adult price out of range", { adultPrice });
		throw new Error(
			`Adult price ${adultPrice} seems unreasonable (expected $10-$100)`,
		);
	}

	if (childPrice < 5 || childPrice > 100) {
		pricingLogger.error("Child price out of range", { childPrice });
		throw new Error(
			`Child price ${childPrice} seems unreasonable (expected $5-$100)`,
		);
	}

	if (bookingFeePerTicket < 0 || bookingFeePerTicket > 10) {
		pricingLogger.error("Booking fee out of range", { bookingFeePerTicket });
		throw new Error(
			`Booking fee ${bookingFeePerTicket} seems unreasonable (expected $0-$10)`,
		);
	}

	// Child tickets should be cheaper than or equal to adult tickets
	if (childPrice > adultPrice) {
		pricingLogger.error("Child price higher than adult", {
			childPrice,
			adultPrice,
		});
		throw new Error(
			`Child price ($${childPrice}) is higher than adult price ($${adultPrice}) - this seems wrong`,
		);
	}

	pricingLogger.info("Pricing validated successfully", {
		adultPrice,
		childPrice,
		bookingFeePerTicket,
	});

	return {
		adultPrice,
		childPrice,
		bookingFeePerTicket,
		scrapedAt: new Date(),
		selectorsUsed: data.selectorUsed,
	};
}

/**
 * Calculate pricing using scraped prices
 * This replaces the hardcoded GUEST_PRICES with live-scraped data
 */
export function calculatePricingFromScraped(
	scraped: ScrapedPricing,
	counts: { adults: number; children: number },
) {
	pricingLogger.debug("Calculating pricing from scraped data", { counts });

	const adultTotal = counts.adults * scraped.adultPrice;
	const childTotal = counts.children * scraped.childPrice;
	const ticketSubtotal = adultTotal + childTotal;

	const totalTickets = counts.adults + counts.children;
	const bookingFeeAmount = totalTickets * scraped.bookingFeePerTicket;

	const totalAmountNumber = ticketSubtotal + bookingFeeAmount;

	// Build ticket lines
	const ticketLines = [];
	if (counts.adults > 0) {
		ticketLines.push({ type: "Adult", quantity: counts.adults });
	}
	if (counts.children > 0) {
		ticketLines.push({ type: "Child", quantity: counts.children });
	}

	// Build invoice lines
	const invoiceLines = [];
	if (counts.adults > 0) {
		invoiceLines.push({
			description: `Adult x ${counts.adults}`,
			price: `$${adultTotal.toFixed(2)}`,
		});
	}
	if (counts.children > 0) {
		invoiceLines.push({
			description: `Child x ${counts.children}`,
			price: `$${childTotal.toFixed(2)}`,
		});
	}

	pricingLogger.info("Pricing calculated", {
		adults: counts.adults,
		children: counts.children,
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
