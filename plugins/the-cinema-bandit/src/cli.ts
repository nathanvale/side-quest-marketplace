#!/usr/bin/env bun

/**
 * Cinema Bandit CLI
 *
 * Command-line interface for scraping Classic Cinemas.
 * Uses Playwright for selector-first browser automation.
 *
 * Usage:
 *   bun run src/cli.ts movies
 *   bun run src/cli.ts session --session-id 116001
 *   bun run src/cli.ts pricing --session-id 116001
 *   bun run src/cli.ts movie --movie-url "/movies/wicked-for-good"
 *   bun run src/cli.ts ticket
 */

import { join } from "node:path";
import {
	formatMovieDetailsResponse,
	formatMoviesResponse,
	formatPricingResponse,
	formatSessionResponse,
} from "./formatters.ts";
import { sendTicketEmail } from "./gmail/index.ts";
import {
	calculatePricingFromScraped,
	validateScrapedPricing,
} from "./price-scraper.ts";
import { createScraperClient } from "./scraper-client.ts";
import { generateTicketHtml, type TicketData } from "./template.ts";
import { parseArgs } from "./utils/args.ts";

/**
 * Example ticket data for the `ticket` command
 * Original Star Wars premiere, May 25, 1977
 */
const EXAMPLE_TICKET: TicketData = {
	customerName: "Nathan Vale",
	movieTitle: "STAR WARS",
	// Original 1977 "Style A" poster by Tom Jung
	moviePoster:
		"https://upload.wikimedia.org/wikipedia/en/8/87/StarWarsMoviePoster1977.jpg",
	sessionDateTime: "25 May 1977, 7:00pm-9:01pm",
	screenNumber: "Screen 1",
	seats: "J7, J8",
	tickets: [
		{ type: "Adult", quantity: 1 },
		{ type: "Child", quantity: 1 },
	],
};

/**
 * Prints usage information and exits
 */
function printUsage(): never {
	console.log(`
Cinema Bandit CLI - Classic Cinemas Scraper

Usage:
  bun run src/cli.ts movies
  bun run src/cli.ts session --session-id <id>
  bun run src/cli.ts pricing --session-id <id>
  bun run src/cli.ts movie --movie-url <slug>
  bun run src/cli.ts ticket [--session-id <id>]
  bun run src/cli.ts send --session-id <id> --seats <seats> --adults <n> [--children <n>]

Commands:
  movies     Scrape today's movies from homepage
             Returns: title, rating, thumbnail, movieUrl, sessionTimes[]

  session    Scrape session details for a specific session
             Returns: screenNumber, dateTime

  pricing    Scrape ticket prices for a specific session
             Returns: adultPrice, childPrice, bookingFee

  movie      Scrape full movie metadata (lazy load - only when requested)
             Returns: title, description, trailerUrl, rating, duration,
                     country, cast, director, eventLinks[]

  ticket     Generate HTML ticket preview
             Without --session-id: generates example ticket (Star Wars 1977)
             With --session-id: scrapes real session/pricing data
             Outputs to: examples/sample-ticket.html

  send       Scrape session data, generate ticket, and email to hi@nathanvale.com
             Requires: --session-id, --seats, --adults
             Optional: --children (defaults to 0)

Options:
  --session-id <id>    Session ID from ticket URL
                       Required for: session, pricing
                       Optional for: ticket (enables live scraping)
                       Example: 116001

  --movie-url <slug>   Movie slug from movieUrl field (required for movie)
                       Example: "wicked-for-good"
                       Also accepts: "/movies/wicked-for-good" or full URL

  --seats <seats>      Comma-separated seat numbers (optional for ticket, required for send)
                       Example: "H1,H2" or "J7,J8"

  --adults <n>         Number of adult tickets (required for send)
                       Example: 1

  --children <n>       Number of child/concession tickets (optional for send, defaults to 0)
                       Example: 1

  --help               Show this help message

Examples:
  # Get all movies showing today
  bun run src/cli.ts movies

  # Get session details
  bun run src/cli.ts session --session-id 116001

  # Get ticket prices
  bun run src/cli.ts pricing --session-id 116001

  # Get full movie metadata (using slug from movies command)
  bun run src/cli.ts movie --movie-url "wicked-for-good"

  # Generate example ticket HTML (no scraping)
  bun run src/cli.ts ticket

  # Generate ticket with live scraped data
  bun run src/cli.ts ticket --session-id 116001

  # Generate ticket with seats
  bun run src/cli.ts ticket --session-id 116001 --seats H1,H2

  # Send ticket email (scrapes data, generates ticket, emails)
  bun run src/cli.ts send --session-id 116135 --seats D5 --adults 1
  bun run src/cli.ts send --session-id 116135 --seats "H1,H2" --adults 1 --children 1

Output:
  All commands output JSON to stdout for easy parsing by slash commands.
  Each response includes a 'selectorsUsed' field for debugging.
`);
	process.exit(1);
}

/**
 * Gets the output path for generated tickets
 * Always outputs to the plugin's examples folder, regardless of cwd
 */
function getTicketOutputPath(): string {
	const pluginRoot = join(__dirname, "..");
	return join(pluginRoot, "examples", "sample-ticket.html");
}

/**
 * Generates example ticket HTML (Star Wars 1977) and saves to examples folder
 * @returns Output file path
 */
async function generateExampleTicket(): Promise<string> {
	const outputPath = getTicketOutputPath();
	const ticketHtml = generateTicketHtml(EXAMPLE_TICKET);
	await Bun.write(outputPath, ticketHtml);
	return outputPath;
}

/**
 * Generates ticket HTML from live scraped session data
 * @param sessionId - Session ID to scrape
 * @param client - Scraper client instance
 * @param seats - Optional comma-separated seat numbers (e.g., "H1,H2")
 * @returns Output file path
 */
async function generateScrapedTicket(
	sessionId: string,
	client: Awaited<ReturnType<typeof createScraperClient>>,
	seats?: string,
): Promise<string> {
	// Step 1: Scrape movies to find the one matching this sessionId
	console.log("🎬 Scraping movies to find session...");
	const moviesResult = await client.scrapeMovies();
	const movie = moviesResult.movies.find((m) =>
		m.sessionTimes.some((s) => s.sessionId === sessionId),
	);

	if (movie) {
		console.log(`   Movie: ${movie.title}`);
		console.log(`   Poster: ${movie.thumbnail ? "Found" : "Not found"}`);
	} else {
		console.log(`   Movie: Not found for session ${sessionId}`);
	}

	// Step 2: Scrape session details (screen number, date/time)
	console.log(`🔍 Scraping session ${sessionId}...`);
	const sessionResult = await client.scrapeSession(sessionId);
	console.log(`   Screen: ${sessionResult.screenNumber ?? "Unknown"}`);
	console.log(`   DateTime: ${sessionResult.dateTime ?? "Unknown"}`);

	// Step 3: Scrape pricing
	console.log("💰 Scraping pricing...");
	const pricingResult = await client.scrapePricing(sessionId);
	console.log(`   Adult: ${pricingResult.adultPrice ?? "Unknown"}`);
	console.log(`   Child: ${pricingResult.childPrice ?? "Unknown"}`);
	console.log(`   Booking Fee: ${pricingResult.bookingFee ?? "Unknown"}`);

	// Build ticket data from scraped info
	const ticketData: TicketData = {
		customerName: "Preview Customer",
		movieTitle: movie?.title ?? "MOVIE TITLE",
		moviePoster:
			movie?.thumbnail ??
			"https://placehold.co/600x900/1a1a2e/eee?text=Movie+Poster",
		sessionDateTime: sessionResult.dateTime ?? "Unknown",
		screenNumber: sessionResult.screenNumber ?? "Unknown",
		seats: seats ?? "TBD",
		tickets: [
			{ type: "Adult", quantity: 1 },
			{ type: "Child", quantity: 1 },
		],
		invoiceLines: [
			{
				description: "Adult x 1",
				price: pricingResult.adultPrice ?? "$0.00",
			},
			{
				description: "Child x 1",
				price: pricingResult.childPrice ?? "$0.00",
			},
		],
		bookingFee: pricingResult.bookingFee ?? "$0.00",
	};

	// Calculate total if we have prices
	if (pricingResult.adultPrice && pricingResult.childPrice) {
		const parsePrice = (p: string) =>
			Number.parseFloat(p.replace(/[^0-9.]/g, "")) || 0;
		const adult = parsePrice(pricingResult.adultPrice);
		const child = parsePrice(pricingResult.childPrice);

		// Booking fee is per ticket - website shows $0.00 until tickets added
		// Classic Cinemas charges $1.95 per ticket
		const BOOKING_FEE_PER_TICKET = 1.95;
		const scrapedFee = parsePrice(pricingResult.bookingFee ?? "$0");
		const feePerTicket = scrapedFee > 0 ? scrapedFee : BOOKING_FEE_PER_TICKET;

		const ticketCount = ticketData.tickets.reduce(
			(sum, t) => sum + t.quantity,
			0,
		);
		const totalFee = feePerTicket * ticketCount;
		const total = adult + child + totalFee;

		// Update booking fee to show total (fee × tickets)
		ticketData.bookingFee = `$${totalFee.toFixed(2)}`;
		ticketData.totalAmount = `$${total.toFixed(2)}`;
	}

	const outputPath = getTicketOutputPath();
	const ticketHtml = generateTicketHtml(ticketData);
	await Bun.write(outputPath, ticketHtml);

	return outputPath;
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes("--help")) {
		printUsage();
	}

	const { command, flags } = parseArgs(args);

	// Handle ticket command without session-id (no scraping needed)
	if (command === "ticket" && !flags["session-id"]) {
		const outputPath = await generateExampleTicket();
		console.log("✅ Generated example ticket HTML (Star Wars 1977)");
		console.log(`📄 Saved to: ${outputPath}`);
		console.log("\nOpen the file in a browser to preview the ticket.");
		console.log(
			"\n💡 Tip: Use --session-id <id> to generate with live scraped data",
		);
		return;
	}

	let client: Awaited<ReturnType<typeof createScraperClient>> | undefined;
	try {
		client = await createScraperClient();

		switch (command) {
			case "movies": {
				const result = await client.scrapeMovies();
				const response = formatMoviesResponse(
					result.movies,
					result.selectorsUsed,
				);
				console.log(JSON.stringify(response, null, 2));
				break;
			}

			case "session": {
				const sessionId = flags["session-id"];
				if (!sessionId) {
					console.error("Error: --session-id required for session command");
					process.exit(1);
				}

				const result = await client.scrapeSession(sessionId);
				const response = formatSessionResponse(
					{
						screenNumber: result.screenNumber,
						dateTime: result.dateTime,
					},
					result.selectorsUsed,
				);
				console.log(JSON.stringify(response, null, 2));
				break;
			}

			case "pricing": {
				const sessionId = flags["session-id"];
				if (!sessionId) {
					console.error("Error: --session-id required for pricing command");
					process.exit(1);
				}

				const result = await client.scrapePricing(sessionId);
				const response = formatPricingResponse(
					{
						adultPrice: result.adultPrice,
						childPrice: result.childPrice,
						bookingFee: result.bookingFee,
					},
					result.selectorsUsed,
				);
				console.log(JSON.stringify(response, null, 2));
				break;
			}

			case "movie": {
				const movieUrl = flags["movie-url"];
				if (!movieUrl) {
					console.error("Error: --movie-url required for movie command");
					process.exit(1);
				}

				const result = await client.scrapeMovie(movieUrl);
				const response = formatMovieDetailsResponse(
					{
						title: result.title,
						description: result.description,
						trailerUrl: result.trailerUrl,
						rating: result.rating,
						duration: result.duration,
						country: result.country,
						cast: result.cast,
						director: result.director,
						eventLinks: result.eventLinks,
					},
					result.selectorsUsed,
				);
				console.log(JSON.stringify(response, null, 2));
				break;
			}

			case "ticket": {
				// If we're here, --session-id was provided (handled above otherwise)
				const sessionId = flags["session-id"];
				if (!sessionId) {
					// Shouldn't happen, but just in case
					const outputPath = await generateExampleTicket();
					console.log("✅ Generated example ticket HTML");
					console.log(`📄 Saved to: ${outputPath}`);
					break;
				}

				const seats = flags.seats;
				const outputPath = await generateScrapedTicket(
					sessionId,
					client,
					seats,
				);
				console.log("\n✅ Generated ticket HTML with live data");
				console.log(`📄 Saved to: ${outputPath}`);
				console.log("\nOpen the file in a browser to preview the ticket.");
				break;
			}

			case "send": {
				const sessionId = flags["session-id"];
				const seats = flags.seats;
				const adultsStr = flags.adults;
				const childrenStr = flags.children;

				if (!sessionId) {
					console.error("Error: --session-id required for send command");
					process.exit(1);
				}
				if (!seats) {
					console.error("Error: --seats required for send command");
					process.exit(1);
				}
				if (!adultsStr) {
					console.error("Error: --adults required for send command");
					process.exit(1);
				}

				const adults = Number.parseInt(adultsStr, 10);
				const children = childrenStr ? Number.parseInt(childrenStr, 10) : 0;

				if (Number.isNaN(adults) || adults < 0) {
					console.error(
						"Error: --adults must be a valid number (0 or greater)",
					);
					process.exit(1);
				}
				if (Number.isNaN(children) || children < 0) {
					console.error(
						"Error: --children must be a valid number (0 or greater)",
					);
					process.exit(1);
				}
				if (adults === 0 && children === 0) {
					console.error(
						"Error: Must have at least one ticket (adult or child)",
					);
					process.exit(1);
				}

				// Scrape movies to find the one matching this sessionId
				const moviesResult = await client.scrapeMovies();
				const movie = moviesResult.movies.find((m) =>
					m.sessionTimes.some((s) => s.sessionId === sessionId),
				);

				// Scrape session details (screen number, date/time)
				const sessionResult = await client.scrapeSession(sessionId);

				// Scrape pricing
				const pricingResult = await client.scrapePricing(sessionId);

				// Validate and calculate pricing
				const scrapedPricing = validateScrapedPricing({
					adultPrice: pricingResult.adultPrice ?? "$0.00",
					childPrice: pricingResult.childPrice ?? "$0.00",
					bookingFee: pricingResult.bookingFee ?? "$0.00",
					selectorUsed: {
						adultPrice: pricingResult.selectorsUsed.adultPrice ?? "none",
						childPrice: pricingResult.selectorsUsed.childPrice ?? "none",
						bookingFee: pricingResult.selectorsUsed.bookingFee ?? "none",
					},
				});

				const pricing = calculatePricingFromScraped(scrapedPricing, {
					adults,
					children,
				});

				// Build ticket data
				const ticketData: TicketData = {
					customerName: "Nathan",
					movieTitle: movie?.title ?? "Unknown Movie",
					moviePoster:
						movie?.thumbnail ??
						"https://placehold.co/600x900/1a1a2e/eee?text=Movie+Poster",
					sessionDateTime: sessionResult.dateTime ?? "Unknown",
					screenNumber: sessionResult.screenNumber ?? "Unknown",
					seats,
					tickets: pricing.ticketLines,
					invoiceLines: pricing.invoiceLines,
					bookingFee: pricing.bookingFee,
					totalAmount: pricing.totalAmount,
				};

				// Generate and send email
				const html = generateTicketHtml(ticketData);
				const messageId = await sendTicketEmail(
					"hi@nathanvale.com",
					ticketData.movieTitle,
					html,
				);

				// Output JSON response
				console.log(
					JSON.stringify({
						success: true,
						messageId,
						movieTitle: ticketData.movieTitle,
						sessionDateTime: ticketData.sessionDateTime,
						screenNumber: ticketData.screenNumber,
						seats: ticketData.seats,
						pricing: {
							adults,
							children,
							ticketSubtotal: pricing.ticketSubtotal,
							bookingFee: pricing.bookingFeeAmount,
							totalAmount: pricing.totalAmountNumber,
						},
					}),
				);
				break;
			}

			default:
				console.error(`Error: Unknown command "${command}"`);
				console.error("Run with --help to see available commands");
				process.exit(1);
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Scraping error: ${error.message}`);
		} else {
			console.error(`Scraping error: ${String(error)}`);
		}
		process.exit(1);
	} finally {
		if (client) {
			await client.close();
		}
	}
}

main();
