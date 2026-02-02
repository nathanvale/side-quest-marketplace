import { describe, expect, it } from "bun:test";
import {
	parseResponseFormat,
	ResponseFormat,
} from "@sidequest/core/mcp-response";
import type { MovieDetailsResponse } from "../formatters.ts";
import type { Movie, SeatMap, TicketType } from "../scraper.ts";
import {
	renderMovieDetailsMarkdown,
	renderMoviesMarkdown,
	renderPricingMarkdown,
	renderSeatsMarkdown,
	renderSendConfirmationMarkdown,
	renderSessionMarkdown,
} from "./index.ts";

describe("parseResponseFormat", () => {
	it("defaults to MARKDOWN when no value provided", () => {
		expect(parseResponseFormat()).toBe(ResponseFormat.MARKDOWN);
		expect(parseResponseFormat(undefined)).toBe(ResponseFormat.MARKDOWN);
	});

	it("returns MARKDOWN for 'markdown'", () => {
		expect(parseResponseFormat("markdown")).toBe(ResponseFormat.MARKDOWN);
	});

	it("returns JSON for 'json'", () => {
		expect(parseResponseFormat("json")).toBe(ResponseFormat.JSON);
	});

	it("returns MARKDOWN for any unknown value", () => {
		expect(parseResponseFormat("invalid")).toBe(ResponseFormat.MARKDOWN);
		expect(parseResponseFormat("xml")).toBe(ResponseFormat.MARKDOWN);
		expect(parseResponseFormat("md")).toBe(ResponseFormat.MARKDOWN);
	});
});

describe("renderMoviesMarkdown", () => {
	it("renders header for empty list", () => {
		const result = renderMoviesMarkdown([]);
		expect(result).toContain("## Movies Showing Today");
		expect(result).toContain("No movies showing today.");
	});

	it("renders movie with session times joined by pipe", () => {
		const movies: Movie[] = [
			{
				title: "Wicked",
				rating: "PG",
				thumbnail: "https://example.com/wicked.jpg",
				movieUrl: "https://example.com/movies/wicked",
				slug: "wicked",
				sessionTimes: [
					{ time: "3:00 pm", sessionId: "1001" },
					{ time: "7:00 pm", sessionId: "1002" },
				],
			},
		];

		const result = renderMoviesMarkdown(movies);
		expect(result).toContain("**1. Wicked** (PG)");
		expect(result).toContain("3:00 pm | 7:00 pm");
	});

	it("numbers multiple movies correctly", () => {
		const movies: Movie[] = [
			{
				title: "Movie A",
				rating: "G",
				thumbnail: "",
				movieUrl: "",
				slug: "a",
				sessionTimes: [{ time: "1:00 pm", sessionId: "1" }],
			},
			{
				title: "Movie B",
				rating: "M",
				thumbnail: "",
				movieUrl: "",
				slug: "b",
				sessionTimes: [{ time: "2:00 pm", sessionId: "2" }],
			},
		];

		const result = renderMoviesMarkdown(movies);
		expect(result).toContain("**1. Movie A** (G)");
		expect(result).toContain("**2. Movie B** (M)");
	});

	it("includes call to action", () => {
		const result = renderMoviesMarkdown([]);
		expect(result).toContain(
			"Want details on any of these, or pick a time to book?",
		);
	});
});

describe("renderMovieDetailsMarkdown", () => {
	const baseDetails: MovieDetailsResponse = {
		title: "Test Movie",
		description: "A great movie about testing.",
		trailerUrl: "https://youtube.com/watch?v=test",
		rating: "PG",
		duration: "120 min",
		country: "Australia",
		cast: "Actor One, Actor Two",
		director: "Director Name",
		eventLinks: [],
		selectorsUsed: {},
	};

	it("renders title as heading", () => {
		const result = renderMovieDetailsMarkdown(baseDetails);
		expect(result).toContain("## Test Movie");
	});

	it("renders metadata line with rating, duration, country", () => {
		const result = renderMovieDetailsMarkdown(baseDetails);
		expect(result).toContain("**PG** | 120 min | Australia");
	});

	it("renders description", () => {
		const result = renderMovieDetailsMarkdown(baseDetails);
		expect(result).toContain("A great movie about testing.");
	});

	it("renders director and cast", () => {
		const result = renderMovieDetailsMarkdown(baseDetails);
		expect(result).toContain("**Director**: Director Name");
		expect(result).toContain("**Cast**: Actor One, Actor Two");
	});

	it("renders trailer URL", () => {
		const result = renderMovieDetailsMarkdown(baseDetails);
		expect(result).toContain("**Trailer**: https://youtube.com/watch?v=test");
	});

	it("handles missing fields gracefully", () => {
		const minimal: MovieDetailsResponse = {
			title: "Minimal",
			description: "",
			trailerUrl: null,
			rating: null,
			duration: null,
			country: null,
			cast: null,
			director: null,
			eventLinks: [],
			selectorsUsed: {},
		};

		const result = renderMovieDetailsMarkdown(minimal);
		expect(result).toContain("## Minimal");
		expect(result).not.toContain("**Director**");
		expect(result).not.toContain("**Trailer**");
	});

	it("includes session times when provided", () => {
		const result = renderMovieDetailsMarkdown(baseDetails, "3:00 pm | 7:00 pm");
		expect(result).toContain("**Session times**: 3:00 pm | 7:00 pm");
	});
});

describe("renderPricingMarkdown", () => {
	it("renders ticket types as bullet list", () => {
		const ticketTypes: TicketType[] = [
			{ name: "ADULT", price: "$27.00" },
			{ name: "CHILD", price: "$22.00" },
		];

		const result = renderPricingMarkdown(ticketTypes, "1.95");
		expect(result).toContain("- ADULT: $27.00");
		expect(result).toContain("- CHILD: $22.00");
	});

	it("renders booking fee when provided", () => {
		const result = renderPricingMarkdown([], "1.95");
		expect(result).toContain("**Booking fee**: $1.95 per ticket");
	});

	it("handles null booking fee", () => {
		const result = renderPricingMarkdown([], null);
		expect(result).not.toContain("Booking fee");
	});

	it("handles empty ticket types", () => {
		const result = renderPricingMarkdown([], null);
		expect(result).toContain("No ticket types available");
	});

	it("includes call to action", () => {
		const result = renderPricingMarkdown([], null);
		expect(result).toContain("How many tickets?");
	});
});

describe("renderSessionMarkdown", () => {
	it("renders screen number", () => {
		const result = renderSessionMarkdown("Screen 3", null);
		expect(result).toContain("**Screen**: Screen 3");
	});

	it("renders date/time", () => {
		const result = renderSessionMarkdown(null, "Fri 29 Nov, 08:15PM");
		expect(result).toContain("**Date/Time**: Fri 29 Nov, 08:15PM");
	});

	it("renders both when provided", () => {
		const result = renderSessionMarkdown("Screen 3", "Fri 29 Nov, 08:15PM");
		expect(result).toContain("**Screen**: Screen 3");
		expect(result).toContain("**Date/Time**: Fri 29 Nov, 08:15PM");
	});

	it("handles both null gracefully", () => {
		const result = renderSessionMarkdown(null, null);
		expect(result).toContain("Session details not available.");
	});
});

describe("renderSeatsMarkdown", () => {
	const seatMap: SeatMap = {
		screenNumber: "Screen 5",
		rows: {
			A: [
				{ id: "A1", row: "A", number: 1, available: true, wheelchair: false },
				{ id: "A2", row: "A", number: 2, available: false, wheelchair: false },
			],
		},
		availableCount: 1,
		totalSeats: 2,
	};

	it("renders screen header", () => {
		const result = renderSeatsMarkdown(seatMap);
		expect(result).toContain("**Screen 5**");
	});

	it("includes ASCII seat map in code block", () => {
		const result = renderSeatsMarkdown(seatMap);
		expect(result).toContain("```");
		expect(result).toContain("SCREEN 5");
	});

	it("shows availability count", () => {
		const result = renderSeatsMarkdown(seatMap);
		expect(result).toContain("1 / 2 available");
	});

	it("includes call to action", () => {
		const result = renderSeatsMarkdown(seatMap);
		expect(result).toContain('Pick a seat (e.g., "E8").');
	});
});

describe("renderSendConfirmationMarkdown", () => {
	const data = {
		movieTitle: "Wicked: For Good",
		sessionDateTime: "Fri 29 Nov, 08:15PM",
		screenNumber: "Screen 3",
		seats: "J6, J7",
		totalAmount: "55.90",
	};

	it("confirms email sent", () => {
		const result = renderSendConfirmationMarkdown(data);
		expect(result).toContain("Your ticket has been sent to your email.");
	});

	it("renders movie title", () => {
		const result = renderSendConfirmationMarkdown(data);
		expect(result).toContain("**Wicked: For Good**");
	});

	it("renders all booking details", () => {
		const result = renderSendConfirmationMarkdown(data);
		expect(result).toContain("**Date**: Fri 29 Nov, 08:15PM");
		expect(result).toContain("**Screen**: Screen 3");
		expect(result).toContain("**Seat(s)**: J6, J7");
		expect(result).toContain("**Total**: $55.90");
	});

	it("ends with enjoy message", () => {
		const result = renderSendConfirmationMarkdown(data);
		expect(result).toContain("Enjoy the film!");
	});
});
