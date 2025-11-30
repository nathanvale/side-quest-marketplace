/**
 * Cinema scraper client using Playwright
 *
 * Implements selector-first fallback hierarchy for fast, resilient scraping:
 * 1. CSS Selectors (fast, ~50ms)
 * 2. Fallback Selectors (fast, ~50ms each)
 * 3. Text Pattern (slow, ~500ms - requires full page text)
 * 4. Returns null (manual input required)
 *
 * PLAYWRIGHT BEST PRACTICES APPLIED:
 * - Uses waitUntil: 'load' for scraping (DOM ready is sufficient)
 * - Explicit state: 'visible' on all waitForSelector calls
 * - 5-10s timeouts for real-world reliability (not 1-2s)
 * - Removes manual isVisible() checks (click() has built-in actionability)
 * - Auto-waiting locators preferred over manual waits
 *
 * TODO: Replace CSS class selectors (.Markup.Movie, .Title, etc.) with:
 * - data-testid attributes (requires website changes)
 * - Role-based locators (getByRole, getByText) where applicable
 * - This would make scraping more resilient to CSS class name changes
 */

import { type Browser, chromium } from "playwright";
import { createCorrelationId, initLogger, scraperLogger } from "./logger.ts";
import type { Movie, SessionTime } from "./scraper.ts";
import { buildTicketUrl, MOVIE_DETAIL_SELECTORS, URLS } from "./selectors.ts";

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
			// Use 'load' - we only need DOM ready for scraping, not all network activity
			await page.goto(URLS.homepage, { waitUntil: "load" });
			// Wait for movie containers to be visible
			await page.waitForSelector(".Markup.Movie", {
				state: "visible",
				timeout: 10000,
			});

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

			await page.goto(url, { waitUntil: "load" });

			// Wait for the movie title heading to confirm page loaded
			try {
				await page.getByRole("heading", { level: 1 }).waitFor({
					state: "visible",
					timeout: 10000,
				});
			} catch {
				scraperLogger.warn("Page load timeout - heading not found");
			}

			const selectorsUsed: Record<string, string> = {};

			// Extract screen number using getByText with regex pattern "Screen N"
			let screenNumber: string | null = null;
			try {
				const screenText = await page
					.getByText(/^Screen \d+$/)
					.first()
					.textContent({ timeout: 5000 });
				if (screenText?.trim()) {
					screenNumber = screenText.trim();
					selectorsUsed.screenNumber = "getByText-regex";
				}
			} catch {
				// Fallback: search page text with regex
				const pageText = await page.textContent("body");
				const match = pageText?.match(/Screen\s+(\d+)/i);
				if (match) {
					screenNumber = `Screen ${match[1]}`;
					selectorsUsed.screenNumber = "textPattern";
				} else {
					selectorsUsed.screenNumber = "none";
				}
			}

			// Extract date/time - format: "30 Nov 2025, 2:50pm-5:27pm"
			let dateTime: string | null = null;
			try {
				const dateTimeText = await page
					.getByText(/\d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2}[ap]m/)
					.first()
					.textContent({ timeout: 5000 });
				if (dateTimeText?.trim()) {
					dateTime = dateTimeText.trim();
					selectorsUsed.dateTime = "getByText-regex";
				}
			} catch {
				// Fallback: search page text with regex
				const pageText = await page.textContent("body");
				const match = pageText?.match(
					/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s+\d{1,2}:\d{2}[ap]m.*?\d{1,2}:\d{2}[ap]m)/i,
				);
				if (match?.[1]) {
					dateTime = match[1];
					selectorsUsed.dateTime = "textPattern";
				} else {
					selectorsUsed.dateTime = "none";
				}
			}

			return {
				screenNumber,
				dateTime,
				selectorsUsed,
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

			await page.goto(url, { waitUntil: "load" });

			// Wait for ADULT text to confirm pricing section loaded
			try {
				await page.getByText("ADULT", { exact: true }).waitFor({
					state: "visible",
					timeout: 10000,
				});
			} catch {
				scraperLogger.warn("Pricing section not found");
			}

			const selectorsUsed: Record<string, string> = {};

			// Get visible page text once (innerText excludes hidden elements like iframes)
			// This is more reliable than textContent which includes script/iframe content
			const pageText = await page.innerText("body");

			// Extract Adult price - format: "ADULT\n$26.50" (newline separated)
			let adultPrice: string | null = null;
			const adultMatch = pageText.match(/ADULT[\s\S]{0,10}(\$\d+\.\d{2})/);
			if (adultMatch?.[1]) {
				adultPrice = adultMatch[1];
				selectorsUsed.adultPrice = "innerText-regex";
			} else {
				selectorsUsed.adultPrice = "none";
			}

			// Extract Child price
			let childPrice: string | null = null;
			const childMatch = pageText.match(/CHILD[\s\S]{0,10}(\$\d+\.\d{2})/);
			if (childMatch?.[1]) {
				childPrice = childMatch[1];
				selectorsUsed.childPrice = "innerText-regex";
			} else {
				selectorsUsed.childPrice = "none";
			}

			// Extract Booking Fee - visible in totals section
			let bookingFee: string | null = null;
			const feeMatch = pageText.match(/BOOKING FEE[\s\S]{0,10}(\$\d+\.\d{2})/);
			if (feeMatch?.[1]) {
				bookingFee = feeMatch[1];
				selectorsUsed.bookingFee = "innerText-regex";
			} else {
				selectorsUsed.bookingFee = "none";
			}

			return {
				adultPrice,
				childPrice,
				bookingFee,
				selectorsUsed,
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
				await page.goto(url, { timeout: 30000, waitUntil: "load" });
				// Wait for movie content to be visible
				await page.waitForSelector(
					MOVIE_DETAIL_SELECTORS.descriptionContainer.primary,
					{ state: "visible", timeout: 10000 },
				);
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
				const descWysiwyg = await page.locator(
					MOVIE_DETAIL_SELECTORS.descriptionContainer.primary,
				);
				// Extract title from first h2 using locator
				try {
					const h2Element = descWysiwyg.locator("h2").first();
					const h2Text = await h2Element.textContent({ timeout: 5000 });
					if (h2Text?.trim()) {
						title = h2Text.trim();
						selectorsUsed.title = "h2-locator";
					}
				} catch {
					selectorsUsed.title = "none";
				}

				// Extract description (all text after h2)
				try {
					const descText = await descWysiwyg.textContent({ timeout: 5000 });
					if (descText) {
						// Remove the title and get the rest
						const descWithoutTitle = descText.replace(title, "").trim();
						description = descWithoutTitle;
						selectorsUsed.description = "wysiwyg-description";
					}
				} catch {
					selectorsUsed.description = "none";
				}
			} catch {
				selectorsUsed.title = "none";
				selectorsUsed.description = "none";
			}

			// Extract trailer URL
			let trailerUrl: string | null = null;
			try {
				const youtubeLink = page
					.locator(MOVIE_DETAIL_SELECTORS.trailerLink.primary)
					.first();
				const href = await youtubeLink.getAttribute("href", { timeout: 5000 });
				if (href) {
					trailerUrl = href;
					selectorsUsed.trailerUrl = "locator-trailer";
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
				const metaWysiwyg = await page.locator(
					MOVIE_DETAIL_SELECTORS.metadataContainer.primary,
				);

				// Extract rating using locator
				try {
					const ratingP = metaWysiwyg
						.locator(MOVIE_DETAIL_SELECTORS.rating.primary)
						.first();
					const ratingText = await ratingP.textContent({ timeout: 5000 });
					if (ratingText?.trim()) {
						rating = ratingText.trim();
						selectorsUsed.rating = "locator-rating";
					}
				} catch {
					selectorsUsed.rating = "none";
				}

				// Extract duration using locator
				try {
					const durationP = metaWysiwyg
						.locator(MOVIE_DETAIL_SELECTORS.duration.primary)
						.first();
					const durationText = await durationP.textContent({ timeout: 5000 });
					if (durationText?.trim()) {
						duration = durationText.trim();
						selectorsUsed.duration = "locator-duration";
					}
				} catch {
					selectorsUsed.duration = "none";
				}

				// Extract country using locator
				try {
					const countryP = metaWysiwyg
						.locator(MOVIE_DETAIL_SELECTORS.country.primary)
						.first();
					const countryText = await countryP.textContent({ timeout: 5000 });
					if (countryText?.trim()) {
						country = countryText.trim();
						selectorsUsed.country = "locator-country";
					}
				} catch {
					selectorsUsed.country = "none";
				}

				// Extract cast using locator
				try {
					const castP = metaWysiwyg
						.locator(MOVIE_DETAIL_SELECTORS.cast.primary)
						.first();
					const castText = await castP.textContent({ timeout: 5000 });
					if (castText?.trim()) {
						cast = castText.trim();
						selectorsUsed.cast = "locator-cast";
					}
				} catch {
					selectorsUsed.cast = "none";
				}

				// Extract director using locator
				try {
					const directorP = metaWysiwyg
						.locator(MOVIE_DETAIL_SELECTORS.director.primary)
						.first();
					const directorText = await directorP.textContent({ timeout: 5000 });
					if (directorText?.trim()) {
						director = directorText.trim();
						selectorsUsed.director = "locator-director";
					}
				} catch {
					selectorsUsed.director = "none";
				}
			} catch {
				selectorsUsed.metadata = "none";
			}

			// Extract event links
			const eventLinks: Array<{ name: string; url: string }> = [];
			try {
				const eventContainer = await page
					.locator(MOVIE_DETAIL_SELECTORS.eventLinks.primary)
					.first();
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
