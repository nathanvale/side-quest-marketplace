import { describe, expect, test } from "bun:test";
import {
	extractCoordsFromAppleMaps,
	extractCoordsFromGoogleMaps,
	formatCoordinates,
	generateAppleMapsUrl,
	generateAppleMapsWebUrl,
	generateGoogleMapsSearchUrl,
	generateGoogleMapsUrl,
	isAppleMapsUrl,
	isGoogleMapsUrl,
	isMapUrl,
	isValidCoordinate,
	parseMapUrl,
} from "./index.ts";

describe("extractCoordsFromGoogleMaps", () => {
	test("extracts coordinates from standard place URL", () => {
		const url =
			"https://www.google.com/maps/place/Sydney+Opera+House/@-33.8567844,151.2127164,17z/data=!3m1!4b1";
		const coords = extractCoordsFromGoogleMaps(url);
		expect(coords).toEqual({ lat: -33.8567844, lng: 151.2127164 });
	});

	test("extracts coordinates from query parameter", () => {
		const url = "https://maps.google.com/?q=-33.8567844,151.2127164";
		const coords = extractCoordsFromGoogleMaps(url);
		expect(coords).toEqual({ lat: -33.8567844, lng: 151.2127164 });
	});

	test("extracts coordinates from ll parameter", () => {
		const url = "https://www.google.com/maps?ll=-33.8567844,151.2127164&z=15";
		const coords = extractCoordsFromGoogleMaps(url);
		expect(coords).toEqual({ lat: -33.8567844, lng: 151.2127164 });
	});

	test("returns null for URL without coordinates", () => {
		const url = "https://www.google.com/maps/place/Sydney";
		const coords = extractCoordsFromGoogleMaps(url);
		expect(coords).toBeNull();
	});

	test("returns null for invalid coordinates", () => {
		const url = "https://www.google.com/maps/@100,200,17z";
		const coords = extractCoordsFromGoogleMaps(url);
		expect(coords).toBeNull();
	});
});

describe("extractCoordsFromAppleMaps", () => {
	test("extracts coordinates from maps:// URL", () => {
		const url = "maps://?ll=-33.8567844,151.2127164&q=Sydney";
		const coords = extractCoordsFromAppleMaps(url);
		expect(coords).toEqual({ lat: -33.8567844, lng: 151.2127164 });
	});

	test("extracts coordinates from https URL", () => {
		const url = "https://maps.apple.com/?ll=-33.8567844,151.2127164";
		const coords = extractCoordsFromAppleMaps(url);
		expect(coords).toEqual({ lat: -33.8567844, lng: 151.2127164 });
	});

	test("extracts coordinates from sll parameter", () => {
		const url = "maps://?sll=-33.8567844,151.2127164&q=Sydney";
		const coords = extractCoordsFromAppleMaps(url);
		expect(coords).toEqual({ lat: -33.8567844, lng: 151.2127164 });
	});

	test("returns null for URL without coordinates", () => {
		const url = "maps://?q=Sydney";
		const coords = extractCoordsFromAppleMaps(url);
		expect(coords).toBeNull();
	});
});

describe("generateAppleMapsUrl", () => {
	test("generates URL with coordinates only", () => {
		const url = generateAppleMapsUrl(-33.8567844, 151.2127164);
		expect(url).toBe("maps://?ll=-33.8567844,151.2127164");
	});

	test("generates URL with place name", () => {
		const url = generateAppleMapsUrl(
			-33.8567844,
			151.2127164,
			"Sydney Opera House",
		);
		expect(url).toBe(
			"maps://?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House",
		);
	});

	test("encodes special characters in place name", () => {
		const url = generateAppleMapsUrl(-33.8567844, 151.2127164, "Joe's Cafe");
		expect(url).toBe("maps://?ll=-33.8567844,151.2127164&q=Joe's%20Cafe");
	});
});

describe("generateAppleMapsWebUrl", () => {
	test("generates https URL", () => {
		const url = generateAppleMapsWebUrl(-33.8567844, 151.2127164);
		expect(url).toBe("https://maps.apple.com/?ll=-33.8567844,151.2127164");
	});

	test("generates https URL with place name", () => {
		const url = generateAppleMapsWebUrl(
			-33.8567844,
			151.2127164,
			"Sydney Opera House",
		);
		expect(url).toBe(
			"https://maps.apple.com/?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House",
		);
	});
});

describe("generateGoogleMapsUrl", () => {
	test("generates search URL with coordinates", () => {
		const url = generateGoogleMapsUrl(-33.8567844, 151.2127164);
		expect(url).toBe(
			"https://www.google.com/maps/search/?api=1&query=-33.8567844,151.2127164",
		);
	});

	test("generates same URL with place name (name not used)", () => {
		const url = generateGoogleMapsUrl(
			-33.8567844,
			151.2127164,
			"Sydney Opera House",
		);
		expect(url).toBe(
			"https://www.google.com/maps/search/?api=1&query=-33.8567844,151.2127164",
		);
	});
});

describe("generateGoogleMapsSearchUrl", () => {
	test("generates search URL with place name", () => {
		const url = generateGoogleMapsSearchUrl("Sydney Opera House");
		expect(url).toBe(
			"https://www.google.com/maps/search/?api=1&query=Sydney%20Opera%20House",
		);
	});

	test("encodes special characters", () => {
		const url = generateGoogleMapsSearchUrl("Joe's Café & Bar");
		expect(url).toBe(
			"https://www.google.com/maps/search/?api=1&query=Joe's%20Caf%C3%A9%20%26%20Bar",
		);
	});
});

describe("parseMapUrl", () => {
	test("parses Google Maps URL", () => {
		const url =
			"https://www.google.com/maps/place/Sydney+Opera+House/@-33.8567844,151.2127164,17z";
		const result = parseMapUrl(url);
		expect(result.provider).toBe("google");
		expect(result.coordinates).toEqual({ lat: -33.8567844, lng: 151.2127164 });
		expect(result.placeName).toBe("Sydney Opera House");
		expect(result.originalUrl).toBe(url);
	});

	test("parses Apple Maps URL", () => {
		const url = "maps://?ll=-33.8567844,151.2127164&q=Sydney%20Opera%20House";
		const result = parseMapUrl(url);
		expect(result.provider).toBe("apple");
		expect(result.coordinates).toEqual({ lat: -33.8567844, lng: 151.2127164 });
		expect(result.placeName).toBe("Sydney Opera House");
		expect(result.originalUrl).toBe(url);
	});

	test("returns unknown provider for non-map URL", () => {
		const url = "https://example.com/location";
		const result = parseMapUrl(url);
		expect(result.provider).toBe("unknown");
		expect(result.coordinates).toBeNull();
		expect(result.placeName).toBeNull();
	});
});

describe("isGoogleMapsUrl", () => {
	test("returns true for google.com/maps URLs", () => {
		expect(isGoogleMapsUrl("https://www.google.com/maps/place/Sydney")).toBe(
			true,
		);
	});

	test("returns true for maps.google.com URLs", () => {
		expect(isGoogleMapsUrl("https://maps.google.com/?q=Sydney")).toBe(true);
	});

	test("returns false for non-Google URLs", () => {
		expect(isGoogleMapsUrl("https://example.com")).toBe(false);
	});
});

describe("isAppleMapsUrl", () => {
	test("returns true for maps:// URLs", () => {
		expect(isAppleMapsUrl("maps://?ll=-33.8567844,151.2127164")).toBe(true);
	});

	test("returns true for maps.apple.com URLs", () => {
		expect(
			isAppleMapsUrl("https://maps.apple.com/?ll=-33.8567844,151.2127164"),
		).toBe(true);
	});

	test("returns false for non-Apple URLs", () => {
		expect(isAppleMapsUrl("https://example.com")).toBe(false);
	});
});

describe("isMapUrl", () => {
	test("returns true for Google Maps", () => {
		expect(isMapUrl("https://www.google.com/maps/place/Sydney")).toBe(true);
	});

	test("returns true for Apple Maps", () => {
		expect(isMapUrl("maps://?ll=-33.8567844,151.2127164")).toBe(true);
	});

	test("returns false for non-map URLs", () => {
		expect(isMapUrl("https://example.com")).toBe(false);
	});
});

describe("isValidCoordinate", () => {
	test("returns true for valid coordinates", () => {
		expect(isValidCoordinate(-33.8567844, 151.2127164)).toBe(true);
	});

	test("returns true for edge case coordinates", () => {
		expect(isValidCoordinate(-90, -180)).toBe(true);
		expect(isValidCoordinate(90, 180)).toBe(true);
		expect(isValidCoordinate(0, 0)).toBe(true);
	});

	test("returns false for lat out of range", () => {
		expect(isValidCoordinate(91, 0)).toBe(false);
		expect(isValidCoordinate(-91, 0)).toBe(false);
	});

	test("returns false for lng out of range", () => {
		expect(isValidCoordinate(0, 181)).toBe(false);
		expect(isValidCoordinate(0, -181)).toBe(false);
	});

	test("returns false for NaN values", () => {
		expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
		expect(isValidCoordinate(0, Number.NaN)).toBe(false);
	});
});

describe("formatCoordinates", () => {
	test("formats coordinates with default precision", () => {
		const result = formatCoordinates({ lat: -33.8567844, lng: 151.2127164 });
		expect(result).toBe("-33.856784, 151.212716");
	});

	test("formats coordinates with custom precision", () => {
		const result = formatCoordinates({ lat: -33.8567844, lng: 151.2127164 }, 2);
		expect(result).toBe("-33.86, 151.21");
	});

	test("formats coordinates with zero precision", () => {
		const result = formatCoordinates({ lat: -33.8567844, lng: 151.2127164 }, 0);
		expect(result).toBe("-34, 151");
	});
});
