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
import type { Movie, Seat, SeatMap, SessionTime } from "./scraper.ts";
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
		ticketTypes: Array<{ name: string; price: string }>;
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

	/** Scrape seat map for a session */
	scrapeSeats(sessionId: string): Promise<{
		seatMap: SeatMap;
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

			// Wait for pricing section to load (look for any ticket type text)
			try {
				// Wait for "ADD TICKET" button which indicates pricing loaded
				await page.getByText("ADD TICKET").first().waitFor({
					state: "visible",
					timeout: 10000,
				});
			} catch {
				scraperLogger.warn("Pricing section not found");
			}

			const selectorsUsed: Record<string, string> = {};

			// Get visible page text once (innerText excludes hidden elements like iframes)
			// This is more reliable than textContent which includes script/iframe content
			let pageText = await page.innerText("body");

			// Extract all ticket types dynamically
			// Pattern: Known ticket type name followed by price within 15 characters
			// Format matches original working regex: "ADULT[\s\S]{0,10}(\$\d+\.\d{2})"
			const ticketTypes: Array<{ name: string; price: string }> = [];

			// Common ticket types to search for
			const knownTicketTypes = [
				"ADULT",
				"CHILD",
				"SENIOR",
				"STUDENT",
				"CONCESSION",
				"PENSION",
			];

			for (const ticketTypeName of knownTicketTypes) {
				// Use same pattern as original code: ticket type + any chars + price
				const pattern = new RegExp(
					`${ticketTypeName}[\\s\\S]{0,15}(\\$\\d+\\.\\d{2})`,
				);
				const match = pageText.match(pattern);

				if (match?.[1]) {
					const price = match[1];
					// Avoid duplicates (shouldn't happen, but be safe)
					const exists = ticketTypes.some((t) => t.name === ticketTypeName);
					if (!exists) {
						ticketTypes.push({ name: ticketTypeName, price });
						scraperLogger.debug("Found ticket type", {
							name: ticketTypeName,
							price,
						});
					}
				}
			}

			if (ticketTypes.length > 0) {
				selectorsUsed.ticketTypes = `innerText-regex (found ${ticketTypes.length} types)`;
			} else {
				selectorsUsed.ticketTypes = "none";
				scraperLogger.warn("No ticket types found in page text");
			}

			// Booking fee only appears after adding a ticket to cart
			// Click "ADD TICKET" button for Adult to reveal the fee
			let bookingFee: string | null = null;
			try {
				// Find and click the ADD TICKET button for adult tickets
				const addTicketButton = page.getByText("ADD TICKET").first();
				await addTicketButton.click();

				// Wait for booking fee to update (it changes from $0.00 to actual fee)
				await page.waitForTimeout(500); // Brief wait for UI update

				// Re-fetch page text after adding ticket
				pageText = await page.innerText("body");

				// Extract Booking Fee - now visible in totals section
				const feeMatch = pageText.match(
					/BOOKING FEE[\s\S]{0,10}(\$\d+\.\d{2})/,
				);
				if (feeMatch?.[1]) {
					bookingFee = feeMatch[1];
					selectorsUsed.bookingFee = "innerText-regex (after-add-ticket)";
				} else {
					selectorsUsed.bookingFee = "none";
				}
			} catch (error) {
				scraperLogger.warn("Failed to add ticket for booking fee extraction", {
					error: error instanceof Error ? error.message : String(error),
				});
				selectorsUsed.bookingFee = "none";
			}

			return {
				ticketTypes,
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

		async scrapeSeats(sessionIdOrUrl: string) {
			// Accept either full URL or just session ID
			const url =
				sessionIdOrUrl.startsWith("/tickets") ||
				sessionIdOrUrl.startsWith("http")
					? sessionIdOrUrl.startsWith("http")
						? sessionIdOrUrl
						: `${URLS.homepage}${sessionIdOrUrl}`
					: buildTicketUrl(sessionIdOrUrl);

			await page.goto(url, { waitUntil: "load" });

			const selectorsUsed: Record<string, string> = {};

			// Wait for ADULT text to confirm page loaded
			try {
				await page.getByText("ADULT", { exact: true }).waitFor({
					state: "visible",
					timeout: 10000,
				});
			} catch {
				scraperLogger.warn("Ticket page not loaded properly");
			}

			// Click ADD TICKET to enable SELECT SEATS button
			try {
				const addTicketButton = page.getByText("ADD TICKET").first();
				await addTicketButton.click();
				selectorsUsed.addTicket = "getByText-ADD-TICKET";

				// Wait briefly for UI update
				await page.waitForTimeout(500);
			} catch (error) {
				scraperLogger.error("Failed to add ticket", {
					error: error instanceof Error ? error.message : String(error),
				});
				throw new Error("Could not add ticket to enable seat selection");
			}

			// Click SELECT SEATS to reveal seat map
			try {
				const selectSeatsButton = page.getByRole("button", {
					name: "SELECT SEATS",
				});
				await selectSeatsButton.click();
				selectorsUsed.selectSeatsButton = "getByRole-button-SELECT-SEATS";

				// Wait for seat map to load
				await page.waitForTimeout(1000);
			} catch (error) {
				scraperLogger.error("Failed to open seat map", {
					error: error instanceof Error ? error.message : String(error),
				});
				throw new Error("Could not open seat selection map");
			}

			// Extract screen number
			let screenNumber = "Unknown";
			try {
				const screenText = await page
					.getByText(/^SCREEN \d+$/)
					.first()
					.textContent({ timeout: 5000 });
				if (screenText?.trim()) {
					screenNumber = screenText.trim();
					selectorsUsed.screenNumber = "getByText-regex-SCREEN";
				}
			} catch {
				// Fallback: search page text
				const pageText = await page.innerText("body");
				const match = pageText.match(/SCREEN\s+(\d+)/i);
				if (match) {
					screenNumber = `Screen ${match[1]}`;
					selectorsUsed.screenNumber = "textPattern";
				}
			}

			// Find all seat buttons using CSS class selector
			// Each button has class "seating-map__button"
			// Seat ID is stored in <svg title="A11"> attribute
			const seatButtons = await page
				.locator("button.seating-map__button")
				.all();

			selectorsUsed.seatButtons = "locator-button.seating-map__button";

			// Parse seats from buttons
			const rows: { [rowLetter: string]: Seat[] } = {};
			let availableCount = 0;
			let totalSeats = 0;

			for (const button of seatButtons) {
				try {
					// Get seat ID from SVG title attribute
					const svg = button.locator("svg");
					const seatId = await svg.getAttribute("title");

					if (!seatId) {
						scraperLogger.debug("Button missing SVG title attribute", {});
						continue;
					}

					// Extract row and number from seatId (e.g., "A11" -> row "A", number 11)
					const match = seatId.match(/^([A-Z])(\d+)$/);
					if (!match || !match[1] || !match[2]) {
						scraperLogger.debug("Invalid seat ID format", { seatId });
						continue;
					}

					const row = match[1];
					const number = Number.parseInt(match[2], 10);

					// Check availability (disabled = taken)
					const isDisabled = await button.isDisabled();

					// Check if wheelchair accessible
					// Wheelchair seats have icon-seat-wheelchair in the use element
					const use = button.locator("use");
					const iconHref = await use.getAttribute("xlink:href");
					const wheelchair =
						iconHref?.includes("icon-seat-wheelchair") ?? false;

					// Check if companion seat (has is-companion class)
					const className = await button.getAttribute("class");
					const isCompanion = className?.includes("is-companion") ?? false;

					const seat: Seat = {
						id: seatId,
						row,
						number,
						available: !isDisabled,
						wheelchair: wheelchair || isCompanion,
					};

					// Add to rows
					if (!rows[row]) {
						rows[row] = [];
					}
					rows[row].push(seat);

					totalSeats++;
					if (seat.available) {
						availableCount++;
					}
				} catch (error) {
					// Skip seats that fail to parse
					scraperLogger.debug("Failed to parse seat button", {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Sort seats within each row by number
			for (const row of Object.values(rows)) {
				row.sort((a, b) => a.number - b.number);
			}

			const seatMap: SeatMap = {
				screenNumber,
				rows,
				availableCount,
				totalSeats,
			};

			return {
				seatMap,
				selectorsUsed,
			};
		},

		async close() {
			await context.close();
			await browser.close();
		},
	};
}
