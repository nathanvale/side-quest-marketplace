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
 * - **MOVIE_DETAIL_SELECTORS** - Movie detail page metadata (title, description, rating, duration, cast, director, trailer)
 *
 * ## Removed Selectors
 *
 * The following were removed as they were not used by the Playwright-based CLI:
 * - `MOVIE_SELECTORS` - Movie listing (handled by native Playwright API)
 * - `PAGE_SELECTORS` - Page structure (navigation, loading, errors - not needed for automation)
 * - `SELECTOR_METADATA` - Version tracking (managed in git history instead)
 *
 * Last updated: 30 November 2025
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
 *
 * The Classic Cinemas ticket page shows prices as:
 *   ADULT
 *   $26.50
 *   [ADD TICKET button]
 *
 * Each ticket type is a row with the type name, price, and button as siblings.
 */
export const PRICING_SELECTORS = {
	/**
	 * Adult ticket price
	 * Example: "$26.50"
	 */
	adultPrice: {
		primary: "text=/\\$\\d+\\.\\d{2}/ >> nth=0",
		fallbacks: ['text="ADULT" + text=/\\$\\d+/', ".ticket-type-adult .price"],
		textPattern: /ADULT[^$]*\$(\d+\.\d{2})/i,
		description: "Adult guest ticket price",
	} as SelectorConfig,

	/**
	 * Child ticket price
	 * Example: "$17.00"
	 */
	childPrice: {
		primary: "text=/\\$\\d+\\.\\d{2}/ >> nth=1",
		fallbacks: ['text="CHILD" + text=/\\$\\d+/', ".ticket-type-child .price"],
		textPattern: /CHILD[^$]*\$(\d+\.\d{2})/i,
		description: "Child ticket price",
	} as SelectorConfig,

	/**
	 * Booking fee per ticket
	 * Example: "$1.95" (shows $0.00 until tickets added)
	 */
	bookingFee: {
		primary: 'text="BOOKING FEE" >> .. >> text=/\\$\\d+\\.\\d{2}/',
		fallbacks: ["text=/BOOKING FEE/ + text=/\\$\\d+/"],
		textPattern: /BOOKING FEE[^$]*\$(\d+\.\d{2})/i,
		description: "Booking fee per ticket",
	} as SelectorConfig,

	/**
	 * Total amount display (for verification)
	 */
	total: {
		primary: 'text="TOTAL" >> .. >> text=/\\$\\d+\\.\\d{2}/ >> nth=-1',
		fallbacks: ["text=/^TOTAL$/ + text=/\\$\\d+/"],
		textPattern: /^TOTAL[^$]*\$(\d+\.\d{2})/im,
		description: "Total amount including fees",
	} as SelectorConfig,
} as const;

/**
 * Movie details selectors - for movie detail page metadata
 */
export const MOVIE_DETAIL_SELECTORS = {
	/**
	 * Movie description container
	 */
	descriptionContainer: {
		primary: '.Wysiwyg[itemprop="description"]',
		fallbacks: [
			".movie-description",
			".film-synopsis",
			"[itemprop='description']",
		],
		description: "Movie description container",
	} as SelectorConfig,

	/**
	 * Movie title (h2 in description)
	 */
	title: {
		primary: '.Wysiwyg[itemprop="description"] h2',
		fallbacks: [".movie-title h2", "h1.film-title", "[itemprop='name']"],
		description: "Movie title",
	} as SelectorConfig,

	/**
	 * Metadata container (4th Wysiwyg section)
	 */
	metadataContainer: {
		primary: ".Wysiwyg:nth-of-type(5)", // CSS nth-of-type is 1-indexed
		fallbacks: [".movie-metadata", ".film-details", ".movie-info-section"],
		description: "Movie metadata container",
	} as SelectorConfig,

	/**
	 * Rating (e.g., "PG", "M", "MA15+")
	 */
	rating: {
		primary: 'h3:has-text("Rating") + p',
		fallbacks: [
			".movie-rating",
			"[itemprop='contentRating']",
			".classification",
		],
		textPattern: /Rating[:\s]+([A-Z0-9+]+)/i,
		description: "Movie rating/classification",
	} as SelectorConfig,

	/**
	 * Duration (e.g., "137 min")
	 */
	duration: {
		primary: 'h3:has-text("Duration") + p',
		fallbacks: [".movie-duration", "[itemprop='duration']", ".runtime"],
		textPattern: /Duration[:\s]+(\d+\s*min)/i,
		description: "Movie duration",
	} as SelectorConfig,

	/**
	 * Country (e.g., "USA")
	 */
	country: {
		primary: 'h3:has-text("Country") + p',
		fallbacks: [
			".movie-country",
			"[itemprop='countryOfOrigin']",
			".film-country",
		],
		textPattern: /Country[:\s]+([A-Z]{2,})/i,
		description: "Country of origin",
	} as SelectorConfig,

	/**
	 * Cast (comma-separated)
	 */
	cast: {
		primary: 'h3:has-text("Cast") + p',
		fallbacks: [".movie-cast", "[itemprop='actor']", ".cast-list"],
		textPattern: /Cast[:\s]+(.+)/i,
		description: "Cast members",
	} as SelectorConfig,

	/**
	 * Director
	 */
	director: {
		primary: 'h3:has-text("Director") + p',
		fallbacks: [".movie-director", "[itemprop='director']", ".film-director"],
		textPattern: /Director[:\s]+(.+)/i,
		description: "Movie director",
	} as SelectorConfig,

	/**
	 * Trailer link (YouTube)
	 */
	trailerLink: {
		primary: 'a[href*="youtube"], a[href*="youtu.be"]',
		fallbacks: [".trailer-link", "[data-video-url]", ".watch-trailer"],
		description: "Trailer video link",
	} as SelectorConfig,

	/**
	 * Event links container
	 */
	eventLinks: {
		primary: ".movie-event-links",
		fallbacks: [".event-links", ".related-events", ".film-events"],
		description: "Related event links",
	} as SelectorConfig,
} as const;

/**
 * Session details selectors - for ticket booking page
 *
 * The Classic Cinemas ticket page displays session info in a hero section
 * without semantic data attributes. We use text-based matching.
 */
export const SESSION_SELECTORS = {
	/**
	 * Screen number (e.g., "Screen 9")
	 * On the page, this appears as plain text below the date/time
	 */
	screenNumber: {
		primary: "text=/Screen \\d+/",
		fallbacks: [
			"h1 + * + *", // Third element after h1 in hero
			".screen-number",
			'[aria-label*="Screen"]',
		],
		textPattern: /Screen\s+(\d+)/i,
		description: "Cinema screen number",
	} as SelectorConfig,

	/**
	 * Full session date and time (e.g., "30 Nov 2025, 2:50pm-5:27pm")
	 * On the page, this appears below the movie title h1
	 */
	dateTime: {
		primary: "text=/\\d{1,2} [A-Z][a-z]{2} \\d{4}, \\d{1,2}:\\d{2}[ap]m/",
		fallbacks: [
			"h1 + *", // Element right after h1 in hero
			".session-datetime",
			"[datetime]",
		],
		textPattern:
			/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s+\d{1,2}:\d{2}[ap]m.*\d{1,2}:\d{2}[ap]m)/i,
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
