/**
 * Tests for voice memo state management module.
 *
 * @module voice-memo/state.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isProcessed,
	loadVoiceState,
	markAsProcessed,
	markAsSkipped,
	saveVoiceState,
	type VoiceState,
} from "./state.ts";

describe("voice/state", () => {
	let testDir: string;
	let stateFilePath: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `voice-state-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		stateFilePath = join(testDir, "voice-state.json");
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("loadVoiceState", () => {
		test("returns empty state for non-existent file", () => {
			const state = loadVoiceState(stateFilePath);

			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("loads valid state from file", () => {
			const savedState: VoiceState = {
				processedMemos: {
					"memo1.m4a": {
						processedAt: "2025-01-15T10:00:00.000Z",
						transcription: "Test transcription",
						dailyNote: "2025-01-15",
					},
				},
				lastScan: "2025-01-15T10:00:00.000Z",
			};
			writeFileSync(stateFilePath, JSON.stringify(savedState));

			const state = loadVoiceState(stateFilePath);

			expect(state.processedMemos["memo1.m4a"]).toBeDefined();
			expect(state.lastScan).toBe("2025-01-15T10:00:00.000Z");
		});

		test("returns empty state for corrupted JSON", () => {
			writeFileSync(stateFilePath, "{ invalid json");

			const state = loadVoiceState(stateFilePath);

			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("returns empty state for invalid structure", () => {
			writeFileSync(stateFilePath, JSON.stringify({ invalidKey: "value" }));

			const state = loadVoiceState(stateFilePath);

			expect(state.processedMemos).toEqual({});
		});
	});

	describe("saveVoiceState", () => {
		test("saves state to file", () => {
			const state: VoiceState = {
				processedMemos: {
					"memo1.m4a": {
						processedAt: "2025-01-15T10:00:00.000Z",
						transcription: "Test",
						dailyNote: "2025-01-15",
					},
				},
				lastScan: "2025-01-15T10:00:00.000Z",
			};

			saveVoiceState(stateFilePath, state);

			const loaded = loadVoiceState(stateFilePath);
			expect(loaded.processedMemos["memo1.m4a"]).toBeDefined();
		});

		test("creates parent directories", () => {
			const nestedPath = join(testDir, "nested", "dir", "state.json");
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			saveVoiceState(nestedPath, state);

			const loaded = loadVoiceState(nestedPath);
			expect(loaded.processedMemos).toEqual({});
		});
	});

	describe("isProcessed", () => {
		test("returns true for processed memo", () => {
			const state: VoiceState = {
				processedMemos: {
					"memo1.m4a": {
						processedAt: "2025-01-15T10:00:00.000Z",
						transcription: "Test",
						dailyNote: "2025-01-15",
					},
				},
				lastScan: null,
			};

			expect(isProcessed(state, "memo1.m4a")).toBe(true);
		});

		test("returns false for unprocessed memo", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			expect(isProcessed(state, "memo1.m4a")).toBe(false);
		});
	});

	describe("markAsProcessed", () => {
		test("adds memo to state", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			const newState = markAsProcessed(state, "memo1.m4a", {
				processedAt: "2025-01-15T10:00:00.000Z",
				transcription: "Test transcription",
				dailyNote: "2025-01-15",
			});

			expect(newState.processedMemos["memo1.m4a"]).toBeDefined();
			expect(newState.lastScan).toBe("2025-01-15T10:00:00.000Z");
		});

		test("does not mutate original state", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			markAsProcessed(state, "memo1.m4a", {
				processedAt: "2025-01-15T10:00:00.000Z",
				transcription: "Test",
				dailyNote: "2025-01-15",
			});

			expect(state.processedMemos).toEqual({});
		});
	});

	describe("markAsSkipped", () => {
		test("marks memo as skipped with reason", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			const newState = markAsSkipped(state, "memo1.m4a", "empty transcription");

			const memo = newState.processedMemos["memo1.m4a"];
			expect(memo).toBeDefined();
			expect("status" in memo!).toBe(true);
			if ("status" in memo!) {
				expect(memo.status).toBe("skipped");
				expect(memo.reason).toBe("empty transcription");
			}
		});
	});
});
