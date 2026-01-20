import { describe, expect, test } from "bun:test";
import { formatBytes } from "./bytes.js";

describe("formatBytes", () => {
	test("formats zero bytes", () => {
		expect(formatBytes(0)).toBe("0 B");
	});

	test("formats bytes (under 1 KB)", () => {
		expect(formatBytes(500)).toBe("500 B");
		expect(formatBytes(1023)).toBe("1023 B");
	});

	test("formats kilobytes", () => {
		expect(formatBytes(1024)).toBe("1 KB");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(2048)).toBe("2 KB");
	});

	test("formats megabytes", () => {
		expect(formatBytes(1048576)).toBe("1 MB");
		expect(formatBytes(1572864)).toBe("1.5 MB");
		expect(formatBytes(5242880)).toBe("5 MB");
	});

	test("formats gigabytes", () => {
		expect(formatBytes(1073741824)).toBe("1 GB");
		expect(formatBytes(2147483648)).toBe("2 GB");
		expect(formatBytes(1610612736)).toBe("1.5 GB");
	});

	test("formats terabytes", () => {
		expect(formatBytes(1099511627776)).toBe("1 TB");
		expect(formatBytes(2199023255552)).toBe("2 TB");
	});

	test("respects decimal places parameter", () => {
		expect(formatBytes(1536, 0)).toBe("2 KB");
		expect(formatBytes(1536, 1)).toBe("1.5 KB");
		expect(formatBytes(1536, 2)).toBe("1.5 KB");
		expect(formatBytes(1234567, 3)).toBe("1.177 MB");
	});

	test("handles negative decimals by treating as zero", () => {
		expect(formatBytes(1536, -1)).toBe("2 KB");
	});

	test("uses default 2 decimals when not specified", () => {
		expect(formatBytes(1234567)).toBe("1.18 MB");
	});

	test("rounds to nearest decimal", () => {
		expect(formatBytes(1234, 2)).toBe("1.21 KB");
		expect(formatBytes(1234567, 2)).toBe("1.18 MB");
	});
});
