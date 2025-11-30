/**
 * Classic Cinemas web scraper types
 *
 * TypeScript types for Classic Cinemas website data.
 * Scraping is performed by Playwright-based CLI (src/cli.ts).
 *
 * @packageDocumentation
 */

/**
 * Session time information from homepage
 */
export interface SessionTime {
	/** Session time in format "4:15 PM" */
	time: string;
	/** Session ID extracted from URL (e.g., "116001") */
	sessionId: string;
	/** Full ticket URL (e.g., "/tickets?c=0000000002&s=116001") */
	ticketUrl?: string;
}

/**
 * Movie information from homepage
 */
export interface Movie {
	/** Movie title */
	title: string;
	/** Rating (e.g., "PG", "M", "MA15+") */
	rating: string;
	/** Thumbnail image URL */
	thumbnail: string;
	/** Full movie detail page URL (e.g., "https://www.classiccinemas.com.au/movies/wicked-for-good") */
	movieUrl: string;
	/** Movie slug (e.g., "wicked-for-good") */
	slug: string;
	/** Available session times */
	sessionTimes: SessionTime[];
}

/**
 * Detailed session information from ticket page
 */
export interface SessionDetails {
	/** Screen number (e.g., "Screen 1") */
	screenNumber: string;
	/** Full date and time (e.g., "29 Nov 2025, 4:15pm-6:52pm") */
	fullDateTime: string;
}

/**
 * Event link associated with a movie
 */
export interface MovieEventLink {
	/** Event name (e.g., "BYO Baby at Classic") */
	name: string;
	/** Event URL (e.g., "/events/byo-baby-at-classic") */
	url: string;
}

/**
 * Detailed movie information from movie detail page
 */
export interface MovieDetails {
	/** Movie title */
	title: string;
	/** Movie description/synopsis */
	description: string;
	/** YouTube trailer URL */
	trailerUrl: string | null;
	/** Rating (e.g., "PG", "M", "MA15+") */
	rating: string | null;
	/** Duration in minutes as string (e.g., "137 min") */
	duration: string | null;
	/** Country of origin (e.g., "USA") */
	country: string | null;
	/** Cast members (comma-separated) */
	cast: string | null;
	/** Director name(s) */
	director: string | null;
	/** Associated event links */
	eventLinks: MovieEventLink[];
}

/**
 * Helper function to parse session ID from Classic Cinemas ticket URL
 *
 * @param url - Ticket URL (e.g., "/tickets?c=0000000002&s=116001")
 * @returns Session ID or null if not found
 *
 * @example
 * ```typescript
 * const sessionId = parseSessionId("/tickets?c=0000000002&s=116001");
 * console.log(sessionId); // "116001"
 * ```
 */
export function parseSessionId(url: string): string | null {
	const match = url.match(/[?&]s=(\d+)/);
	return match?.[1] ?? null;
}

/**
 * Helper function to format ticket URL for a given session ID
 *
 * @param sessionId - Session ID (e.g., "116001")
 * @returns Full ticket URL
 *
 * @example
 * ```typescript
 * const url = getTicketUrl("116001");
 * console.log(url);
 * // "https://www.classiccinemas.com.au/tickets?c=0000000002&s=116001"
 * ```
 */
export function getTicketUrl(sessionId: string): string {
	const TICKET_BASE = "https://www.classiccinemas.com.au/tickets?c=0000000002";
	return `${TICKET_BASE}&s=${sessionId}`;
}

/**
 * Validates a Movie object has all required fields
 *
 * @param movie - Movie object to validate
 * @returns true if valid, false otherwise
 */
export function isValidMovie(movie: unknown): movie is Movie {
	if (typeof movie !== "object" || movie === null) return false;

	const m = movie as Record<string, unknown>;

	return (
		typeof m.title === "string" &&
		m.title.length > 0 &&
		typeof m.rating === "string" &&
		typeof m.thumbnail === "string" &&
		Array.isArray(m.sessionTimes) &&
		m.sessionTimes.every(
			(st: unknown) =>
				typeof st === "object" &&
				st !== null &&
				typeof (st as Record<string, unknown>).time === "string" &&
				typeof (st as Record<string, unknown>).sessionId === "string",
		)
	);
}

/**
 * Validates a SessionDetails object has all required fields
 *
 * @param details - SessionDetails object to validate
 * @returns true if valid, false otherwise
 */
export function isValidSessionDetails(
	details: unknown,
): details is SessionDetails {
	if (typeof details !== "object" || details === null) return false;

	const d = details as Record<string, unknown>;

	return (
		typeof d.screenNumber === "string" &&
		d.screenNumber.length > 0 &&
		typeof d.fullDateTime === "string" &&
		d.fullDateTime.length > 0
	);
}
