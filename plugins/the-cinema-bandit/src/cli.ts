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
 */

import {
	formatMovieDetailsResponse,
	formatMoviesResponse,
	formatPricingResponse,
	formatSessionResponse,
} from "./formatters.ts";
import { createScraperClient } from "./scraper-client.ts";
import { parseArgs } from "./utils/args.ts";

/**
 * Prints usage information and exits
 */
function printUsage(): never {
	console.log(`
Cinema Bandit CLI - Classic Cinemas Scraper

Usage:
  cinema-scrape movies
  cinema-scrape session --session-id <id>
  cinema-scrape pricing --session-id <id>
  cinema-scrape movie --movie-url <slug>

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

Options:
  --session-id <id>    Session ID from ticket URL (required for session/pricing)
                       Example: 116001

  --movie-url <slug>   Movie slug from movieUrl field (required for movie)
                       Example: "wicked-for-good"
                       Also accepts: "/movies/wicked-for-good" or full URL

  --help               Show this help message

Examples:
  # Get all movies showing today
  cinema-scrape movies

  # Get session details
  cinema-scrape session --session-id 116001

  # Get ticket prices
  cinema-scrape pricing --session-id 116001

  # Get full movie metadata (using slug from movies command)
  cinema-scrape movie --movie-url "wicked-for-good"

Output:
  All commands output JSON to stdout for easy parsing by slash commands.
  Each response includes a 'selectorsUsed' field for debugging.
`);
	process.exit(1);
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
