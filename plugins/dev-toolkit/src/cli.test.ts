import { describe, expect, test } from "bun:test";
import { parseArgs } from "@sidequest/core/cli";

describe("dev-toolkit CLI argument parsing", () => {
	test("parses create-template command", () => {
		const result = parseArgs(["create-template", "my-cli"]);
		expect(result.command).toBe("create-template");
		expect(result.subcommand).toBe("my-cli");
	});

	test("parses create-template with --dest flag", () => {
		const result = parseArgs(["create-template", "my-cli", "--dest", "./plugins"]);
		expect(result.command).toBe("create-template");
		expect(result.subcommand).toBe("my-cli");
		expect(result.flags.dest).toBe("./plugins");
	});

	test("parses create-template with --format flag", () => {
		const result = parseArgs(["create-template", "my-cli", "--format", "json"]);
		expect(result.flags.format).toBe("json");
	});

	test("parses review-template command", () => {
		const result = parseArgs(["review-template", "./src/cli.ts"]);
		expect(result.command).toBe("review-template");
		expect(result.subcommand).toBe("./src/cli.ts");
	});

	test("parses review-template with --format flag", () => {
		const result = parseArgs(["review-template", ".", "--format=json"]);
		expect(result.command).toBe("review-template");
		expect(result.subcommand).toBe(".");
		expect(result.flags.format).toBe("json");
	});

	test("parses help command", () => {
		const result = parseArgs(["help"]);
		expect(result.command).toBe("help");
	});

	test("parses --help flag", () => {
		const result = parseArgs(["--help"]);
		expect(result.flags.help).toBe(true);
	});
});
