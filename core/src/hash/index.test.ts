import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	contentId,
	fastHash,
	fastHashHex,
	md5,
	md5Binary,
	sha256,
	sha256Binary,
	sha256File,
	shortHash,
} from "./index";

describe("hash utilities", () => {
	describe("sha256", () => {
		it("hashes a string to 64 hex characters", () => {
			const hash = sha256("hello world");
			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[0-9a-f]+$/);
		});

		it("produces consistent hashes for same input", () => {
			const hash1 = sha256("test content");
			const hash2 = sha256("test content");
			expect(hash1).toBe(hash2);
		});

		it("produces different hashes for different input", () => {
			const hash1 = sha256("hello");
			const hash2 = sha256("world");
			expect(hash1).not.toBe(hash2);
		});

		it("handles empty string", () => {
			const hash = sha256("");
			expect(hash).toHaveLength(64);
			// Known SHA256 of empty string
			expect(hash).toBe(
				"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			);
		});
	});

	describe("sha256Binary", () => {
		it("hashes ArrayBuffer", () => {
			const buffer = new TextEncoder().encode("hello world").buffer;
			const hash = sha256Binary(buffer);
			expect(hash).toHaveLength(64);
			// Should match string version
			expect(hash).toBe(sha256("hello world"));
		});

		it("hashes Uint8Array", () => {
			const arr = new TextEncoder().encode("hello world");
			const hash = sha256Binary(arr);
			expect(hash).toHaveLength(64);
			expect(hash).toBe(sha256("hello world"));
		});
	});

	describe("sha256File", () => {
		it("hashes file contents", async () => {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hash-test-"));
			const tmpFile = path.join(tmpDir, "test.txt");
			fs.writeFileSync(tmpFile, "hello world", "utf8");

			try {
				const hash = await sha256File(tmpFile);
				expect(hash).toHaveLength(64);
				expect(hash).toBe(sha256("hello world"));
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});
	});

	describe("md5", () => {
		it("hashes a string to 32 hex characters", () => {
			const hash = md5("hello world");
			expect(hash).toHaveLength(32);
			expect(hash).toMatch(/^[0-9a-f]+$/);
		});

		it("produces known MD5 hash", () => {
			const hash = md5("hello world");
			expect(hash).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
		});
	});

	describe("md5Binary", () => {
		it("hashes binary data", () => {
			const arr = new TextEncoder().encode("hello world");
			const hash = md5Binary(arr);
			expect(hash).toBe(md5("hello world"));
		});
	});

	describe("fastHash", () => {
		it("returns a bigint or number", () => {
			const hash = fastHash("hello world");
			expect(typeof hash === "bigint" || typeof hash === "number").toBe(true);
		});

		it("produces consistent hashes", () => {
			const hash1 = fastHash("test");
			const hash2 = fastHash("test");
			expect(hash1).toBe(hash2);
		});

		it("produces different hashes for different input", () => {
			const hash1 = fastHash("hello");
			const hash2 = fastHash("world");
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("fastHashHex", () => {
		it("returns a hex string", () => {
			const hash = fastHashHex("hello world");
			expect(typeof hash).toBe("string");
			expect(hash).toMatch(/^[0-9a-f]+$/);
		});

		it("produces consistent hashes", () => {
			const hash1 = fastHashHex("test");
			const hash2 = fastHashHex("test");
			expect(hash1).toBe(hash2);
		});
	});

	describe("contentId", () => {
		it("returns first 12 characters of sha256", () => {
			const id = contentId("hello world");
			expect(id).toHaveLength(12);
			expect(id).toBe(sha256("hello world").slice(0, 12));
		});
	});

	describe("shortHash", () => {
		it("returns first 8 characters by default", () => {
			const hash = shortHash("hello world");
			expect(hash).toHaveLength(8);
			expect(hash).toBe(sha256("hello world").slice(0, 8));
		});

		it("accepts custom length", () => {
			const hash = shortHash("hello world", 16);
			expect(hash).toHaveLength(16);
			expect(hash).toBe(sha256("hello world").slice(0, 16));
		});
	});
});
