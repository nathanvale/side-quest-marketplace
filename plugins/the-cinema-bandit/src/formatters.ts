/**
 * JSON formatters for CLI output
 *
 * Formats scraping responses into consistent JSON structures for machine parsing.
 */

import type { Movie } from "./scraper.ts";

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
	/** Adult ticket price in dollars (e.g., "27.00") */
	adultPrice: string | null;
	/** Child/concession ticket price in dollars (e.g., "21.00") */
	childPrice: string | null;
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
		adultPrice: string | null;
		childPrice: string | null;
		bookingFee: string | null;
	},
	selectorsUsed: SelectorsUsed,
): PricingResponse {
	return {
		adultPrice: pricing.adultPrice,
		childPrice: pricing.childPrice,
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
