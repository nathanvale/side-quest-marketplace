/**
 * JSON formatters for CLI output
 *
 * Formats scraping responses into consistent JSON structures for machine parsing.
 */

import type { Movie, SeatMap, TicketType } from "./scraper.ts";

/**
 * Selector usage tracking for debugging
 */
export interface SelectorsUsed {
	[key: string]: string;
}

/**
 * Movie scraping response format
 */
export interface MoviesResponse {
	/** List of movies showing today */
	movies: Movie[];
	/** Which selectors worked for debugging */
	selectorsUsed: SelectorsUsed;
}

/**
 * Session scraping response format
 */
export interface SessionResponse {
	/** Screen number (e.g., "Screen 3") */
	screenNumber: string | null;
	/** Session date and time (e.g., "Fri 29 Nov, 08:15PM") */
	dateTime: string | null;
	/** Which selectors worked for debugging */
	selectorsUsed: SelectorsUsed;
}

/**
 * Pricing scraping response format
 */
export interface PricingResponse {
	/** All available ticket types with prices */
	ticketTypes: TicketType[];
	/** Booking fee per ticket in dollars (e.g., "1.95") */
	bookingFee: string | null;
	/** Which selectors worked for debugging */
	selectorsUsed: SelectorsUsed;
}

/**
 * Movie details scraping response format
 */
export interface MovieDetailsResponse {
	/** Movie title */
	title: string;
	/** Movie description/synopsis */
	description: string;
	/** YouTube trailer URL (e.g., "https://www.youtube.com.au/watch?v=...") */
	trailerUrl: string | null;
	/** Rating (e.g., "PG", "M", "MA15+") */
	rating: string | null;
	/** Duration (e.g., "137 min") */
	duration: string | null;
	/** Country (e.g., "USA") */
	country: string | null;
	/** Cast (comma-separated) */
	cast: string | null;
	/** Director */
	director: string | null;
	/** Event links */
	eventLinks: Array<{ name: string; url: string }>;
	/** Which selectors worked for debugging */
	selectorsUsed: SelectorsUsed;
}

/**
 * Formats movie scraping data for JSON output
 *
 * @param movies - Array of scraped movies
 * @param selectorsUsed - Which selectors worked for each field
 * @returns Formatted response ready for JSON.stringify()
 */
export function formatMoviesResponse(
	movies: Movie[],
	selectorsUsed: SelectorsUsed,
): MoviesResponse {
	return {
		movies,
		selectorsUsed,
	};
}

/**
 * Formats session scraping data for JSON output
 *
 * @param session - Scraped session details
 * @param selectorsUsed - Which selectors worked for each field
 * @returns Formatted response ready for JSON.stringify()
 */
export function formatSessionResponse(
	session: {
		screenNumber: string | null;
		dateTime: string | null;
	},
	selectorsUsed: SelectorsUsed,
): SessionResponse {
	return {
		screenNumber: session.screenNumber,
		dateTime: session.dateTime,
		selectorsUsed,
	};
}

/**
 * Formats pricing scraping data for JSON output
 *
 * @param pricing - Scraped pricing data
 * @param selectorsUsed - Which selectors worked for each field
 * @returns Formatted response ready for JSON.stringify()
 */
export function formatPricingResponse(
	pricing: {
		ticketTypes: TicketType[];
		bookingFee: string | null;
	},
	selectorsUsed: SelectorsUsed,
): PricingResponse {
	return {
		ticketTypes: pricing.ticketTypes,
		bookingFee: pricing.bookingFee,
		selectorsUsed,
	};
}

/**
 * Formats movie details scraping data for JSON output
 *
 * @param details - Scraped movie details
 * @param selectorsUsed - Which selectors worked for each field
 * @returns Formatted response ready for JSON.stringify()
 */
export function formatMovieDetailsResponse(
	details: {
		title: string;
		description: string;
		trailerUrl: string | null;
		rating: string | null;
		duration: string | null;
		country: string | null;
		cast: string | null;
		director: string | null;
		eventLinks: Array<{ name: string; url: string }>;
	},
	selectorsUsed: SelectorsUsed,
): MovieDetailsResponse {
	return {
		title: details.title,
		description: details.description,
		trailerUrl: details.trailerUrl,
		rating: details.rating,
		duration: details.duration,
		country: details.country,
		cast: details.cast,
		director: details.director,
		eventLinks: details.eventLinks,
		selectorsUsed,
	};
}

/**
 * Seat map scraping response format
 */
export interface SeatMapResponse {
	/** Seat map with organized rows */
	seatMap: SeatMap;
	/** Which selectors worked for debugging */
	selectorsUsed: SelectorsUsed;
}

/**
 * Formats seat map scraping data for JSON output
 *
 * @param seatMap - Scraped seat map data
 * @param selectorsUsed - Which selectors worked for each field
 * @returns Formatted response ready for JSON.stringify()
 */
export function formatSeatsResponse(
	seatMap: SeatMap,
	selectorsUsed: SelectorsUsed,
): SeatMapResponse {
	return {
		seatMap,
		selectorsUsed,
	};
}

/**
 * Renders seat map as ASCII art for visual display
 *
 * @param seatMap - Seat map data to visualize
 * @returns ASCII art string representation of the theater
 *
 * @example
 * ```
 * SCREEN 9
 * ═══════════════════════════════════════════
 *
 * A  [ 1] [ 2] [ 3] [ 4] [ 5] [ 6] [ 7] [ 8] [ 9] [10] [11]
 * B  [ 1] [ 2] [ 3] [ 4] [ 5] [ 6] [ 7] [ 8] [ 9] [10] [11]
 * ...
 * F  [ 1] [ 2] [ 3] [ 4] [W5] [W6] [W7]
 *
 * Legend: [ ] Available  [X] Taken  [W] Wheelchair
 * Available: 68 / 70 seats
 * ```
 */
export function renderSeatMap(seatMap: SeatMap): string {
	const lines: string[] = [];

	// Header
	lines.push(seatMap.screenNumber.toUpperCase());
	lines.push("═".repeat(50));
	lines.push("");

	// Get all row letters sorted
	const rowLetters = Object.keys(seatMap.rows).sort();

	// Render each row
	for (const rowLetter of rowLetters) {
		const seats = seatMap.rows[rowLetter];
		if (!seats || seats.length === 0) continue;

		// Build row string
		const rowParts: string[] = [rowLetter.padEnd(2)];

		// Sort seats by number
		const sortedSeats = [...seats].sort((a, b) => a.number - b.number);

		for (const seat of sortedSeats) {
			let symbol: string;
			const paddedNumber = seat.number.toString().padStart(2, "0");

			if (!seat.available) {
				// Taken seat
				symbol = `[XX]`;
			} else if (seat.wheelchair) {
				// Wheelchair accessible
				symbol = `[W${paddedNumber}]`;
			} else {
				// Available seat
				symbol = `[${paddedNumber}]`;
			}

			rowParts.push(symbol);
		}

		lines.push(rowParts.join(" "));
	}

	// Legend and stats
	lines.push("");
	lines.push("Legend: [ ] Available  [X] Taken  [W] Wheelchair");
	lines.push(
		`Available: ${seatMap.availableCount} / ${seatMap.totalSeats} seats`,
	);

	return lines.join("\n");
}
