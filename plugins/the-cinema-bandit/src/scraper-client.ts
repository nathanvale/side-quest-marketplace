/**
 * Cinema scraper client using Playwright
 *
 * Implements selector-first fallback hierarchy for fast, resilient scraping:
 * 1. CSS Selectors (fast, ~50ms)
 * 2. Fallback Selectors (fast, ~50ms each)
 * 3. Text Pattern (slow, ~500ms - requires full page text)
 * 4. Returns null (manual input required)
 */

import { type Browser, chromium, type Page } from "playwright";
import { createCorrelationId, initLogger, scraperLogger } from "./logger.ts";
import { findWithFallback } from "./price-scraper.ts";
import type { Movie, SessionTime } from "./scraper.ts";
import {
	buildTicketUrl,
	PRICING_SELECTORS,
	SESSION_SELECTORS,
	type SelectorConfig,
	URLS,
} from "./selectors.ts";

/**
 * Extracts the movie slug from a URL or path
 * @param urlOrPath - URL like "/movies/wicked-for-good" or "wicked-for-good"
 * @returns The slug (e.g., "wicked-for-good")
 */
function extractSlug(urlOrPath: string): string {
	// Remove domain if present
	const path = urlOrPath.startsWith("http")
		? new URL(urlOrPath).pathname
		: urlOrPath;

	// Extract slug from /movies/slug pattern
	const match = path.match(/\/movies\/([^/?]+)/);
	if (match?.[1]) {
		return match[1];
	}

	// If no /movies/ prefix, assume it's already a slug
	return path.replace(/^\/+/, "");
}

/**
 * Result of scraping with selector tracking
 */
export interface ScrapeResult {
	/** The scraped value, or null if all fallbacks failed */
	value: string | null;
	/** Which selector worked (for debugging) */
	selectorUsed: string;
}

/**
 * Cinema scraper client interface
 */
export interface ScraperClient {
	/** Scrape movies showing today */
	scrapeMovies(): Promise<{
		movies: Movie[];
		selectorsUsed: Record<string, string>;
	}>;

	/** Scrape session details for a specific session */
	scrapeSession(sessionId: string): Promise<{
		screenNumber: string | null;
		dateTime: string | null;
		selectorsUsed: Record<string, string>;
	}>;

	/** Scrape current pricing */
	scrapePricing(sessionId: string): Promise<{
		adultPrice: string | null;
		childPrice: string | null;
		bookingFee: string | null;
		selectorsUsed: Record<string, string>;
	}>;

	/** Scrape full movie details from movie detail page */
	scrapeMovie(movieUrlOrSlug: string): Promise<{
		title: string;
		description: string;
		trailerUrl: string | null;
		rating: string | null;
		duration: string | null;
		country: string | null;
		cast: string | null;
		director: string | null;
		eventLinks: Array<{ name: string; url: string }>;
		selectorsUsed: Record<string, string>;
	}>;

	/** Close the browser and clean up resources */
	close(): Promise<void>;
}

/**
 * Core fallback hierarchy implementation
 *
 * TIER 1: Try primary CSS selector (fastest)
 * TIER 2: Try fallback CSS selectors
 * TIER 3: Try text pattern matching (slowest)
 * TIER 4: Return null (manual fallback)
 *
 * @param page - Playwright page object
 * @param config - Selector configuration
 * @returns Scrape result with value and selector used
 */
async function scrapeWithFallback(
	page: Page,
	config: SelectorConfig,
): Promise<ScrapeResult> {
	// TIER 1: Try primary CSS selector
	try {
		const element = await page.locator(config.primary).first();
		const value = await element.textContent({ timeout: 1000 });
		if (value?.trim()) {
			scraperLogger.debug("Selector succeeded", {
				tier: "primary",
				field: config.description,
			});
			return { value: value.trim(), selectorUsed: "primary" };
		}
	} catch {
		scraperLogger.debug("Selector failed", {
			tier: "primary",
			field: config.description,
		});
	}

	// TIER 2: Try fallback CSS selectors
	if (config.fallbacks) {
		for (let i = 0; i < config.fallbacks.length; i++) {
			const fallbackSelector = config.fallbacks[i];
			if (!fallbackSelector) continue;

			try {
				const element = await page.locator(fallbackSelector).first();
				const value = await element.textContent({ timeout: 1000 });
				if (value?.trim()) {
					scraperLogger.debug("Selector succeeded", {
						tier: `fallback[${i}]`,
						field: config.description,
					});
					return { value: value.trim(), selectorUsed: `fallback[${i}]` };
				}
			} catch {
				scraperLogger.debug("Selector failed", {
					tier: `fallback[${i}]`,
					field: config.description,
				});
			}
		}
	}

	// TIER 3: Text pattern fallback (slow - requires full page text)
	if (config.textPattern) {
		try {
			const pageText = await page.textContent("body");
			if (pageText) {
				const value = findWithFallback(pageText, config);
				if (value) {
					scraperLogger.debug("Selector succeeded", {
						tier: "textPattern",
						field: config.description,
					});
					return { value, selectorUsed: "textPattern" };
				}
			}
		} catch {
			scraperLogger.debug("Selector fallback failed", {
				tier: "textPattern",
				field: config.description,
			});
		}
	}

	// TIER 4: All automation failed
	scraperLogger.warn("All selectors failed", { field: config.description });
	return { value: null, selectorUsed: "none" };
}

/**
 * Creates a new scraper client with Playwright browser
 *
 * @returns Scraper client interface
 */
export async function createScraperClient(): Promise<ScraperClient> {
	await initLogger();
	const cid = createCorrelationId();

	scraperLogger.info("Launching browser", { cid });
	// Launch headless Chromium browser
	const browser: Browser = await chromium.launch({
		headless: true,
	});

	const context = await browser.newContext();
	const page = await context.newPage();
	scraperLogger.debug("Browser launched", { cid, headless: true });

	return {
		async scrapeMovies() {
			const opCid = createCorrelationId();
			const _start = Date.now();

			scraperLogger.info("Scraping movies", { cid: opCid, url: URLS.homepage });
			await page.goto(URLS.homepage, { waitUntil: "domcontentloaded" });
			await page.waitForTimeout(3000); // Wait for React/JS to render

			const selectorsUsed: Record<string, string> = {};

			// Find all movie containers
			const movieContainers = await page.locator(".Markup.Movie").all();
			selectorsUsed.movieContainers = "div.Markup.Movie";

			const movies: Movie[] = [];

			for (const container of movieContainers) {
				// Extract movie URL from title link
				let movieUrl = "";
				try {
					const titleLink = await container.locator(".Title a").first();
					const href = await titleLink.getAttribute("href");
					if (href) {
						movieUrl = href;
					}
				} catch {
					// Fallback to image link
					try {
						const imageLink = await container.locator("a.Image").first();
						const href = await imageLink.getAttribute("href");
						if (href) {
							movieUrl = href;
						}
					} catch {
						// No movie URL found
					}
				}

				// Extract thumbnail
				let thumbnail = "";
				try {
					const img = await container.locator("img").first();
					const src = await img.getAttribute("src");
					if (src) {
						thumbnail = src;
					}
				} catch {
					// No thumbnail found
				}

				// Extract rating from Byline
				let rating = "N/A";
				try {
					const byline = await container.locator(".Byline").first();
					const ratingText = await byline.textContent();
					if (ratingText?.trim()) {
						rating = ratingText.trim();
					}
				} catch {
					// No rating found
				}

				// Extract movie title and sessions
				const sessionLinks = await container
					.locator("a.sessions-link[data-id][data-name]")
					.all();

				if (sessionLinks.length === 0) continue;

				// Get title from first session link
				const firstLink = sessionLinks[0];
				if (!firstLink) continue;

				const movieTitle = await firstLink.getAttribute("data-name");
				if (!movieTitle) continue;

				// Build session times
				const sessionTimes: SessionTime[] = [];
				for (const link of sessionLinks) {
					const sessionId = await link.getAttribute("data-id");
					const href = await link.getAttribute("href");
					const timeText = await link.textContent();

					if (!sessionId || !href) continue;

					// Clean up the time text (remove extra labels)
					const cleanTime =
						timeText?.trim().split("\n")[0]?.trim() || timeText?.trim() || "";

					sessionTimes.push({
						time: cleanTime,
						sessionId,
						ticketUrl: href,
					});
				}

				// Convert relative URL to full URL
				const fullMovieUrl = movieUrl.startsWith("http")
					? movieUrl
					: `${URLS.homepage}${movieUrl}`;

				// Extract slug from URL
				const slug = extractSlug(movieUrl);

				// Add movie to list
				movies.push({
					title: movieTitle,
					rating,
					thumbnail,
					movieUrl: fullMovieUrl,
					slug,
					sessionTimes,
				});
			}

			return { movies, selectorsUsed };
		},

		async scrapeSession(sessionIdOrUrl: string) {
			// Accept either full URL or just session ID
			const url =
				sessionIdOrUrl.startsWith("/tickets") ||
				sessionIdOrUrl.startsWith("http")
					? sessionIdOrUrl.startsWith("http")
						? sessionIdOrUrl
						: `${URLS.homepage}${sessionIdOrUrl}`
					: buildTicketUrl(sessionIdOrUrl);

			await page.goto(url, { waitUntil: "domcontentloaded" });
			await page.waitForTimeout(3000); // Wait for React/JS to render

			const screenResult = await scrapeWithFallback(
				page,
				SESSION_SELECTORS.screenNumber,
			);
			const dateTimeResult = await scrapeWithFallback(
				page,
				SESSION_SELECTORS.dateTime,
			);

			return {
				screenNumber: screenResult.value,
				dateTime: dateTimeResult.value,
				selectorsUsed: {
					screenNumber: screenResult.selectorUsed,
					dateTime: dateTimeResult.selectorUsed,
				},
			};
		},

		async scrapePricing(sessionIdOrUrl: string) {
			// Accept either full URL or just session ID
			const url =
				sessionIdOrUrl.startsWith("/tickets") ||
				sessionIdOrUrl.startsWith("http")
					? sessionIdOrUrl.startsWith("http")
						? sessionIdOrUrl
						: `${URLS.homepage}${sessionIdOrUrl}`
					: buildTicketUrl(sessionIdOrUrl);

			await page.goto(url, { waitUntil: "domcontentloaded" });
			await page.waitForTimeout(3000); // Wait for React/JS to render

			// Scrape ticket prices (visible before adding to cart)
			const adultResult = await scrapeWithFallback(
				page,
				PRICING_SELECTORS.adultPrice,
			);
			const childResult = await scrapeWithFallback(
				page,
				PRICING_SELECTORS.childPrice,
			);

			// Click "Add Ticket" to reveal the booking fee
			// Booking fee is only displayed after adding a ticket to cart
			let feeResult: ScrapeResult = { value: null, selectorUsed: "none" };
			try {
				const addTicketButton = await page
					.locator('a.btn-primary:has-text("Add Ticket")')
					.first();
				if (await addTicketButton.isVisible({ timeout: 1000 })) {
					await addTicketButton.click();
					await page.waitForTimeout(1000); // Wait for fee to update

					// Now scrape the booking fee
					feeResult = await scrapeWithFallback(
						page,
						PRICING_SELECTORS.bookingFee,
					);
				}
			} catch {
				// Could not click button, booking fee remains null
			}

			return {
				adultPrice: adultResult.value,
				childPrice: childResult.value,
				bookingFee: feeResult.value,
				selectorsUsed: {
					adultPrice: adultResult.selectorUsed,
					childPrice: childResult.selectorUsed,
					bookingFee: feeResult.selectorUsed,
				},
			};
		},

		async scrapeMovie(movieUrlOrSlug: string) {
			// Accept either full URL, relative URL, or just slug
			const url = movieUrlOrSlug.startsWith("http")
				? movieUrlOrSlug
				: movieUrlOrSlug.startsWith("/movies/") ||
						movieUrlOrSlug.startsWith("/")
					? `${URLS.homepage}${movieUrlOrSlug}`
					: `${URLS.homepage}/movies/${movieUrlOrSlug}`;

			try {
				await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
				await page.waitForTimeout(3000); // Wait for React/JS to render
			} catch (error) {
				// Page failed to load - return minimal data with error
				return {
					title: "",
					description: "",
					trailerUrl: null,
					rating: null,
					duration: null,
					country: null,
					cast: null,
					director: null,
					eventLinks: [],
					selectorsUsed: {
						error: error instanceof Error ? error.message : "Page load failed",
					},
				};
			}

			const selectorsUsed: Record<string, string> = {};

			// Extract title and description from .Wysiwyg[itemprop="description"]
			let title = "";
			let description = "";
			try {
				const descWysiwyg = await page
					.locator('.Wysiwyg[itemprop="description"]')
					.first();
				const html = await descWysiwyg.innerHTML({ timeout: 2000 });

				// Extract title from first h2
				const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
				if (h2Match?.[1]) {
					title = h2Match[1].trim();
					selectorsUsed.title = "h2-in-description";
				}

				// Extract description (all paragraphs after h2)
				const descText = await descWysiwyg.textContent({ timeout: 2000 });
				if (descText) {
					// Remove the title and get the rest
					const descWithoutTitle = descText.replace(title, "").trim();
					description = descWithoutTitle;
					selectorsUsed.description = "wysiwyg-description";
				}
			} catch {
				selectorsUsed.title = "none";
				selectorsUsed.description = "none";
			}

			// Extract trailer URL
			let trailerUrl: string | null = null;
			try {
				const youtubeLink = await page
					.locator('a[href*="youtube"], a[href*="youtu.be"]')
					.first();
				const href = await youtubeLink.getAttribute("href", { timeout: 2000 });
				if (href) {
					trailerUrl = href;
					selectorsUsed.trailerUrl = "youtube-link";
				}
			} catch {
				selectorsUsed.trailerUrl = "none";
			}

			// Extract metadata from second .Wysiwyg div
			let rating: string | null = null;
			let duration: string | null = null;
			let country: string | null = null;
			let cast: string | null = null;
			let director: string | null = null;

			try {
				const metaWysiwyg = await page.locator(".Wysiwyg").nth(4);
				const metaHtml = await metaWysiwyg.innerHTML({ timeout: 2000 });

				// Extract rating
				const ratingMatch = metaHtml.match(
					/<h3>Rating<\/h3>\s*<p>([^<]+)<\/p>/,
				);
				if (ratingMatch?.[1]) {
					rating = ratingMatch[1].trim();
					selectorsUsed.rating = "metadata-wysiwyg";
				}

				// Extract duration
				const durationMatch = metaHtml.match(
					/<h3>Duration<\/h3>\s*<p>([^<]+)<\/p>/,
				);
				if (durationMatch?.[1]) {
					duration = durationMatch[1].trim();
					selectorsUsed.duration = "metadata-wysiwyg";
				}

				// Extract country
				const countryMatch = metaHtml.match(
					/<h3>Country<\/h3>\s*<p>([^<]+)<\/p>/,
				);
				if (countryMatch?.[1]) {
					country = countryMatch[1].trim();
					selectorsUsed.country = "metadata-wysiwyg";
				}

				// Extract cast
				const castMatch = metaHtml.match(/<h3>Cast<\/h3>\s*<p>([^<]+)<\/p>/);
				if (castMatch?.[1]) {
					cast = castMatch[1].trim();
					selectorsUsed.cast = "metadata-wysiwyg";
				}

				// Extract director
				const directorMatch = metaHtml.match(
					/<h3>Director<\/h3>\s*<p>([^<]+)<\/p>/,
				);
				if (directorMatch?.[1]) {
					director = directorMatch[1].trim();
					selectorsUsed.director = "metadata-wysiwyg";
				}
			} catch {
				selectorsUsed.metadata = "none";
			}

			// Extract event links
			const eventLinks: Array<{ name: string; url: string }> = [];
			try {
				const eventContainer = await page.locator(".movie-event-links").first();
				const links = await eventContainer.locator("a").all();

				for (const link of links) {
					const name = await link.textContent();
					const href = await link.getAttribute("href");
					if (name?.trim() && href) {
						eventLinks.push({
							name: name.trim(),
							url: href,
						});
					}
				}
				selectorsUsed.eventLinks = "movie-event-links";
			} catch {
				selectorsUsed.eventLinks = "none";
			}

			return {
				title,
				description,
				movieUrl: url,
				slug: extractSlug(url),
				trailerUrl,
				rating,
				duration,
				country,
				cast,
				director,
				eventLinks,
				selectorsUsed,
			};
		},

		async close() {
			await context.close();
			await browser.close();
		},
	};
}
