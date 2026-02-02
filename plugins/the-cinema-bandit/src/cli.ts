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
 *   bun run src/cli.ts ticket [--session-id 116001] [--seats H1,H2] [--dry-run]
 *   bun run src/cli.ts send --session-id 116001 --seats H1,H2 --tickets "ADULT:1" [--dry-run]
 */

import { join } from "node:path";
import { getStringFlag, outputError, parseArgs } from "@side-quest/core/cli";
import {
	parseResponseFormat,
	ResponseFormat,
} from "@side-quest/core/mcp-response";
import {
	formatMovieDetailsResponse,
	formatMoviesResponse,
	formatPricingResponse,
	formatSeatsResponse,
	formatSessionResponse,
	renderSeatMap,
} from "./formatters.ts";
import { sendTicketEmail } from "./gmail/index.ts";
import {
	calculatePricingFromScraped,
	validateScrapedPricing,
} from "./price-scraper.ts";
import { createScraperClient } from "./scraper-client.ts";
import { generateTicketHtml, type TicketData } from "./template.ts";
import {
	renderMovieDetailsMarkdown,
	renderMoviesMarkdown,
	renderPricingMarkdown,
	renderSeatsMarkdown,
	renderSendConfirmationMarkdown,
	renderSessionMarkdown,
} from "./templates/index.ts";

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
 * Parses ticket selections from a flag string in the format "TYPE:qty,TYPE:qty".
 * Throws with contextual errors for invalid input.
 */
export function parseTicketsFlag(
	ticketsStr: string,
): Array<{ type: string; quantity: number }> {
	const ticketSelections = ticketsStr.split(",").map((part) => {
		const [type, quantityStr] = part.split(":");
		const quantity = Number.parseInt(quantityStr ?? "", 10);

		if (!type || Number.isNaN(quantity) || quantity < 0) {
			throw new Error(
				`Invalid ticket format: "${part}". Expected --tickets "ADULT:1,SENIOR:2"`,
			);
		}

		return { type: type.trim(), quantity };
	});

	const totalTickets = ticketSelections.reduce((sum, t) => sum + t.quantity, 0);
	if (totalTickets === 0) {
		throw new Error("Must have at least one ticket (non-zero quantity).");
	}

	return ticketSelections;
}

/**
 * Prints usage information
 */
function printUsage(): void {
	console.log(`
Cinema Bandit CLI - Classic Cinemas Scraper

Usage:
  bun run src/cli.ts movies
  bun run src/cli.ts session --session-id <id>
  bun run src/cli.ts pricing --session-id <id>
  bun run src/cli.ts seats --session-id <id>
  bun run src/cli.ts movie --movie-url <slug>
  bun run src/cli.ts ticket [--session-id <id>] [--seats <seats>] [--dry-run]
  bun run src/cli.ts send --session-id <id> --seats <seats> --tickets <spec> [--dry-run]

Commands:
  movies     Scrape today's movies from homepage
             Returns: title, rating, thumbnail, movieUrl, sessionTimes[]

  session    Scrape session details for a specific session
             Returns: screenNumber, dateTime

  pricing    Scrape ticket prices for a specific session
             Returns: adultPrice, childPrice, bookingFee

  seats      Scrape seat map for a specific session
             Returns: seatMap with rows, availableCount, totalSeats
             Shows available/taken seats and wheelchair accessibility

  movie      Scrape full movie metadata (lazy load - only when requested)
             Returns: title, description, trailerUrl, rating, duration,
                     country, cast, director, eventLinks[]

  ticket     Generate HTML ticket preview
             Without --session-id: generates example ticket (Star Wars 1977)
             With --session-id: scrapes real session/pricing data
             Outputs to: examples/sample-ticket.html

  send       Scrape session data, generate ticket, and email to hi@nathanvale.com
             Requires: --session-id, --seats, --tickets
             Example: --tickets "ADULT:1,SENIOR:2"

Options:
  --format <type>      Output format: "json" (default) or "markdown"
                       JSON is machine-readable, markdown is human-readable
                       Shorthand: "md" is accepted for markdown
                       Note: logs go to stderr when format=json

  --session-id <id>    Session ID from ticket URL
                       Required for: session, pricing, seats
                       Optional for: ticket (enables live scraping)
                       Example: 116001

  --movie-url <slug>   Movie slug from movieUrl field (required for movie)
                       Example: "wicked-for-good"
                       Also accepts: "/movies/wicked-for-good" or full URL

  --seats <seats>      Comma-separated seat numbers (optional for ticket, required for send)
                       Example: "H1,H2" or "J7,J8"

  --tickets <spec>     Ticket selections in format "TYPE:quantity,TYPE:quantity"
                       Required for: send
                       Example: "ADULT:1,SENIOR:2"

  --dry-run            Skip writes/emails; return structured output only

  --help               Show this help message

Examples:
  # Get all movies showing today
  bun run src/cli.ts movies

  # Get session details
  bun run src/cli.ts session --session-id 116001

  # Get ticket prices
  bun run src/cli.ts pricing --session-id 116001

  # Get seat map
  bun run src/cli.ts seats --session-id 116001

  # Get full movie metadata (using slug from movies command)
  bun run src/cli.ts movie --movie-url "wicked-for-good"

  # Generate example ticket HTML (no scraping)
  bun run src/cli.ts ticket

  # Generate ticket with live scraped data
  bun run src/cli.ts ticket --session-id 116001

  # Generate ticket with seats
  bun run src/cli.ts ticket --session-id 116001 --seats H1,H2
  bun run src/cli.ts ticket --session-id 116001 --seats H1,H2 --dry-run

  # Send ticket email (scrapes data, generates ticket, emails)
  bun run src/cli.ts send --session-id 116135 --seats D5 --tickets "ADULT:1"
  bun run src/cli.ts send --session-id 116135 --seats "H1,H2" --tickets "ADULT:1,CHILD:1"
  bun run src/cli.ts send --session-id 116135 --seats H1,H2 --tickets "ADULT:1" --dry-run

Output:
  Default: JSON to stdout for easy parsing by slash commands.
  Use --format markdown for human-readable output (reduces LLM tokens).
  JSON responses include a 'selectorsUsed' field for debugging.
`);
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
	log: (message: string) => void = console.log,
): Promise<string> {
	// Step 1: Scrape movies to find the one matching this sessionId
	log("🎬 Scraping movies to find session...");
	const moviesResult = await client.scrapeMovies();
	const movie = moviesResult.movies.find((m) =>
		m.sessionTimes.some((s) => s.sessionId === sessionId),
	);

	if (movie) {
		log(`   Movie: ${movie.title}`);
		log(`   Poster: ${movie.thumbnail ? "Found" : "Not found"}`);
	} else {
		log(`   Movie: Not found for session ${sessionId}`);
	}

	// Step 2: Scrape session details (screen number, date/time)
	log(`🔍 Scraping session ${sessionId}...`);
	const sessionResult = await client.scrapeSession(sessionId);
	log(`   Screen: ${sessionResult.screenNumber ?? "Unknown"}`);
	log(`   DateTime: ${sessionResult.dateTime ?? "Unknown"}`);

	// Step 3: Scrape pricing
	log("💰 Scraping pricing...");
	const pricingResult = await client.scrapePricing(sessionId);
	const adultTicket = pricingResult.ticketTypes.find((t) => t.name === "ADULT");
	const childTicket = pricingResult.ticketTypes.find((t) => t.name === "CHILD");
	log(`   Adult: ${adultTicket?.price ?? "Unknown"}`);
	log(`   Child: ${childTicket?.price ?? "Unknown"}`);
	log(`   Booking Fee: ${pricingResult.bookingFee ?? "Unknown"}`);

	// Validate and calculate pricing using price-scraper
	const scrapedPricing = validateScrapedPricing({
		ticketTypes: pricingResult.ticketTypes,
		bookingFee: pricingResult.bookingFee ?? "$0.00",
		selectorsUsed: {
			ticketTypes: pricingResult.selectorsUsed.ticketTypes ?? "unknown",
			bookingFee: pricingResult.selectorsUsed.bookingFee ?? "unknown",
		},
	});

	const ticketSelections = [
		{ type: "ADULT", quantity: 2 },
		{ type: "CHILD", quantity: 2 },
	];

	const pricing = calculatePricingFromScraped(scrapedPricing, ticketSelections);

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
		tickets: pricing.ticketLines,
		invoiceLines: pricing.invoiceLines,
		bookingFee: pricing.bookingFee,
		totalAmount: pricing.totalAmount,
	};

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
		process.exit(0);
	}

	const { command, flags } = parseArgs(args);
	const formatStr = getStringFlag(flags, "format");
	const format = parseResponseFormat(formatStr);
	const log = format === ResponseFormat.JSON ? console.error : console.log;
	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";

	// Handle ticket command without session-id (no scraping needed)
	if (command === "ticket" && !flags["session-id"]) {
		if (dryRun) {
			if (format === ResponseFormat.MARKDOWN) {
				log("✅ Dry run: example ticket would be generated (Star Wars 1977)");
			} else {
				console.log(
					JSON.stringify({
						action: "ticket-example",
						dryRun: true,
						message: "Example ticket would be generated (no file written).",
					}),
				);
			}
			return;
		}

		const outputPath = await generateExampleTicket();
		log("✅ Generated example ticket HTML (Star Wars 1977)");
		log(`📄 Saved to: ${outputPath}`);
		log("\nOpen the file in a browser to preview the ticket.");
		log("\n💡 Tip: Use --session-id <id> to generate with live scraped data");
		return;
	}

	let client: Awaited<ReturnType<typeof createScraperClient>> | undefined;
	try {
		client = await createScraperClient();

		switch (command) {
			case "movies": {
				const result = await client.scrapeMovies();

				if (format === ResponseFormat.MARKDOWN) {
					console.log(renderMoviesMarkdown(result.movies));
				} else {
					const response = formatMoviesResponse(
						result.movies,
						result.selectorsUsed,
					);
					console.log(JSON.stringify(response, null, 2));
				}
				break;
			}

			case "session": {
				const sessionId = getStringFlag(flags, "session-id");
				if (!sessionId) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--session-id required for session command",
					);
				}

				const result = await client.scrapeSession(sessionId);

				if (format === ResponseFormat.MARKDOWN) {
					console.log(
						renderSessionMarkdown(result.screenNumber, result.dateTime),
					);
				} else {
					const response = formatSessionResponse(
						{
							screenNumber: result.screenNumber,
							dateTime: result.dateTime,
						},
						result.selectorsUsed,
					);
					console.log(JSON.stringify(response, null, 2));
				}
				break;
			}

			case "pricing": {
				const sessionId = getStringFlag(flags, "session-id");
				if (!sessionId) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--session-id required for pricing command",
					);
				}

				const result = await client.scrapePricing(sessionId);

				if (format === ResponseFormat.MARKDOWN) {
					console.log(
						renderPricingMarkdown(result.ticketTypes, result.bookingFee),
					);
				} else {
					const response = formatPricingResponse(
						{
							ticketTypes: result.ticketTypes,
							bookingFee: result.bookingFee,
						},
						result.selectorsUsed,
					);
					console.log(JSON.stringify(response, null, 2));
				}
				break;
			}

			case "seats": {
				const sessionId = getStringFlag(flags, "session-id");
				if (!sessionId) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--session-id required for seats command",
					);
				}

				const result = await client.scrapeSeats(sessionId);

				if (format === ResponseFormat.MARKDOWN) {
					console.log(renderSeatsMarkdown(result.seatMap));
				} else {
					// Render ASCII art seat map to stderr (doesn't interfere with JSON)
					const asciiMap = renderSeatMap(result.seatMap);
					console.error(asciiMap);
					console.error(""); // Blank line

					// Output JSON to stdout for parsing
					const response = formatSeatsResponse(
						result.seatMap,
						result.selectorsUsed,
					);
					console.log(JSON.stringify(response, null, 2));
				}
				break;
			}

			case "movie": {
				const movieUrl = getStringFlag(flags, "movie-url");
				if (!movieUrl) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--movie-url required for movie command",
					);
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

				if (format === ResponseFormat.MARKDOWN) {
					console.log(renderMovieDetailsMarkdown(response));
				} else {
					console.log(JSON.stringify(response, null, 2));
				}
				break;
			}

			case "ticket": {
				// If we're here, --session-id was provided (handled above otherwise)
				const sessionId = getStringFlag(flags, "session-id");
				if (!sessionId) {
					// Shouldn't happen, but just in case
					const outputPath = await generateExampleTicket();
					log("✅ Generated example ticket HTML");
					log(`📄 Saved to: ${outputPath}`);
					break;
				}

				const seats = getStringFlag(flags, "seats");
				const outputPath = dryRun
					? undefined
					: await generateScrapedTicket(sessionId, client, seats, log);

				const ticketResponse = {
					success: true,
					sessionId,
					seats: seats ?? "TBD",
					outputPath: outputPath ?? "dry-run",
					dryRun,
				};

				if (format === ResponseFormat.MARKDOWN) {
					log("\n✅ Generated ticket HTML with live data");
					log(`📄 Saved to: ${outputPath ?? "(dry run - no file written)"}`);
					log("\nOpen the file in a browser to preview the ticket.");
				} else {
					console.log(JSON.stringify(ticketResponse));
				}
				break;
			}

			case "send": {
				const sessionId = getStringFlag(flags, "session-id");
				const seats = getStringFlag(flags, "seats");
				const ticketsStr = getStringFlag(flags, "tickets");

				if (!sessionId) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--session-id required for send command",
					);
				}
				if (!seats) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--seats required for send command",
					);
				}
				if (!ticketsStr) {
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						"--tickets required for send command",
						{
							example: '--tickets "ADULT:1,SENIOR:2"',
						},
					);
				}

				let ticketSelections: Array<{ type: string; quantity: number }>;
				try {
					ticketSelections = parseTicketsFlag(ticketsStr);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					outputError(
						format === ResponseFormat.JSON ? "json" : "markdown",
						message,
					);
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
					ticketTypes: pricingResult.ticketTypes,
					bookingFee: pricingResult.bookingFee ?? "$0.00",
					selectorsUsed: {
						ticketTypes: pricingResult.selectorsUsed.ticketTypes ?? "unknown",
						bookingFee: pricingResult.selectorsUsed.bookingFee ?? "unknown",
					},
				});

				const pricing = calculatePricingFromScraped(
					scrapedPricing,
					ticketSelections,
				);

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
				const messageId = dryRun
					? "dry-run"
					: await sendTicketEmail(
							"hi@nathanvale.com",
							ticketData.movieTitle,
							html,
						);

				// Output response
				if (format === ResponseFormat.MARKDOWN) {
					console.log(
						renderSendConfirmationMarkdown({
							movieTitle: ticketData.movieTitle,
							sessionDateTime: ticketData.sessionDateTime ?? "Unknown",
							screenNumber: ticketData.screenNumber ?? "Unknown",
							seats: ticketData.seats,
							invoiceLines: pricing.invoiceLines,
							bookingFee: pricing.bookingFee,
							totalAmount: pricing.totalAmount,
						}),
					);
					if (dryRun) {
						console.log("\nDry run: email not sent.");
					}
				} else {
					console.log(
						JSON.stringify({
							success: true,
							messageId,
							movieTitle: ticketData.movieTitle,
							sessionDateTime: ticketData.sessionDateTime,
							screenNumber: ticketData.screenNumber,
							seats: ticketData.seats,
							pricing: {
								tickets: ticketSelections,
								ticketSubtotal: pricing.ticketSubtotal,
								bookingFee: pricing.bookingFeeAmount,
								totalAmount: pricing.totalAmountNumber,
							},
							dryRun,
						}),
					);
				}
				break;
			}

			default:
				outputError(
					format === ResponseFormat.JSON ? "json" : "markdown",
					`Unknown command "${command}"`,
					{
						help: "Run with --help to see available commands",
					},
				);
		}
	} catch (error) {
		if (error instanceof Error) {
			outputError(
				format === ResponseFormat.JSON ? "json" : "markdown",
				`Scraping error: ${error.message}`,
			);
		} else {
			outputError(
				format === ResponseFormat.JSON ? "json" : "markdown",
				`Scraping error: ${String(error)}`,
			);
		}
	} finally {
		if (client) {
			await client.close();
		}
	}
}

if (import.meta.main) {
	main();
}
