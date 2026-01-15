/**
 * Deterministic Google Maps place extractor.
 *
 * Extracts place details from Google Maps URLs and Web Clipper content
 * without requiring LLM calls. This is faster, cheaper, and more reliable
 * than LLM-based extraction for structured Google Maps data.
 *
 * Extraction sources:
 * 1. URL: Place name, coordinates
 * 2. Content: Place name (## heading), hours, rating, website
 *
 * @module inbox/process/google-maps-extractor
 */

/**
 * Place details extracted from Google Maps.
 */
export interface GoogleMapsPlaceDetails {
	/** Place name */
	readonly name: string;
	/** Latitude */
	readonly lat?: number;
	/** Longitude */
	readonly lng?: number;
	/** Suburb extracted from place name or address */
	readonly suburb?: string;
	/** Category (park, garden, beach, museum, etc.) */
	readonly category?: string;
	/** Opening hours */
	readonly hours?: string;
	/** Rating (0-5) */
	readonly rating?: number;
	/** Review count */
	readonly reviewCount?: number;
	/** Website URL (non-Google) */
	readonly website?: string;
}

/**
 * Check if a URL is a Google Maps place URL.
 *
 * @param url - URL to check
 * @returns True if this is a Google Maps place URL
 */
export function isGoogleMapsUrl(url: string): boolean {
	return /google\.com\/maps\/place\//i.test(url);
}

/**
 * Extract place name from Google Maps URL.
 *
 * URL format: https://www.google.com/maps/place/Place+Name/@lat,lng,zoom
 *
 * @param url - Google Maps URL
 * @returns Place name or null if not found
 *
 * @example
 * ```typescript
 * extractPlaceNameFromUrl("https://www.google.com/maps/place/Paddington+Reservoir+Gardens/@-33.88,151.22")
 * // => "Paddington Reservoir Gardens"
 * ```
 */
export function extractPlaceNameFromUrl(url: string): string | null {
	// Match /place/Place+Name/ or /place/Place+Name/@
	const match = url.match(/\/place\/([^/@]+)/);
	if (!match?.[1]) return null;

	// URL decode and replace + with spaces
	return decodeURIComponent(match[1].replace(/\+/g, " "));
}

/**
 * Extract coordinates from Google Maps URL.
 *
 * URL format: https://www.google.com/maps/place/.../@lat,lng,zoom
 *
 * @param url - Google Maps URL
 * @returns Coordinates or null if not found
 */
export function extractCoordsFromUrl(
	url: string,
): { lat: number; lng: number } | null {
	// Match @lat,lng pattern
	const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
	if (!match?.[1] || !match?.[2]) return null;

	const lat = Number.parseFloat(match[1]);
	const lng = Number.parseFloat(match[2]);

	if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

	return { lat, lng };
}

/**
 * Extract place name from Web Clipper content.
 *
 * Google Maps pages have the place name as a ## heading after the logo image
 * and before any review counts or sponsored content.
 *
 * @param content - Web Clipper markdown content
 * @returns Place name or null if not found
 */
export function extractPlaceNameFromContent(content: string): string | null {
	// Split into lines and find the first ## heading that's not a known section
	const knownSections = [
		"content",
		"why i saved this",
		"sponsoredby",
		"tours and activities",
		"photos and videos",
		"review summary",
		"people also search for",
		"reviews",
		"notes",
	];

	const lines = content.split("\n");
	for (const line of lines) {
		const headingMatch = line.match(/^##\s+(.+)$/);
		if (headingMatch?.[1]) {
			const heading = headingMatch[1].trim();
			const lowerHeading = heading.toLowerCase();

			// Skip known section headings
			if (knownSections.some((section) => lowerHeading.startsWith(section))) {
				continue;
			}

			// This should be the place name
			return heading;
		}
	}

	return null;
}

/**
 * Extract rating from content.
 *
 * Google Maps shows rating as a number (e.g., "4.5") near the review summary.
 *
 * @param content - Web Clipper markdown content
 * @returns Rating (0-5) or undefined
 */
export function extractRating(content: string): number | undefined {
	// Look for a standalone decimal number between 1-5 (the rating)
	// Usually appears after the review summary table
	const ratingMatch = content.match(
		/## Review summary[\s\S]*?\n\n([1-5]\.?\d?)\n/,
	);
	if (ratingMatch?.[1]) {
		const rating = Number.parseFloat(ratingMatch[1]);
		if (!Number.isNaN(rating) && rating >= 1 && rating <= 5) {
			return rating;
		}
	}
	return undefined;
}

/**
 * Extract review count from content.
 *
 * Usually appears as "(N)" or "(N,NNN)" after the place name.
 *
 * @param content - Web Clipper markdown content
 * @returns Review count or undefined
 */
export function extractReviewCount(content: string): number | undefined {
	// Look for (N) or (N,NNN) pattern
	const countMatch = content.match(/\(([0-9,]+)\)/);
	if (countMatch?.[1]) {
		const count = Number.parseInt(countMatch[1].replace(/,/g, ""), 10);
		if (!Number.isNaN(count)) {
			return count;
		}
	}
	return undefined;
}

/**
 * Extract website URL from content.
 *
 * Looks for non-Google links that appear to be the place's website.
 *
 * @param content - Web Clipper markdown content
 * @returns Website URL or undefined
 */
export function extractWebsite(content: string): string | undefined {
	// Find markdown links that aren't Google/Maps related
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	const matches = content.matchAll(linkPattern);

	for (const match of matches) {
		const url = match[2];
		if (!url) continue;

		// Skip Google links, tracking links, image links
		if (
			url.includes("google.com") ||
			url.includes("gstatic.com") ||
			url.includes("aclk?") ||
			url.includes("encrypted-tbn")
		) {
			continue;
		}
		// Skip Viator/Tripadvisor/tour booking links
		if (
			url.includes("viator.com") ||
			url.includes("tripadvisor.com") ||
			url.includes("evendo.com") ||
			url.includes("agoda.com")
		) {
			continue;
		}
		// This is likely the place's website
		return url;
	}
	return undefined;
}

/**
 * Extract hours from content.
 *
 * Google Maps shows hours in a table format with days and times.
 *
 * @param content - Web Clipper markdown content
 * @returns Hours string or undefined
 */
export function extractHours(content: string): string | undefined {
	// Look for "Open · Closes X pm" pattern
	const openMatch = content.match(/Open\s*·\s*Closes\s+(\d+\s*[ap]m)/i);
	if (openMatch?.[1]) {
		return `Open until ${openMatch[1]}`;
	}

	// Or extract from table (first row usually has typical hours)
	const tableMatch = content.match(
		/\|\s*\w+day\s*\|\s*-?\s*(\d+\s*[ap]m\s*[–-]\s*\d+\s*[ap]m)/i,
	);
	if (tableMatch?.[1]) {
		return tableMatch[1].replace(/\s+/g, " ").trim();
	}

	return undefined;
}

/**
 * Infer suburb from place name.
 *
 * Many place names include the suburb (e.g., "Paddington Reservoir Gardens").
 *
 * @param placeName - Place name
 * @returns Suburb or undefined
 */
export function inferSuburb(placeName: string): string | undefined {
	// Common Sydney suburbs that might appear in place names
	const suburbs = [
		"Paddington",
		"Woollahra",
		"Bondi",
		"Coogee",
		"Manly",
		"Surry Hills",
		"Newtown",
		"Glebe",
		"Balmain",
		"Darlinghurst",
		"Potts Point",
		"Mosman",
		"Neutral Bay",
		"Cremorne",
		"Kirribilli",
		"Vaucluse",
		"Rose Bay",
		"Double Bay",
		"Edgecliff",
		"Rushcutters Bay",
		"Elizabeth Bay",
		"Woolloomooloo",
		"Pyrmont",
		"Ultimo",
		"Chippendale",
		"Redfern",
		"Alexandria",
		"Waterloo",
		"Zetland",
		"Erskineville",
		"St Peters",
		"Marrickville",
		"Enmore",
		"Stanmore",
		"Leichhardt",
		"Annandale",
		"Rozelle",
		"Lilyfield",
		"Drummoyne",
		"Five Dock",
		"Haberfield",
		"Ashfield",
		"Summer Hill",
		"Lewisham",
		"Petersham",
		"Camperdown",
	];

	const lowerName = placeName.toLowerCase();
	for (const suburb of suburbs) {
		if (lowerName.includes(suburb.toLowerCase())) {
			return suburb;
		}
	}

	return undefined;
}

/**
 * Infer category from place name and content.
 *
 * @param placeName - Place name
 * @param content - Web Clipper content
 * @returns Category or undefined
 */
export function inferCategory(
	placeName: string,
	content: string,
): string | undefined {
	const combined = `${placeName} ${content}`.toLowerCase();

	// Check for category keywords
	if (/\b(garden|gardens|botanical)\b/.test(combined)) return "garden";
	if (/\b(park|reserve|oval)\b/.test(combined)) return "park";
	if (/\b(beach|bay|cove)\b/.test(combined)) return "beach";
	if (/\b(museum|gallery|exhibition)\b/.test(combined)) return "museum";
	if (/\b(pool|aquatic|swimming)\b/.test(combined)) return "pool";
	if (/\b(library)\b/.test(combined)) return "library";
	if (/\b(cafe|coffee)\b/.test(combined)) return "cafe";
	if (/\b(restaurant|ristorante|bistro)\b/.test(combined)) return "restaurant";
	if (/\b(bar|pub|tavern)\b/.test(combined)) return "bar";
	if (/\b(theatre|theater|cinema)\b/.test(combined)) return "theatre";
	if (/\b(church|cathedral|temple|mosque|synagogue)\b/.test(combined))
		return "place of worship";
	if (/\b(hospital|medical|clinic)\b/.test(combined)) return "medical";
	if (/\b(school|university|college)\b/.test(combined)) return "education";
	if (/\b(station|terminal)\b/.test(combined)) return "transport";
	if (/\b(lookout|viewpoint|outlook)\b/.test(combined)) return "lookout";
	if (/\b(trail|walk|track)\b/.test(combined)) return "walking trail";

	return "attraction"; // Default for places
}

/**
 * Extract all place details from a Google Maps URL and content.
 *
 * This is the main entry point - combines URL and content extraction
 * to build a complete place profile without LLM calls.
 *
 * @param url - Google Maps URL
 * @param content - Web Clipper markdown content
 * @returns Place details
 *
 * @example
 * ```typescript
 * const details = extractGoogleMapsPlace(
 *   "https://www.google.com/maps/place/Paddington+Reservoir+Gardens/@-33.88,151.22",
 *   clipperContent
 * );
 * // => { name: "Paddington Reservoir Gardens", suburb: "Paddington", category: "garden", ... }
 * ```
 */
export function extractGoogleMapsPlace(
	url: string,
	content: string,
): GoogleMapsPlaceDetails | null {
	// Extract place name - prefer content (more accurate), fall back to URL
	const nameFromContent = extractPlaceNameFromContent(content);
	const nameFromUrl = extractPlaceNameFromUrl(url);
	const name = nameFromContent || nameFromUrl;

	if (!name) {
		return null;
	}

	// Extract coordinates from URL
	const coords = extractCoordsFromUrl(url);

	// Extract other details from content
	const suburb = inferSuburb(name);
	const category = inferCategory(name, content);
	const hours = extractHours(content);
	const rating = extractRating(content);
	const reviewCount = extractReviewCount(content);
	const website = extractWebsite(content);

	return {
		name,
		lat: coords?.lat,
		lng: coords?.lng,
		suburb,
		category,
		hours,
		rating,
		reviewCount,
		website,
	};
}
