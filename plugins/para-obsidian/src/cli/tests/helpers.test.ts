/**
 * Tests for CLI helper functions.
 *
 * @module cli.helpers.test
 */

import { describe, expect, test } from "bun:test";
import { parseArgOverrides } from "./cli-helpers";

describe("parseArgOverrides", () => {
	test("parses simple key=value pairs", () => {
		const result = parseArgOverrides(["area=[[Work]]", "status=active"]);
		expect(result).toEqual({
			area: "[[Work]]",
			status: "active",
		});
	});

	test("handles values with equals signs", () => {
		const result = parseArgOverrides(["formula=a=b+c"]);
		expect(result).toEqual({
			formula: "a=b+c",
		});
	});

	test("trims whitespace from keys and values", () => {
		const result = parseArgOverrides([
			"  area  =  [[Work]]  ",
			"status  =active",
		]);
		expect(result).toEqual({
			area: "[[Work]]",
			status: "active",
		});
	});

	test("skips malformed args without equals", () => {
		const result = parseArgOverrides([
			"area=[[Work]]",
			"badarg",
			"status=active",
		]);
		expect(result).toEqual({
			area: "[[Work]]",
			status: "active",
		});
	});

	test("skips args with empty key", () => {
		const result = parseArgOverrides(["=value", "area=[[Work]]"]);
		expect(result).toEqual({
			area: "[[Work]]",
		});
	});

	test("skips args with empty value", () => {
		const result = parseArgOverrides(["key=", "area=[[Work]]"]);
		expect(result).toEqual({
			area: "[[Work]]",
		});
	});

	test("handles empty array", () => {
		const result = parseArgOverrides([]);
		expect(result).toEqual({});
	});

	test("handles wikilinks in values", () => {
		const result = parseArgOverrides([
			"project=[[Build Garden Shed]]",
			"area=[[Home]]",
		]);
		expect(result).toEqual({
			project: "[[Build Garden Shed]]",
			area: "[[Home]]",
		});
	});

	test("handles priority=high pattern", () => {
		const result = parseArgOverrides([
			"priority=high",
			"effort=small",
			"task_type=task",
		]);
		expect(result).toEqual({
			priority: "high",
			effort: "small",
			task_type: "task",
		});
	});
});
