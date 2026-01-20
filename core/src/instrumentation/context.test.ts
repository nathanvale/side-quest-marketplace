import { describe, expect, test } from "bun:test";
import {
	createTraceContext,
	generateCorrelationId,
	getCurrentContext,
	runWithContext,
	runWithContextAsync,
	withChildContext,
	withChildContextAsync,
} from "./context.js";

describe("generateCorrelationId", () => {
	test("returns 8-character hex string", () => {
		const cid = generateCorrelationId();
		expect(cid).toMatch(/^[a-f0-9]{8}$/);
	});

	test("generates unique IDs", () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateCorrelationId());
		}
		expect(ids.size).toBe(100);
	});
});

describe("createTraceContext", () => {
	test("creates context with generated cid", () => {
		const ctx = createTraceContext();
		expect(ctx.cid).toMatch(/^[a-f0-9]{8}$/);
	});

	test("uses cid as sessionCid for root context", () => {
		const ctx = createTraceContext();
		expect(ctx.sessionCid).toBe(ctx.cid);
	});

	test("allows custom cid override", () => {
		const ctx = createTraceContext({ cid: "custom123" });
		expect(ctx.cid).toBe("custom123");
	});

	test("allows custom sessionCid override", () => {
		const ctx = createTraceContext({ sessionCid: "session456" });
		expect(ctx.sessionCid).toBe("session456");
	});

	test("inherits parent context when nested", () => {
		const parentCtx = createTraceContext({ cid: "parent00" });

		runWithContext(parentCtx, () => {
			const childCtx = createTraceContext();
			expect(childCtx.parentCid).toBe("parent00");
			expect(childCtx.sessionCid).toBe(parentCtx.sessionCid);
		});
	});

	test("explicit parentCid overrides inherited context", () => {
		const parentCtx = createTraceContext({ cid: "parent00" });

		runWithContext(parentCtx, () => {
			const childCtx = createTraceContext({ parentCid: "explicit1" });
			expect(childCtx.parentCid).toBe("explicit1");
		});
	});
});

describe("getCurrentContext", () => {
	test("returns undefined outside context", () => {
		expect(getCurrentContext()).toBeUndefined();
	});

	test("returns context inside runWithContext", () => {
		const ctx = createTraceContext({ cid: "testcid1" });

		runWithContext(ctx, () => {
			const current = getCurrentContext();
			expect(current).toBeDefined();
			expect(current?.cid).toBe("testcid1");
		});
	});

	test("returns undefined after context exits", () => {
		const ctx = createTraceContext();
		runWithContext(ctx, () => {
			// Inside context
		});
		expect(getCurrentContext()).toBeUndefined();
	});
});

describe("runWithContext", () => {
	test("returns function result", () => {
		const ctx = createTraceContext();
		const result = runWithContext(ctx, () => 42);
		expect(result).toBe(42);
	});

	test("propagates context to nested sync calls", () => {
		const ctx = createTraceContext({ cid: "outer123" });

		runWithContext(ctx, () => {
			const innerCtx = getCurrentContext();
			expect(innerCtx?.cid).toBe("outer123");

			// Nested function still has access
			const nestedResult = (() => {
				return getCurrentContext()?.cid;
			})();
			expect(nestedResult).toBe("outer123");
		});
	});

	test("isolates nested contexts", () => {
		const outerCtx = createTraceContext({ cid: "outer000" });

		runWithContext(outerCtx, () => {
			expect(getCurrentContext()?.cid).toBe("outer000");

			// Create nested context
			const innerCtx = createTraceContext({ cid: "inner000" });
			runWithContext(innerCtx, () => {
				expect(getCurrentContext()?.cid).toBe("inner000");
			});

			// Back to outer context
			expect(getCurrentContext()?.cid).toBe("outer000");
		});
	});

	test("throws errors through", () => {
		const ctx = createTraceContext();

		expect(() => {
			runWithContext(ctx, () => {
				throw new Error("test error");
			});
		}).toThrow("test error");
	});
});

describe("runWithContextAsync", () => {
	test("returns async function result", async () => {
		const ctx = createTraceContext();
		const result = await runWithContextAsync(ctx, async () => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return 42;
		});
		expect(result).toBe(42);
	});

	test("propagates context across async boundaries", async () => {
		const ctx = createTraceContext({ cid: "async123" });

		await runWithContextAsync(ctx, async () => {
			// Before await
			expect(getCurrentContext()?.cid).toBe("async123");

			await new Promise((resolve) => setTimeout(resolve, 1));

			// After await - context should still be available
			expect(getCurrentContext()?.cid).toBe("async123");
		});
	});

	test("maintains context through Promise.all", async () => {
		const ctx = createTraceContext({ cid: "promall1" });

		await runWithContextAsync(ctx, async () => {
			const results = await Promise.all([
				(async () => {
					await new Promise((resolve) => setTimeout(resolve, 1));
					return getCurrentContext()?.cid;
				})(),
				(async () => {
					await new Promise((resolve) => setTimeout(resolve, 2));
					return getCurrentContext()?.cid;
				})(),
			]);

			expect(results).toEqual(["promall1", "promall1"]);
		});
	});

	test("throws async errors through", async () => {
		const ctx = createTraceContext();

		await expect(
			runWithContextAsync(ctx, async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));
				throw new Error("async error");
			}),
		).rejects.toThrow("async error");
	});
});

describe("withChildContext", () => {
	test("creates child context with parent link", () => {
		const parentCtx = createTraceContext({ cid: "parent01" });

		runWithContext(parentCtx, () => {
			withChildContext(() => {
				const ctx = getCurrentContext();
				expect(ctx?.parentCid).toBe("parent01");
				expect(ctx?.cid).not.toBe("parent01");
			});
		});
	});

	test("returns function result", () => {
		const result = withChildContext(() => "child result");
		expect(result).toBe("child result");
	});

	test("inherits sessionCid from parent", () => {
		const parentCtx = createTraceContext({
			cid: "parent02",
			sessionCid: "sess0001",
		});

		runWithContext(parentCtx, () => {
			withChildContext(() => {
				const ctx = getCurrentContext();
				expect(ctx?.sessionCid).toBe("sess0001");
			});
		});
	});
});

describe("withChildContextAsync", () => {
	test("creates async child context with parent link", async () => {
		const parentCtx = createTraceContext({ cid: "aparent1" });

		await runWithContextAsync(parentCtx, async () => {
			await withChildContextAsync(async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));
				const ctx = getCurrentContext();
				expect(ctx?.parentCid).toBe("aparent1");
				expect(ctx?.cid).not.toBe("aparent1");
			});
		});
	});

	test("returns async function result", async () => {
		const result = await withChildContextAsync(async () => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return "async child result";
		});
		expect(result).toBe("async child result");
	});
});

describe("trace hierarchy", () => {
	test("builds correct parent-child chain", async () => {
		const trace: Array<{ cid: string; parentCid?: string; op: string }> = [];

		const sessionCtx = createTraceContext({ cid: "session0" });

		await runWithContextAsync(sessionCtx, async () => {
			const ctx = getCurrentContext()!;
			trace.push({ cid: ctx.cid, parentCid: ctx.parentCid, op: "session" });

			await withChildContextAsync(async () => {
				const ctx = getCurrentContext()!;
				trace.push({ cid: ctx.cid, parentCid: ctx.parentCid, op: "scan" });

				await withChildContextAsync(async () => {
					const ctx = getCurrentContext()!;
					trace.push({ cid: ctx.cid, parentCid: ctx.parentCid, op: "process" });
				});
			});
		});

		expect(trace).toHaveLength(3);
		expect(trace[0]!.op).toBe("session");
		expect(trace[0]!.parentCid).toBeUndefined();

		expect(trace[1]!.op).toBe("scan");
		expect(trace[1]!.parentCid).toBe("session0");

		expect(trace[2]!.op).toBe("process");
		expect(trace[2]!.parentCid).toBe(trace[1]!.cid);
	});
});
