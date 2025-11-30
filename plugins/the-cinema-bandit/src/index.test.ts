import { describe, expect, it } from "bun:test";
import {
	generateTicketHtml,
	TEMPLATE_PLACEHOLDERS,
	type TicketData,
} from "./index.js";

describe("the-cinema-bandit exports", () => {
	it("should export generateTicketHtml function", () => {
		expect(typeof generateTicketHtml).toBe("function");
	});

	it("should export TEMPLATE_PLACEHOLDERS constant", () => {
		expect(Array.isArray(TEMPLATE_PLACEHOLDERS)).toBe(true);
		expect(TEMPLATE_PLACEHOLDERS.length).toBeGreaterThan(0);
	});

	it("should export TicketData type", () => {
		// Type test - this will fail at compile time if type is not exported
		const ticketData: TicketData = {
			customerName: "Test User",
			movieTitle: "Test Movie",
			moviePoster: "https://example.com/poster.jpg",
			sessionDateTime: "29 Nov 2025, 4:15pm-6:52pm",
			screenNumber: "Screen 1",
			seats: "F9, F10",
		};
		expect(ticketData.customerName).toBe("Test User");
	});
});
