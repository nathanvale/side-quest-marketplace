/**
 * Tests for basic template scaffold generator
 */

import { describe, expect, test } from "bun:test";
import { generateBasicScaffold } from "./scaffold";

describe("generateBasicScaffold", () => {
	test("generates valid Templater template", () => {
		const scaffold = generateBasicScaffold({
			name: "invoice",
			noteType: "invoice",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Invoice title",
					requirement: "required",
				},
				{
					name: "vendor",
					type: "string",
					description: "Vendor name",
					requirement: "required",
				},
				{
					name: "amount",
					type: "currency",
					description: "Invoice amount",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Invoice Title",
				vendor: "Vendor Name",
				amount: "Total Amount",
			},
		});

		// Verify frontmatter
		expect(scaffold).toContain("---");
		expect(scaffold).toContain("type: invoice");
		expect(scaffold).toContain("template_version: 1");
		expect(scaffold).toContain('created: <% tp.date.now("YYYY-MM-DD") %>');

		// Verify field prompts in frontmatter
		expect(scaffold).toContain(
			'title: "<% tp.system.prompt("Invoice Title") %>"',
		);
		expect(scaffold).toContain(
			'vendor: "<% tp.system.prompt("Vendor Name") %>"',
		);
		expect(scaffold).toContain('<% tp.system.prompt("Total Amount") %>');

		// Verify title prompt
		expect(scaffold).toContain('# <% tp.system.prompt("Title") %>');

		// Verify Details section
		expect(scaffold).toContain("## Details");
		expect(scaffold).toContain("**Invoice Title**: <% tp.frontmatter.title %>");
		expect(scaffold).toContain("**Vendor Name**: <% tp.frontmatter.vendor %>");

		// Verify Notes section
		expect(scaffold).toContain("## Notes");
		expect(scaffold).toContain(
			'<% tp.system.prompt("Additional notes (optional)") %>',
		);

		// Verify footer
		expect(scaffold).toContain("*Processed from inbox:");
	});

	test("marks optional fields correctly", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
				{
					name: "notes",
					type: "string",
					description: "Additional notes",
					requirement: "optional",
				},
			],
			fieldMappings: {
				title: "Title",
				notes: "Notes",
			},
		});

		// Required field without (optional) suffix
		expect(scaffold).toContain('title: "<% tp.system.prompt("Title") %>"');

		// Optional field with (optional) suffix
		expect(scaffold).toContain(
			'notes: "<% tp.system.prompt("Notes (optional)") %>"',
		);
	});

	test("handles date fields", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
				{
					name: "date",
					type: "date",
					description: "Service date",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
				date: "Service Date (YYYY-MM-DD)",
			},
		});

		// Date field without quotes (numeric context)
		expect(scaffold).toContain(
			'date: <% tp.system.prompt("Service Date (YYYY-MM-DD)") %>',
		);
	});

	test("handles currency fields", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
				{
					name: "amount",
					type: "currency",
					description: "Amount",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
				amount: "Total Amount",
			},
		});

		// Currency field without quotes (numeric context)
		expect(scaffold).toContain(
			'amount: <% tp.system.prompt("Total Amount") %>',
		);
	});

	test("handles number fields", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
				{
					name: "count",
					type: "number",
					description: "Item count",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
				count: "Number of Items",
			},
		});

		// Number field without quotes (numeric context)
		expect(scaffold).toContain(
			'count: <% tp.system.prompt("Number of Items") %>',
		);
	});

	test("generates valid YAML frontmatter", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
			},
		});

		// Frontmatter starts and ends with ---
		const lines = scaffold.split("\n");
		expect(lines[0]).toBe("---");
		const closingIndex = lines.findIndex(
			(line, idx) => idx > 0 && line === "---",
		);
		expect(closingIndex).toBeGreaterThan(0);
	});

	test("uses field mappings for prompt labels", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "providerName",
					type: "string",
					description: "Healthcare provider",
					requirement: "required",
				},
			],
			fieldMappings: {
				providerName: "Provider Name",
			},
		});

		// Uses mapped label, not field name or description
		expect(scaffold).toContain(
			'providerName: "<% tp.system.prompt("Provider Name") %>"',
		);
		expect(scaffold).toContain(
			"**Provider Name**: <% tp.frontmatter.providerName %>",
		);
	});

	test("handles empty field mappings by using field name", () => {
		const scaffold = generateBasicScaffold({
			name: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
			],
			fieldMappings: {},
		});

		// Falls back to field name
		expect(scaffold).toContain('title: "<% tp.system.prompt("title") %>"');
	});
});
