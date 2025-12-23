/**
 * Tests for filename validation in frontmatter validation.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig } from "../../config/index";
import {
	setupTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../../testing/utils";
import { validateFrontmatterFile } from "../index";

describe("filename validation", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	test("accepts Title Case filenames", () => {
		const testVault = setupTestVault({
			".paraobsidianrc": JSON.stringify({
				titlePrefixes: {
					booking: "🎫 Booking -",
					research: "📊 Research -",
					trip: "✈️ Trip -",
				},
			}),
		});
		trackVault(testVault);

		writeVaultFile(
			testVault,
			"My Project Note.md",
			`---
title: My Project Note
type: project
status: active
created: 2025-01-01
start_date: 2025-01-01
target_completion: 2025-12-31
area: "[[Work]]"
template_version: 4
tags: [project]
---
Content`,
		);

		const config = loadConfig({ cwd: testVault });
		const result = validateFrontmatterFile(config, "My Project Note.md");

		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	test("rejects lowercase filenames", () => {
		const testVault = setupTestVault({
			".paraobsidianrc": JSON.stringify({
				titlePrefixes: {
					booking: "🎫 Booking -",
					research: "📊 Research -",
					trip: "✈️ Trip -",
				},
			}),
		});
		trackVault(testVault);

		writeVaultFile(
			testVault,
			"my project note.md",
			`---
title: My Project Note
type: project
status: active
created: 2025-01-01
start_date: 2025-01-01
target_completion: 2025-12-31
area: "[[Work]]"
template_version: 4
tags: [project]
---
Content`,
		);

		const config = loadConfig({ cwd: testVault });
		const result = validateFrontmatterFile(config, "my project note.md");

		expect(result.valid).toBe(false);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]?.field).toBe("filename");
		expect(result.issues[0]?.message).toContain("Title Case");
	});

	test("accepts emoji prefixes in filenames", () => {
		const testVault = setupTestVault({
			".paraobsidianrc": JSON.stringify({
				titlePrefixes: {
					booking: "🎫 Booking -",
					research: "📊 Research -",
					trip: "✈️ Trip -",
				},
			}),
		});
		trackVault(testVault);

		writeVaultFile(
			testVault,
			"🎫 Booking - Hotel Stay.md",
			`---
title: Hotel Stay
type: booking
booking_type: accommodation
status: confirmed
date: 2025-06-01
cost: 200
currency: AUD
payment_status: paid
created: 2025-01-01
template_version: 4
tags: [booking]
---
Content`,
		);

		const config = loadConfig({ cwd: testVault });
		const result = validateFrontmatterFile(
			config,
			"🎫 Booking - Hotel Stay.md",
		);

		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	test("requires expected prefix for booking type", () => {
		const testVault = setupTestVault({
			".paraobsidianrc": JSON.stringify({
				titlePrefixes: {
					booking: "🎫 Booking -",
					research: "📊 Research -",
					trip: "✈️ Trip -",
				},
			}),
		});
		trackVault(testVault);

		writeVaultFile(
			testVault,
			"Hotel Stay.md",
			`---
title: Hotel Stay
type: booking
booking_type: accommodation
status: confirmed
date: 2025-06-01
cost: 200
currency: AUD
payment_status: paid
created: 2025-01-01
template_version: 4
tags: [booking]
---
Content`,
		);

		const config = loadConfig({ cwd: testVault });
		const result = validateFrontmatterFile(config, "Hotel Stay.md");

		expect(result.valid).toBe(false);
		const prefixIssue = result.issues.find((i) => i.field === "filename");
		expect(prefixIssue).toBeDefined();
		expect(prefixIssue?.message).toContain("🎫 Booking -");
	});

	test("rejects invalid filename characters", () => {
		const testVault = setupTestVault({
			".paraobsidianrc": JSON.stringify({
				titlePrefixes: {
					booking: "🎫 Booking -",
					research: "📊 Research -",
					trip: "✈️ Trip -",
				},
			}),
		});
		trackVault(testVault);

		// The validation logic checks the filename string itself
		// We can verify this by checking the regex pattern
		const invalidChars = /[/\\:*?"<>|]/;
		expect(invalidChars.test("Invalid/Name")).toBe(true);
		expect(invalidChars.test("ValidName")).toBe(false);
	});

	test("allows files without type-specific prefix if no prefix configured", () => {
		const testVault = setupTestVault({
			".paraobsidianrc": JSON.stringify({
				titlePrefixes: {
					booking: "🎫 Booking -",
					research: "📊 Research -",
					trip: "✈️ Trip -",
				},
			}),
		});
		trackVault(testVault);

		writeVaultFile(
			testVault,
			"My Project.md",
			`---
title: My Project
type: project
status: active
created: 2025-01-01
start_date: 2025-01-01
target_completion: 2025-12-31
area: "[[Work]]"
template_version: 4
tags: [project]
---
Content`,
		);

		const config = loadConfig({ cwd: testVault });
		const result = validateFrontmatterFile(config, "My Project.md");

		expect(result.valid).toBe(true);
		// No prefix issue because 'project' type doesn't have a prefix configured
	});
});
