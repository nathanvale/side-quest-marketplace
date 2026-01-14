/**
 * Geographic and maps utilities
 *
 * Provides utilities for working with map URLs and coordinates.
 * Supports Google Maps and Apple Maps URL parsing and generation.
 *
 * @example
 * ```ts
 * import {
 *   extractCoordsFromGoogleMaps,
 *   generateAppleMapsUrl,
 *   generateGoogleMapsUrl,
 *   parseMapUrl
 * } from "@sidequest/core/geo";
 *
 * // Extract coordinates from Google Maps URL
 * const coords = extractCoordsFromGoogleMaps(
 *   "https://www.google.com/maps/place/.../@-33.8567844,151.2127164,17z/..."
 * );
 * // { lat: -33.8567844, lng: 151.2127164 }
 *
 * // Generate Apple Maps URL (opens in Maps app on iOS/macOS)
 * const appleMapsUrl = generateAppleMapsUrl(-33.8567844, 151.2127164, "Sydney Opera House");
 * // "maps://?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House"
 *
 * // Generate Google Maps URL
 * const googleMapsUrl = generateGoogleMapsUrl(-33.8567844, 151.2127164, "Sydney Opera House");
 * // "https://www.google.com/maps/search/?api=1&query=-33.8567844,151.2127164&query_place_id=Sydney%20Opera%20House"
 * ```
 *
 * @module geo
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Geographic coordinates (latitude and longitude)
 */
export interface Coordinates {
	/** Latitude (-90 to 90) */
	readonly lat: number;
	/** Longitude (-180 to 180) */
	readonly lng: number;
}

/**
 * Parsed map URL result
 */
export interface ParsedMapUrl {
	/** Detected map provider */
	readonly provider: "google" | "apple" | "unknown";
	/** Extracted coordinates (if found) */
	readonly coordinates: Coordinates | null;
	/** Place name (if found in URL) */
	readonly placeName: string | null;
	/** Original URL */
	readonly originalUrl: string;
}

// ============================================================================
// Coordinate Extraction
// ============================================================================

/**
 * Extract coordinates from a Google Maps URL.
 *
 * Looks for the `@lat,lng` pattern commonly found in Google Maps URLs.
 * Supports various Google Maps URL formats including place, search, and embed URLs.
 *
 * @param url - Google Maps URL
 * @returns Coordinates object or null if not found
 *
 * @example
 * ```ts
 * // Standard place URL
 * extractCoordsFromGoogleMaps(
 *   "https://www.google.com/maps/place/Sydney+Opera+House/@-33.8567844,151.2127164,17z/..."
 * );
 * // { lat: -33.8567844, lng: 151.2127164 }
 *
 * // Shortened URL with coordinates
 * extractCoordsFromGoogleMaps("https://maps.google.com/?q=-33.8567844,151.2127164");
 * // { lat: -33.8567844, lng: 151.2127164 }
 *
 * // URL without coordinates
 * extractCoordsFromGoogleMaps("https://www.google.com/maps/place/Sydney");
 * // null
 * ```
 */
export function extractCoordsFromGoogleMaps(url: string): Coordinates | null {
	// Pattern 1: @lat,lng in the URL path (most common)
	const atPattern = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
	if (atPattern?.[1] && atPattern?.[2]) {
		const lat = Number.parseFloat(atPattern[1]);
		const lng = Number.parseFloat(atPattern[2]);
		if (isValidCoordinate(lat, lng)) {
			return { lat, lng };
		}
	}

	// Pattern 2: ?q=lat,lng or &q=lat,lng (search/query format)
	const queryPattern = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
	if (queryPattern?.[1] && queryPattern?.[2]) {
		const lat = Number.parseFloat(queryPattern[1]);
		const lng = Number.parseFloat(queryPattern[2]);
		if (isValidCoordinate(lat, lng)) {
			return { lat, lng };
		}
	}

	// Pattern 3: ll=lat,lng (legacy format)
	const llPattern = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
	if (llPattern?.[1] && llPattern?.[2]) {
		const lat = Number.parseFloat(llPattern[1]);
		const lng = Number.parseFloat(llPattern[2]);
		if (isValidCoordinate(lat, lng)) {
			return { lat, lng };
		}
	}

	return null;
}

/**
 * Extract coordinates from an Apple Maps URL.
 *
 * Supports both `maps://` (iOS/macOS app) and `https://maps.apple.com/` URLs.
 *
 * @param url - Apple Maps URL
 * @returns Coordinates object or null if not found
 *
 * @example
 * ```ts
 * // maps:// scheme (opens in Maps app)
 * extractCoordsFromAppleMaps("maps://?ll=-33.8567844,151.2127164&q=Sydney");
 * // { lat: -33.8567844, lng: 151.2127164 }
 *
 * // https:// scheme
 * extractCoordsFromAppleMaps("https://maps.apple.com/?ll=-33.8567844,151.2127164");
 * // { lat: -33.8567844, lng: 151.2127164 }
 * ```
 */
export function extractCoordsFromAppleMaps(url: string): Coordinates | null {
	// Pattern: ll=lat,lng (Apple Maps standard format)
	const llPattern = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
	if (llPattern?.[1] && llPattern?.[2]) {
		const lat = Number.parseFloat(llPattern[1]);
		const lng = Number.parseFloat(llPattern[2]);
		if (isValidCoordinate(lat, lng)) {
			return { lat, lng };
		}
	}

	// Pattern: sll=lat,lng (search location)
	const sllPattern = url.match(/[?&]sll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
	if (sllPattern?.[1] && sllPattern?.[2]) {
		const lat = Number.parseFloat(sllPattern[1]);
		const lng = Number.parseFloat(sllPattern[2]);
		if (isValidCoordinate(lat, lng)) {
			return { lat, lng };
		}
	}

	return null;
}

// ============================================================================
// URL Generation
// ============================================================================

/**
 * Generate an Apple Maps URL from coordinates.
 *
 * Uses the `maps://` scheme which opens directly in the Maps app on iOS and macOS.
 * Falls back to browser on non-Apple platforms.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param placeName - Optional place name for the pin label
 * @returns Apple Maps URL with maps:// scheme
 *
 * @example
 * ```ts
 * // With place name
 * generateAppleMapsUrl(-33.8567844, 151.2127164, "Sydney Opera House");
 * // "maps://?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House"
 *
 * // Without place name
 * generateAppleMapsUrl(-33.8567844, 151.2127164);
 * // "maps://?ll=-33.8567844,151.2127164"
 * ```
 */
export function generateAppleMapsUrl(
	lat: number,
	lng: number,
	placeName?: string,
): string {
	const query = placeName ? `&q=${encodeURIComponent(placeName)}` : "";
	return `maps://?ll=${lat},${lng}${query}`;
}

/**
 * Generate an Apple Maps web URL (https://).
 *
 * Uses the `https://maps.apple.com/` URL which works in browsers
 * and also opens the Maps app on Apple devices.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param placeName - Optional place name for the pin label
 * @returns Apple Maps web URL
 *
 * @example
 * ```ts
 * generateAppleMapsWebUrl(-33.8567844, 151.2127164, "Sydney Opera House");
 * // "https://maps.apple.com/?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House"
 * ```
 */
export function generateAppleMapsWebUrl(
	lat: number,
	lng: number,
	placeName?: string,
): string {
	const query = placeName ? `&q=${encodeURIComponent(placeName)}` : "";
	return `https://maps.apple.com/?ll=${lat},${lng}${query}`;
}

/**
 * Generate a Google Maps URL from coordinates.
 *
 * Uses the Google Maps Search API URL format which works in browsers
 * and opens the Google Maps app on mobile devices.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param placeName - Optional place name for search context
 * @returns Google Maps URL
 *
 * @example
 * ```ts
 * // With place name
 * generateGoogleMapsUrl(-33.8567844, 151.2127164, "Sydney Opera House");
 * // "https://www.google.com/maps/search/?api=1&query=-33.8567844,151.2127164"
 *
 * // Without place name
 * generateGoogleMapsUrl(-33.8567844, 151.2127164);
 * // "https://www.google.com/maps/search/?api=1&query=-33.8567844,151.2127164"
 * ```
 */
export function generateGoogleMapsUrl(
	lat: number,
	lng: number,
	_placeName?: string,
): string {
	// Using search API format - most reliable for opening in app
	return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Generate a Google Maps URL with a place search query.
 *
 * Useful when you have a place name but no coordinates.
 *
 * @param placeName - Name of the place to search
 * @returns Google Maps search URL
 *
 * @example
 * ```ts
 * generateGoogleMapsSearchUrl("Sydney Opera House");
 * // "https://www.google.com/maps/search/?api=1&query=Sydney%20Opera%20House"
 * ```
 */
export function generateGoogleMapsSearchUrl(placeName: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
}

/**
 * Generate an Apple Maps URL with a search query (no coordinates needed).
 *
 * Uses the `https://maps.apple.com/` URL with just a query parameter,
 * which works in browsers and opens the Maps app on Apple devices.
 *
 * @param placeName - Name or address to search
 * @returns Apple Maps search URL
 *
 * @example
 * ```ts
 * generateAppleMapsSearchUrl("3 Jersey Rd, Woollahra");
 * // "https://maps.apple.com/?q=3%20Jersey%20Rd%2C%20Woollahra"
 *
 * generateAppleMapsSearchUrl("Sydney Opera House");
 * // "https://maps.apple.com/?q=Sydney%20Opera%20House"
 * ```
 */
export function generateAppleMapsSearchUrl(placeName: string): string {
	return `https://maps.apple.com/?q=${encodeURIComponent(placeName)}`;
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Parse any map URL and extract coordinates and metadata.
 *
 * Automatically detects whether the URL is from Google Maps or Apple Maps
 * and extracts available information.
 *
 * @param url - Map URL (Google Maps or Apple Maps)
 * @returns Parsed map URL information
 *
 * @example
 * ```ts
 * // Google Maps URL
 * parseMapUrl("https://www.google.com/maps/place/Sydney+Opera+House/@-33.8567844,151.2127164,17z/...");
 * // {
 * //   provider: "google",
 * //   coordinates: { lat: -33.8567844, lng: 151.2127164 },
 * //   placeName: "Sydney Opera House",
 * //   originalUrl: "..."
 * // }
 *
 * // Apple Maps URL
 * parseMapUrl("maps://?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House");
 * // {
 * //   provider: "apple",
 * //   coordinates: { lat: -33.8567844, lng: 151.2127164 },
 * //   placeName: "Sydney Opera House",
 * //   originalUrl: "..."
 * // }
 * ```
 */
export function parseMapUrl(url: string): ParsedMapUrl {
	const result: ParsedMapUrl = {
		provider: "unknown",
		coordinates: null,
		placeName: null,
		originalUrl: url,
	};

	// Detect provider and extract coordinates
	if (isGoogleMapsUrl(url)) {
		return {
			...result,
			provider: "google",
			coordinates: extractCoordsFromGoogleMaps(url),
			placeName: extractPlaceNameFromGoogleMaps(url),
		};
	}

	if (isAppleMapsUrl(url)) {
		return {
			...result,
			provider: "apple",
			coordinates: extractCoordsFromAppleMaps(url),
			placeName: extractPlaceNameFromAppleMaps(url),
		};
	}

	return result;
}

// ============================================================================
// URL Detection
// ============================================================================

/**
 * Check if a URL is a Google Maps URL.
 *
 * @param url - URL to check
 * @returns True if the URL is a Google Maps URL
 *
 * @example
 * ```ts
 * isGoogleMapsUrl("https://www.google.com/maps/place/Sydney"); // true
 * isGoogleMapsUrl("https://maps.google.com/?q=Sydney"); // true
 * isGoogleMapsUrl("https://example.com"); // false
 * ```
 */
export function isGoogleMapsUrl(url: string): boolean {
	return /google\.com\/maps|maps\.google\./i.test(url);
}

/**
 * Check if a URL is an Apple Maps URL.
 *
 * @param url - URL to check
 * @returns True if the URL is an Apple Maps URL
 *
 * @example
 * ```ts
 * isAppleMapsUrl("maps://?ll=-33.8567844,151.2127164"); // true
 * isAppleMapsUrl("https://maps.apple.com/?ll=-33.8567844,151.2127164"); // true
 * isAppleMapsUrl("https://example.com"); // false
 * ```
 */
export function isAppleMapsUrl(url: string): boolean {
	return /^maps:\/\/|maps\.apple\.com/i.test(url);
}

/**
 * Check if a URL is any supported map URL (Google or Apple).
 *
 * @param url - URL to check
 * @returns True if the URL is a map URL
 *
 * @example
 * ```ts
 * isMapUrl("https://www.google.com/maps/place/Sydney"); // true
 * isMapUrl("maps://?ll=-33.8567844,151.2127164"); // true
 * isMapUrl("https://example.com"); // false
 * ```
 */
export function isMapUrl(url: string): boolean {
	return isGoogleMapsUrl(url) || isAppleMapsUrl(url);
}

// ============================================================================
// Coordinate Utilities
// ============================================================================

/**
 * Validate that coordinates are within valid ranges.
 *
 * @param lat - Latitude to validate (-90 to 90)
 * @param lng - Longitude to validate (-180 to 180)
 * @returns True if coordinates are valid
 *
 * @example
 * ```ts
 * isValidCoordinate(-33.8567844, 151.2127164); // true
 * isValidCoordinate(91, 0); // false (lat out of range)
 * isValidCoordinate(0, 181); // false (lng out of range)
 * ```
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
	return (
		!Number.isNaN(lat) &&
		!Number.isNaN(lng) &&
		lat >= -90 &&
		lat <= 90 &&
		lng >= -180 &&
		lng <= 180
	);
}

/**
 * Format coordinates as a human-readable string.
 *
 * @param coords - Coordinates to format
 * @param precision - Decimal places (default: 6)
 * @returns Formatted coordinate string
 *
 * @example
 * ```ts
 * formatCoordinates({ lat: -33.8567844, lng: 151.2127164 });
 * // "-33.856784, 151.212716"
 *
 * formatCoordinates({ lat: -33.8567844, lng: 151.2127164 }, 2);
 * // "-33.86, 151.21"
 * ```
 */
export function formatCoordinates(coords: Coordinates, precision = 6): string {
	return `${coords.lat.toFixed(precision)}, ${coords.lng.toFixed(precision)}`;
}

// ============================================================================
// Helper Functions (internal)
// ============================================================================

/**
 * Extract place name from a Google Maps URL.
 * @internal
 */
function extractPlaceNameFromGoogleMaps(url: string): string | null {
	// Pattern: /place/Place+Name/ in the URL path
	const placeMatch = url.match(/\/place\/([^/@]+)/);
	if (placeMatch?.[1]) {
		return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
	}

	// Pattern: q=Place+Name in query string (if not coordinates)
	const queryMatch = url.match(/[?&]q=([^&]+)/);
	if (queryMatch?.[1]) {
		const decoded = decodeURIComponent(queryMatch[1].replace(/\+/g, " "));
		// Check if it's not just coordinates
		if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(decoded)) {
			return decoded;
		}
	}

	return null;
}

/**
 * Extract place name from an Apple Maps URL.
 * @internal
 */
function extractPlaceNameFromAppleMaps(url: string): string | null {
	// Pattern: q=Place+Name in query string
	const queryMatch = url.match(/[?&]q=([^&]+)/);
	if (queryMatch?.[1]) {
		return decodeURIComponent(queryMatch[1].replace(/\+/g, " "));
	}

	return null;
}
