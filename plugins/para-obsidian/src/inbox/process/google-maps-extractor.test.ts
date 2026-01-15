/**
 * Tests for deterministic Google Maps place extractor.
 *
 * @module inbox/process/google-maps-extractor.test
 */
import { describe, expect, test } from "bun:test";
import {
	extractCoordsFromUrl,
	extractGoogleMapsPlace,
	extractHours,
	extractPlaceNameFromContent,
	extractPlaceNameFromUrl,
	extractRating,
	extractReviewCount,
	extractWebsite,
	inferCategory,
	inferSuburb,
	isGoogleMapsUrl,
} from "./google-maps-extractor.js";

describe("isGoogleMapsUrl", () => {
	test("returns true for Google Maps place URLs", () => {
		expect(
			isGoogleMapsUrl(
				"https://www.google.com/maps/place/Paddington+Reservoir+Gardens/@-33.88,151.22",
			),
		).toBe(true);
		expect(
			isGoogleMapsUrl(
				"https://google.com/maps/place/Some+Place/@-33.88,151.22,17z",
			),
		).toBe(true);
	});

	test("returns false for non-Google Maps URLs", () => {
		expect(isGoogleMapsUrl("https://example.com")).toBe(false);
		expect(isGoogleMapsUrl("https://google.com/search")).toBe(false);
		expect(isGoogleMapsUrl("https://maps.apple.com")).toBe(false);
	});
});

describe("extractPlaceNameFromUrl", () => {
	test("extracts place name with + signs", () => {
		expect(
			extractPlaceNameFromUrl(
				"https://www.google.com/maps/place/Paddington+Reservoir+Gardens/@-33.88,151.22",
			),
		).toBe("Paddington Reservoir Gardens");
	});

	test("extracts place name with URL encoding", () => {
		expect(
			extractPlaceNameFromUrl(
				"https://www.google.com/maps/place/Caf%C3%A9+Mocha/@-33.88,151.22",
			),
		).toBe("Café Mocha");
	});

	test("extracts place name without coordinates", () => {
		expect(
			extractPlaceNameFromUrl(
				"https://www.google.com/maps/place/Sydney+Opera+House/",
			),
		).toBe("Sydney Opera House");
	});

	test("returns null for invalid URLs", () => {
		expect(extractPlaceNameFromUrl("https://google.com/search")).toBeNull();
		expect(extractPlaceNameFromUrl("https://example.com")).toBeNull();
	});
});

describe("extractCoordsFromUrl", () => {
	test("extracts positive coordinates", () => {
		expect(
			extractCoordsFromUrl(
				"https://www.google.com/maps/place/Place/@33.88,151.22,17z",
			),
		).toEqual({ lat: 33.88, lng: 151.22 });
	});

	test("extracts negative coordinates", () => {
		expect(
			extractCoordsFromUrl(
				"https://www.google.com/maps/place/Place/@-33.8852757,151.2241634,17z",
			),
		).toEqual({ lat: -33.8852757, lng: 151.2241634 });
	});

	test("returns null for URLs without coordinates", () => {
		expect(
			extractCoordsFromUrl("https://www.google.com/maps/place/Sydney/"),
		).toBeNull();
	});
});

describe("extractPlaceNameFromContent", () => {
	test("extracts place name from ## heading", () => {
		const content = `
![](https://www.google.com/images/branding/mapslogo/2x/GoogleMaps_Logo.png)

## Paddington Reservoir Gardens

(1,176)
`;
		expect(extractPlaceNameFromContent(content)).toBe(
			"Paddington Reservoir Gardens",
		);
	});

	test("skips known section headings", () => {
		const content = `
## Content

Some content here

## My Place

More content

## Reviews

Reviews here
`;
		expect(extractPlaceNameFromContent(content)).toBe("My Place");
	});

	test("returns null if no valid heading found", () => {
		const content = `
## Content

## Reviews

## Notes
`;
		expect(extractPlaceNameFromContent(content)).toBeNull();
	});
});

describe("extractRating", () => {
	test("extracts rating after review summary", () => {
		const content = `
## Review summary

| 5 |  |
| 4 |  |
| 3 |  |

4.5

"Great place!"
`;
		expect(extractRating(content)).toBe(4.5);
	});

	test("extracts integer rating", () => {
		const content = `
## Review summary

| 5 |  |

5

"Perfect!"
`;
		expect(extractRating(content)).toBe(5);
	});

	test("returns undefined if no rating found", () => {
		const content = "No rating here";
		expect(extractRating(content)).toBeUndefined();
	});
});

describe("extractReviewCount", () => {
	test("extracts review count with comma separators", () => {
		const content = "## Place Name\n\n(1,176)\n";
		expect(extractReviewCount(content)).toBe(1176);
	});

	test("extracts small review count", () => {
		const content = "## Place Name\n\n(42)\n";
		expect(extractReviewCount(content)).toBe(42);
	});

	test("returns undefined if no count found", () => {
		const content = "No review count here";
		expect(extractReviewCount(content)).toBeUndefined();
	});
});

describe("extractWebsite", () => {
	test("extracts non-Google website URL", () => {
		const content = `
[cityofsydney.nsw.gov.au](https://www.cityofsydney.nsw.gov.au/parks/paddington-reservoir-gardens)

[Maps](https://google.com/maps)
`;
		expect(extractWebsite(content)).toBe(
			"https://www.cityofsydney.nsw.gov.au/parks/paddington-reservoir-gardens",
		);
	});

	test("skips Google and booking site links", () => {
		const content = `
[Google](https://google.com/maps)
[Book now](https://viator.com/tours)
[TripAdvisor](https://tripadvisor.com/place)
[My Site](https://mysite.com)
`;
		expect(extractWebsite(content)).toBe("https://mysite.com");
	});

	test("returns undefined if no valid website found", () => {
		const content = "[Google](https://google.com/maps)";
		expect(extractWebsite(content)).toBeUndefined();
	});
});

describe("extractHours", () => {
	test("extracts hours from Open · Closes pattern", () => {
		const content = "Open · Closes 8 pm";
		expect(extractHours(content)).toBe("Open until 8 pm");
	});

	test("extracts hours from table format", () => {
		const content = `
| Thursday | - 8 am–8 pm |  |
| Friday | - 8 am–8 pm |  |
`;
		expect(extractHours(content)).toBe("8 am–8 pm");
	});

	test("returns undefined if no hours found", () => {
		const content = "No hours here";
		expect(extractHours(content)).toBeUndefined();
	});
});

describe("inferSuburb", () => {
	test("extracts suburb from place name", () => {
		expect(inferSuburb("Paddington Reservoir Gardens")).toBe("Paddington");
		expect(inferSuburb("Bondi Beach")).toBe("Bondi");
		expect(inferSuburb("Surry Hills Library")).toBe("Surry Hills");
	});

	test("returns undefined for unknown suburb", () => {
		expect(inferSuburb("Sydney Opera House")).toBeUndefined();
		expect(inferSuburb("Random Place")).toBeUndefined();
	});
});

describe("inferCategory", () => {
	test("infers garden category", () => {
		expect(inferCategory("Paddington Reservoir Gardens", "")).toBe("garden");
		expect(inferCategory("Botanical Garden", "")).toBe("garden");
	});

	test("infers park category", () => {
		expect(inferCategory("Centennial Park", "")).toBe("park");
		expect(inferCategory("Hyde Park", "")).toBe("park");
	});

	test("infers beach category", () => {
		expect(inferCategory("Bondi Beach", "")).toBe("beach");
		expect(inferCategory("Coogee Bay", "")).toBe("beach");
	});

	test("infers category from content", () => {
		expect(inferCategory("Random Place", "This is a nice museum")).toBe(
			"museum",
		);
		expect(inferCategory("Good Eats", "restaurant with great food")).toBe(
			"restaurant",
		);
	});

	test("defaults to attraction", () => {
		expect(inferCategory("Sydney Tower", "tall building")).toBe("attraction");
	});
});

describe("extractGoogleMapsPlace", () => {
	const sampleContent = `
![](https://www.google.com/images/branding/mapslogo/2x/GoogleMaps_Logo_WithDarkOutline.png)

## Paddington Reservoir Gardens

(1,176)

## SponsoredBy Viator

Open · Closes 8 pm

| Thursday | - 8 am–8 pm |  |

[cityofsydney.nsw.gov.au](https://www.cityofsydney.nsw.gov.au/parks/paddington-reservoir-gardens)

## Review summary

| 5 |  |
| 4 |  |

4.5

"Great place!"
`;

	test("extracts complete place details", () => {
		const url =
			"https://www.google.com/maps/place/Paddington+Reservoir+Gardens/@-33.8852757,151.2241634,17z";
		const result = extractGoogleMapsPlace(url, sampleContent);

		expect(result).not.toBeNull();
		expect(result?.name).toBe("Paddington Reservoir Gardens");
		expect(result?.lat).toBe(-33.8852757);
		expect(result?.lng).toBe(151.2241634);
		expect(result?.suburb).toBe("Paddington");
		expect(result?.category).toBe("garden");
		expect(result?.hours).toBe("Open until 8 pm");
		expect(result?.rating).toBe(4.5);
		expect(result?.reviewCount).toBe(1176);
		expect(result?.website).toBe(
			"https://www.cityofsydney.nsw.gov.au/parks/paddington-reservoir-gardens",
		);
	});

	test("falls back to URL name when content name missing", () => {
		const url =
			"https://www.google.com/maps/place/Some+Place/@-33.88,151.22,17z";
		const content = "No valid heading here";
		const result = extractGoogleMapsPlace(url, content);

		expect(result).not.toBeNull();
		expect(result?.name).toBe("Some Place");
	});

	test("returns null when no name can be extracted", () => {
		const url = "https://google.com/search";
		const content = "No valid content";
		const result = extractGoogleMapsPlace(url, content);

		expect(result).toBeNull();
	});
});
