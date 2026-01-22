/**
 * Tests for VTT parser module.
 *
 * @module vtt/parser.test
 */

import { describe, expect, test } from "bun:test";
import { extractTextFromVtt, isVttFile, parseVtt } from "./parser.ts";

describe("isVttFile", () => {
	test("returns true for .vtt extension", () => {
		expect(isVttFile("transcript.vtt")).toBe(true);
		expect(isVttFile("/path/to/file.vtt")).toBe(true);
		expect(isVttFile("meeting-2024-01-15.vtt")).toBe(true);
	});

	test("returns true for uppercase .VTT", () => {
		expect(isVttFile("transcript.VTT")).toBe(true);
		expect(isVttFile("file.Vtt")).toBe(true);
	});

	test("returns false for non-vtt files", () => {
		expect(isVttFile("transcript.txt")).toBe(false);
		expect(isVttFile("transcript.srt")).toBe(false);
		expect(isVttFile("file.md")).toBe(false);
		expect(isVttFile("vtt")).toBe(false);
		expect(isVttFile("file.vtt.txt")).toBe(false);
	});
});

describe("parseVtt", () => {
	test("parses basic VTT file", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
Hello, this is the first line.

00:00:03.500 --> 00:00:05.000
And this is the second line.`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(2);
		expect(result.cues[0]?.text).toBe("Hello, this is the first line.");
		expect(result.cues[0]?.startTime).toBe("00:00:00.000");
		expect(result.cues[0]?.endTime).toBe("00:00:03.500");
		expect(result.cues[1]?.text).toBe("And this is the second line.");
	});

	test("handles multi-line cues", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
This is the first line
and this continues on the second line
with a third line too.`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(1);
		expect(result.cues[0]?.text).toBe(
			"This is the first line and this continues on the second line with a third line too.",
		);
	});

	test("handles cue identifiers", () => {
		const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:03.500
First cue with identifier.

cue-2
00:00:03.500 --> 00:00:05.000
Second cue with named identifier.`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(2);
		expect(result.cues[0]?.text).toBe("First cue with identifier.");
		expect(result.cues[1]?.text).toBe("Second cue with named identifier.");
	});

	test("strips voice tags", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
<v Speaker 1>Hello from speaker one.</v>

00:00:03.500 --> 00:00:05.000
<v Speaker 2>Hello from speaker two.</v>`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(2);
		expect(result.cues[0]?.text).toBe("Hello from speaker one.");
		expect(result.cues[1]?.text).toBe("Hello from speaker two.");
	});

	test("strips styling tags", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
This has <b>bold</b> and <i>italic</i> text.

00:00:03.500 --> 00:00:05.000
And <u>underlined</u> text too.`;

		const result = parseVtt(vtt);

		expect(result.cues[0]?.text).toBe("This has bold and italic text.");
		expect(result.cues[1]?.text).toBe("And underlined text too.");
	});

	test("handles positioning metadata after timestamps", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500 align:start position:10%
Text with positioning.

00:00:03.500 --> 00:00:05.000 line:0
More text with line position.`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(2);
		expect(result.cues[0]?.text).toBe("Text with positioning.");
		expect(result.cues[0]?.endTime).toBe("00:00:03.500");
	});

	test("handles WEBVTT header with metadata", () => {
		const vtt = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:03.500
Content after metadata.`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(1);
		expect(result.cues[0]?.text).toBe("Content after metadata.");
	});

	test("handles Windows line endings", () => {
		const vtt =
			"WEBVTT\r\n\r\n00:00:00.000 --> 00:00:03.500\r\nText with CRLF.\r\n";

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(1);
		expect(result.cues[0]?.text).toBe("Text with CRLF.");
	});

	test("combines cues into rawText", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
First sentence.

00:00:03.500 --> 00:00:05.000
Second sentence.

00:00:05.000 --> 00:00:08.000
Third sentence.`;

		const result = parseVtt(vtt);

		expect(result.rawText).toBe(
			"First sentence.\nSecond sentence.\nThird sentence.",
		);
	});

	test("handles empty VTT", () => {
		const vtt = `WEBVTT

`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(0);
		expect(result.rawText).toBe("");
	});

	test("handles real-world Teams VTT format", () => {
		const vtt = `WEBVTT

00:00:04.240 --> 00:00:06.560
<v Sonny Hartley>Share my screen.</v>

00:00:08.080 --> 00:00:08.560
<v Sonny Hartley>Yeah.</v>

00:00:12.400 --> 00:00:21.520
<v Sonny Hartley>So I guess, yeah. So I'm not sure who was the update headings one, I suppose that's an easy one for anyone to pick up.</v>`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(3);
		expect(result.cues[0]?.text).toBe("Share my screen.");
		expect(result.cues[0]?.speaker).toBe("Sonny Hartley");
		expect(result.cues[1]?.text).toBe("Yeah.");
		expect(result.cues[2]?.text).toBe(
			"So I guess, yeah. So I'm not sure who was the update headings one, I suppose that's an easy one for anyone to pick up.",
		);
	});

	test("extracts speaker names from voice tags", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
<v Nathan Vale>Hello from Nathan.</v>

00:00:03.500 --> 00:00:05.000
<v June Xu>Hello from June.</v>`;

		const result = parseVtt(vtt);

		expect(result.cues.length).toBe(2);
		expect(result.cues[0]?.speaker).toBe("Nathan Vale");
		expect(result.cues[0]?.text).toBe("Hello from Nathan.");
		expect(result.cues[1]?.speaker).toBe("June Xu");
		expect(result.cues[1]?.text).toBe("Hello from June.");
	});
});

describe("extractTextFromVtt", () => {
	test("extracts text from VTT content without speakers", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
First line of text.

00:00:03.500 --> 00:00:05.000
Second line of text.`;

		const text = extractTextFromVtt(vtt);

		expect(text).toBe("First line of text.\nSecond line of text.");
	});

	test("formats with speaker labels when speakers present", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.500
<v Nathan>Hello, this is Nathan speaking.</v>

00:00:03.500 --> 00:00:05.000
<v June>And this is June responding.</v>`;

		const text = extractTextFromVtt(vtt);

		expect(text).toBe(
			"Nathan: Hello, this is Nathan speaking.\nJune: And this is June responding.",
		);
	});

	test("groups consecutive cues from same speaker", () => {
		const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
<v Nathan>First line from Nathan.</v>

00:00:02.000 --> 00:00:04.000
<v Nathan>Second line from Nathan.</v>

00:00:04.000 --> 00:00:06.000
<v June>Now June speaks.</v>`;

		const text = extractTextFromVtt(vtt);

		expect(text).toBe(
			"Nathan: First line from Nathan.\nSecond line from Nathan.\nJune: Now June speaks.",
		);
	});
});
