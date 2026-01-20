import { describe, expect, test } from "bun:test";
import {
	generateMessageId,
	parseAUDateToISO,
	parseTeamsClipboard,
} from "./parser.js";

describe("parseAUDateToISO", () => {
	test("parses morning time correctly", () => {
		const result = parseAUDateToISO("15/01/2025 9:30 am");
		expect(result).toMatch(/2025-01-15T\d{2}:30:00\.000Z/);
	});

	test("parses afternoon time correctly", () => {
		const result = parseAUDateToISO("20/01/2026 2:45 pm");
		expect(result).toMatch(/2026-01-20T\d{2}:45:00\.000Z/);
	});

	test("parses noon correctly", () => {
		const result = parseAUDateToISO("01/06/2025 12:00 pm");
		expect(result).toMatch(/2025-06-01T\d{2}:00:00\.000Z/);
	});

	test("parses midnight correctly", () => {
		const result = parseAUDateToISO("31/12/2025 12:00 am");
		expect(result).toMatch(/2025-12-31T\d{2}:00:00\.000Z/);
	});

	test("handles single-digit day and month", () => {
		const result = parseAUDateToISO("5/3/2025 8:15 am");
		expect(result).toMatch(/2025-03-05T\d{2}:15:00\.000Z/);
	});

	test("returns current time for invalid format", () => {
		const before = Date.now();
		const result = parseAUDateToISO("invalid date");
		const after = Date.now();

		const resultTime = new Date(result).getTime();
		expect(resultTime).toBeGreaterThanOrEqual(before);
		expect(resultTime).toBeLessThanOrEqual(after + 1000);
	});
});

describe("generateMessageId", () => {
	test("generates consistent ID for same input", () => {
		const id1 = generateMessageId(
			"Nathan Vale",
			"2025-01-15T09:30:00.000Z",
			"Hello world",
		);
		const id2 = generateMessageId(
			"Nathan Vale",
			"2025-01-15T09:30:00.000Z",
			"Hello world",
		);
		expect(id1).toBe(id2);
	});

	test("generates different IDs for different content", () => {
		const id1 = generateMessageId(
			"Nathan Vale",
			"2025-01-15T09:30:00.000Z",
			"Hello world",
		);
		const id2 = generateMessageId(
			"Nathan Vale",
			"2025-01-15T09:30:00.000Z",
			"Goodbye world",
		);
		expect(id1).not.toBe(id2);
	});

	test("generates different IDs for different authors", () => {
		const id1 = generateMessageId(
			"Nathan Vale",
			"2025-01-15T09:30:00.000Z",
			"Hello",
		);
		const id2 = generateMessageId(
			"Ben Laughlin",
			"2025-01-15T09:30:00.000Z",
			"Hello",
		);
		expect(id1).not.toBe(id2);
	});

	test("generates 12-character hex IDs", () => {
		const id = generateMessageId(
			"Test User",
			"2025-01-15T09:30:00.000Z",
			"Test",
		);
		expect(id).toHaveLength(12);
		expect(id).toMatch(/^[0-9a-f]{12}$/);
	});
});

describe("parseTeamsClipboard", () => {
	test("returns empty array for empty input", () => {
		expect(parseTeamsClipboard("")).toEqual([]);
		expect(parseTeamsClipboard("   ")).toEqual([]);
	});

	test("parses single message", () => {
		const input = `Jay Pancholi
15/01/2025 2:34 pm
Hey Nathan, just checking in on the project status.
Let me know when you have a moment.`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.author).toBe("Jay Pancholi");
		expect(result[0]?.content).toBe(
			"Hey Nathan, just checking in on the project status.\nLet me know when you have a moment.",
		);
		expect(result[0]?.id).toHaveLength(12);
	});

	test("parses multiple messages", () => {
		const input = `Jay Pancholi
15/01/2025 2:34 pm
Hey Nathan!

Nathan Vale
15/01/2025 2:45 pm
Hey Jay, what's up?`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(2);
		expect(result[0]?.author).toBe("Jay Pancholi");
		expect(result[1]?.author).toBe("Nathan Vale");
	});

	test("parses message with reactions", () => {
		const input = `Nathan Vale
15/01/2025 3:00 pm
Great work on the PR!
👍
2 like reactions.
❤️
1 heart reactions.`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.content).toBe("Great work on the PR!");
		expect(result[0]?.reactions).toEqual([
			{ emoji: "👍", count: 2, name: "like" },
			{ emoji: "❤️", count: 1, name: "heart" },
		]);
	});

	test("parses message with reply reference", () => {
		const input = `Nathan Vale
15/01/2025 2:45 pm
Begin Reference, preview of Hey Nathan, just checking in on the project status. by Jay Pancholi
End Reference
All good! I'll have the update ready by EOD.`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.content).toBe(
			"All good! I'll have the update ready by EOD.",
		);
		expect(result[0]?.replyTo).toEqual({
			author: "Jay Pancholi",
			preview: "Hey Nathan, just checking in on the project status.",
		});
	});

	test("parses message with URL attachment", () => {
		const input = `Ben Laughlin
20/01/2026 10:00 am
Check out this article
Url Preview for https://example.com/article`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.content).toBe("Check out this article");
		expect(result[0]?.attachments).toEqual([
			{ type: "url", url: "https://example.com/article" },
		]);
	});

	test("parses message with GIF", () => {
		const input = `Ben Laughlin
20/01/2026 10:00 am
(GIF Image)`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.attachments).toEqual([{ type: "gif" }]);
	});

	test("parses message with file attachment", () => {
		const input = `Ben Laughlin
20/01/2026 10:00 am
Here's the document
has an attachment: report.pdf`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.content).toBe("Here's the document");
		expect(result[0]?.attachments).toEqual([
			{ type: "file", name: "report.pdf" },
		]);
	});

	test("parses edited message", () => {
		const input = `Nathan Vale
15/01/2025 3:00 pm
Updated message content
Edited.`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.content).toBe("Updated message content");
		expect(result[0]?.edited).toBe(true);
	});

	test("sorts messages by timestamp", () => {
		const input = `Nathan Vale
15/01/2025 3:00 pm
Later message

Jay Pancholi
15/01/2025 2:00 pm
Earlier message`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(2);
		expect(result[0]?.author).toBe("Jay Pancholi");
		expect(result[1]?.author).toBe("Nathan Vale");
	});

	test("handles names with apostrophes and hyphens", () => {
		const input = `Mary O'Brien
15/01/2025 2:34 pm
Hello there!

Jean-Pierre Dupont
15/01/2025 2:45 pm
Bonjour!`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(2);
		expect(result[0]?.author).toBe("Mary O'Brien");
		expect(result[1]?.author).toBe("Jean-Pierre Dupont");
	});

	test("generates stable IDs across parses", () => {
		const input = `Nathan Vale
15/01/2025 3:00 pm
Test message`;

		const result1 = parseTeamsClipboard(input);
		const result2 = parseTeamsClipboard(input);

		expect(result1[0]?.id).toBe(result2[0]?.id);
	});

	test("detects Everyone mention", () => {
		const input = `Nathan Vale
15/01/2025 3:00 pm
Hey Everyone, please review the PR.`;

		const result = parseTeamsClipboard(input);

		expect(result).toHaveLength(1);
		expect(result[0]?.mentions).toEqual(["Everyone"]);
	});
});
