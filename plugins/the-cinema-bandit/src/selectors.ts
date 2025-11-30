/**
 * CSS Selectors and scraping configuration for Classic Cinemas
 *
 * @packageDocumentation
 *
 * This module provides selector configurations for scraping the Classic Cinemas website.
 * Each selector implements a 4-tier fallback hierarchy:
 *
 * 1. **Primary CSS selector** - Preferred method, fastest if DOM structure is stable
 * 2. **Fallback CSS selectors** - Alternative selectors if primary fails (usually 2-4 options)
 * 3. **Text pattern matching** - Regex patterns for snapshot text fallback (when CSS fails)
 * 4. **Manual input** - Ultimate fallback if no method works (user provides value)
 *
 * This design ensures robust scraping even when the website makes minor HTML/CSS changes.
 *
 * ## Active Selectors
 *
 * - **PRICING_SELECTORS** - Ticket prices (adult, child, booking fee, total)
 * - **SESSION_SELECTORS** - Booking page details (screen, date/time, session ID, duration, seats)
 *
 * ## Removed Selectors
 *
 * The following were removed as they were not used by the Playwright-based CLI:
 * - `MOVIE_SELECTORS` - Movie listing (handled by native Playwright API)
 * - `PAGE_SELECTORS` - Page structure (navigation, loading, errors - not needed for automation)
 * - `SELECTOR_METADATA` - Version tracking (managed in git history instead)
 *
 * Last verified: 29 November 2024
 *
 * @see src/scraper-client.ts for fallback hierarchy implementation
 */

/**
 * Selector configuration with fallback strategies
 */
export interface SelectorConfig {
	/**
	 * Primary CSS selector to try first
	 */
	primary: string;

	/**
	 * Alternative selectors to try if primary fails
	 */
	fallbacks?: string[];

	/**
	 * Text pattern to search for if all selectors fail
	 */
	textPattern?: RegExp;

	/**
	 * Description of what this selector finds
	 */
	description: string;
}

/**
 * Pricing selectors - for scraping current ticket prices
 */
export const PRICING_SELECTORS = {
	/**
	 * Adult ticket price
	 * Example: "$27.00"
	 */
	adultPrice: {
		primary: '[data-ticket-type="adult"] .price',
		fallbacks: [
			".ticket-type-adult .price",
			'[aria-label*="Adult"] .price',
			".adult-ticket .price",
		],
		textPattern: /Adult.*?\$(\d+\.\d{2})/i,
		description: "Adult guest ticket price",
	} as SelectorConfig,

	/**
	 * Child/Concession ticket price
	 * Example: "$21.00"
	 */
	childPrice: {
		primary: '[data-ticket-type="concession"] .price',
		fallbacks: [
			".ticket-type-concession .price",
			'[aria-label*="Concession"] .price',
			".concession-ticket .price",
			".child-ticket .price",
		],
		textPattern: /Concession.*?\$(\d+\.\d{2})/i,
		description: "Child/Concession guest ticket price",
	} as SelectorConfig,

	/**
	 * Booking fee per ticket
	 * Example: "$1.95"
	 */
	bookingFee: {
		primary: ".booking-fee .amount",
		fallbacks: [
			'[data-fee-type="booking"] .amount',
			".fee-booking",
			'[aria-label*="Booking fee"]',
		],
		textPattern: /Booking fee.*?\$(\d+\.\d{2})/i,
		description: "Booking fee per ticket",
	} as SelectorConfig,

	/**
	 * Total amount display (for verification)
	 */
	total: {
		primary: ".total-amount",
		fallbacks: [".grand-total", "[data-total]", ".checkout-total"],
		textPattern: /Total.*?\$(\d+\.\d{2})/i,
		description: "Total amount including fees",
	} as SelectorConfig,
} as const;

/**
 * Session details selectors - for ticket booking page
 */
export const SESSION_SELECTORS = {
	/**
	 * Screen number (e.g., "Screen 3")
	 */
	screenNumber: {
		primary: "[data-screen]",
		fallbacks: [
			".screen-number",
			".cinema-screen",
			'[aria-label*="Screen"]',
			".venue-info .screen",
			".session-venue",
		],
		textPattern: /Screen\s+(\d+)/i,
		description: "Cinema screen number",
	} as SelectorConfig,

	/**
	 * Full session date and time (e.g., "30 Nov 2025, 11:00am-12:56pm")
	 */
	dateTime: {
		primary: "[data-session-time]",
		fallbacks: [
			".session-datetime",
			".showtime-full",
			".session-info time",
			"[datetime]",
			".session-date",
		],
		textPattern: /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s+\d{1,2}:\d{2}[ap]m)/i,
		description: "Session date and time",
	} as SelectorConfig,

	/**
	 * Session ID in URL or data attribute
	 */
	sessionId: {
		primary: "[data-session-id]",
		fallbacks: [
			"[data-session]",
			'a[href*="session"]',
			'[id*="session"]',
			'input[name="session_id"]',
		],
		textPattern: /session[_-]?(?:id)?[=:](\d+)/i,
		description: "Session identifier",
	} as SelectorConfig,

	/**
	 * Movie duration (e.g., "2h 15m", "125 mins")
	 */
	duration: {
		primary: ".movie-duration",
		fallbacks: [
			"[data-duration]",
			".runtime",
			".film-length",
			'[aria-label*="duration"]',
			".session-duration",
		],
		textPattern: /(?:(\d+)h\s*)?(\d+)m(?:in)?s?|(\d+)\s*(?:min|mins)/i,
		description: "Movie duration",
	} as SelectorConfig,

	/**
	 * Seat selection area
	 */
	seatMap: {
		primary: ".seat-map",
		fallbacks: ["[data-seat-map]", ".seating-chart", "#seats", ".venue-layout"],
		description: "Seat selection map",
	} as SelectorConfig,

	/**
	 * Individual seat button
	 */
	seat: {
		primary: ".seat",
		fallbacks: [
			"[data-seat]",
			"button.seat-btn",
			".seat-item",
			'[role="button"][aria-label*="seat"]',
		],
		description: "Individual seat",
	} as SelectorConfig,
} as const;

/**
 * URLs for different pages
 */
export const URLS = {
	homepage: "https://www.classiccinemas.com.au",
	ticketBase: "https://www.classiccinemas.com.au/tickets",
} as const;

/**
 * Helper to build ticket URL with session ID
 * Classic Cinemas requires both cinema ID (c) and session ID (s) parameters
 * Cinema ID 0000000002 is for Elsternwick location
 */
export function buildTicketUrl(sessionId: string): string {
	return `${URLS.ticketBase}?c=0000000002&s=${sessionId}`;
}
