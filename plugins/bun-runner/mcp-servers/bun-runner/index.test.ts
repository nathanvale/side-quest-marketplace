import { describe, expect, it } from "bun:test";
import { parseBunTestOutput } from "./index";

describe("parseBunTestOutput", () => {
	it("parses all passing tests", () => {
		const output = `bun test v1.3.2

 3 pass
 0 fail
 5 expect() calls
Ran 3 tests across 1 file. [50.00ms]`;

		const result = parseBunTestOutput(output);

		expect(result.passed).toBe(3);
		expect(result.failed).toBe(0);
		expect(result.total).toBe(3);
		expect(result.failures).toHaveLength(0);
	});

	it("parses failing tests with pass/fail summary", () => {
		const output = `bun test v1.3.2

✗ should add numbers [1.23ms]
  error: expect(received).toBe(expected)
  Expected: 5
  Received: 4
      at /path/to/math.test.ts:10:5

 2 pass
 1 fail
 3 expect() calls
Ran 3 tests across 1 file. [50.00ms]`;

		const result = parseBunTestOutput(output);

		expect(result.passed).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.total).toBe(3);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.file).toBe("/path/to/math.test.ts");
		expect(result.failures[0]?.line).toBe(10);
		expect(result.failures[0]?.message).toContain("✗ should add numbers");
	});

	it("parses multiple failures", () => {
		const output = `bun test v1.3.2

✗ test one [1.00ms]
  error: first error
      at /path/to/one.test.ts:5:3

✗ test two [2.00ms]
  error: second error
      at /path/to/two.test.ts:15:7

 0 pass
 2 fail`;

		const result = parseBunTestOutput(output);

		expect(result.passed).toBe(0);
		expect(result.failed).toBe(2);
		expect(result.failures).toHaveLength(2);
		expect(result.failures[0]?.file).toBe("/path/to/one.test.ts");
		expect(result.failures[0]?.line).toBe(5);
		expect(result.failures[1]?.file).toBe("/path/to/two.test.ts");
		expect(result.failures[1]?.line).toBe(15);
	});

	it("handles FAIL keyword", () => {
		const output = `FAIL src/index.test.ts
  error: something went wrong

 0 pass
 1 fail`;

		const result = parseBunTestOutput(output);

		expect(result.failed).toBe(1);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.message).toContain("FAIL");
	});

	it("handles empty output", () => {
		const result = parseBunTestOutput("");

		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
		expect(result.total).toBe(0);
		expect(result.failures).toHaveLength(0);
	});

	it("extracts stack traces", () => {
		const output = `✗ my test
  error: oops
      at someFunc (/path/file.ts:10:5)
      at anotherFunc (/path/other.ts:20:10)

 0 pass
 1 fail`;

		const result = parseBunTestOutput(output);

		expect(result.failures[0]?.stack).toContain("at someFunc");
		expect(result.failures[0]?.stack).toContain("at anotherFunc");
	});

	it("parses Bun v1.3+ format with (fail) marker", () => {
		// Bun v1.3+ shows error/diff first, then stack, then (fail) marker
		const output = `bun test v1.3.3 (274e01c7)

.test-scratch/test-standard/fail.test.ts:
1 | import { expect, test } from "bun:test";
2 |
3 | test("should fail", () => {
4 |   expect({ name: "Alice" }).toEqual({ name: "Bob" });
                                ^
error: expect(received).toEqual(expected)

  {
-   "name": "Bob",
+   "name": "Alice",
  }

- Expected  - 1
+ Received  + 1

      at <anonymous> (/path/to/fail.test.ts:4:38)
(fail) should fail [0.21ms]

 0 pass
 1 fail`;

		const result = parseBunTestOutput(output);

		expect(result.passed).toBe(0);
		expect(result.failed).toBe(1);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.file).toBe("/path/to/fail.test.ts");
		expect(result.failures[0]?.line).toBe(4);
		expect(result.failures[0]?.message).toContain("should fail");
		expect(result.failures[0]?.message).toContain("expect(received).toEqual(expected)");
		expect(result.failures[0]?.message).toContain('"name": "Alice"');
	});

	it("parses multiple failures in Bun v1.3+ format", () => {
		const output = `bun test v1.3.3 (274e01c7)

error: expect(received).toEqual(expected)
Expected: 5
Received: 4

      at <anonymous> (/path/to/math.test.ts:10:5)
(fail) test one [0.10ms]

error: expect(received).toBe(expected)
Expected: "hello"
Received: "world"

      at <anonymous> (/path/to/string.test.ts:20:8)
(fail) test two [0.05ms]

 0 pass
 2 fail`;

		const result = parseBunTestOutput(output);

		expect(result.passed).toBe(0);
		expect(result.failed).toBe(2);
		expect(result.failures).toHaveLength(2);
		expect(result.failures[0]?.file).toBe("/path/to/math.test.ts");
		expect(result.failures[0]?.line).toBe(10);
		expect(result.failures[0]?.message).toContain("test one");
		expect(result.failures[1]?.file).toBe("/path/to/string.test.ts");
		expect(result.failures[1]?.line).toBe(20);
		expect(result.failures[1]?.message).toContain("test two");
	});
});
