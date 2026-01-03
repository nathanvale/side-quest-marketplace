import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import {
	isProcessed,
	loadVoiceState,
	markAsProcessed,
	type ProcessedMemoMetadata,
	saveVoiceState,
	type VoiceState,
} from "./state";

describe("voice/state", () => {
	let tempDir: string;
	let stateFilePath: string;

	beforeEach(() => {
		tempDir = createTempDir("voice-state-");
		stateFilePath = join(tempDir, "voice-state.json");
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
	});

	describe("loadVoiceState", () => {
		test("returns empty state when file doesn't exist", () => {
			const state = loadVoiceState(stateFilePath);

			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("loads existing state from file", () => {
			const existingState: VoiceState = {
				processedMemos: {
					"20251228 143045-abc123.m4a": {
						processedAt: "2025-12-28T14:35:00Z",
						transcription: "Test transcription...",
						dailyNote: "2025-12-28",
					},
				},
				lastScan: "2025-12-28T14:35:00Z",
			};

			saveVoiceState(stateFilePath, existingState);
			const loaded = loadVoiceState(stateFilePath);

			expect(loaded.processedMemos).toEqual(existingState.processedMemos);
			expect(loaded.lastScan).toBe(existingState.lastScan);
		});

		test("handles corrupted JSON gracefully", () => {
			// Write invalid JSON
			writeFileSync(stateFilePath, "{ invalid json");

			const state = loadVoiceState(stateFilePath);

			// Should return empty state instead of crashing
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("returns empty state when processedMemos is an array", () => {
			// Invalid: processedMemos should be object, not array
			const invalidState = {
				processedMemos: ["item1", "item2"],
				lastScan: "2025-12-28T14:35:00Z",
			};

			writeFileSync(stateFilePath, JSON.stringify(invalidState));
			const state = loadVoiceState(stateFilePath);

			// Should return empty state (graceful degradation)
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("returns empty state when processedMemos entry missing required fields", () => {
			// Invalid: missing 'transcription' field
			const invalidState = {
				processedMemos: {
					"20251228 143045-abc123.m4a": {
						processedAt: "2025-12-28T14:35:00Z",
						dailyNote: "2025-12-28",
						// missing: transcription
					},
				},
				lastScan: "2025-12-28T14:35:00Z",
			};

			writeFileSync(stateFilePath, JSON.stringify(invalidState));
			const state = loadVoiceState(stateFilePath);

			// Should return empty state (graceful degradation)
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("returns empty state when processedMemos entry is not an object", () => {
			// Invalid: entry is a primitive, not an object
			const invalidState = {
				processedMemos: {
					"20251228 143045-abc123.m4a": "not an object",
				},
				lastScan: "2025-12-28T14:35:00Z",
			};

			writeFileSync(stateFilePath, JSON.stringify(invalidState));
			const state = loadVoiceState(stateFilePath);

			// Should return empty state (graceful degradation)
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("returns empty state when processedMemos is missing", () => {
			// Invalid: no processedMemos field
			const invalidState = {
				lastScan: "2025-12-28T14:35:00Z",
			};

			writeFileSync(stateFilePath, JSON.stringify(invalidState));
			const state = loadVoiceState(stateFilePath);

			// Should return empty state (graceful degradation)
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});

		test("returns empty state when root is not an object", () => {
			// Invalid: root is an array
			const invalidState = ["not", "an", "object"];

			writeFileSync(stateFilePath, JSON.stringify(invalidState));
			const state = loadVoiceState(stateFilePath);

			// Should return empty state (graceful degradation)
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();
		});
	});

	describe("saveVoiceState", () => {
		test("creates new state file", () => {
			const state: VoiceState = {
				processedMemos: {
					"20251228 143045-abc123.m4a": {
						processedAt: "2025-12-28T14:35:00Z",
						transcription: "Test transcription...",
						dailyNote: "2025-12-28",
					},
				},
				lastScan: "2025-12-28T14:35:00Z",
			};

			saveVoiceState(stateFilePath, state);

			expect(pathExistsSync(stateFilePath)).toBe(true);

			// Verify content
			const loaded = loadVoiceState(stateFilePath);
			expect(loaded).toEqual(state);
		});

		test("overwrites existing state file", () => {
			const initialState: VoiceState = {
				processedMemos: {
					"old.m4a": {
						processedAt: "2025-12-27T00:00:00Z",
						transcription: "Old",
						dailyNote: "2025-12-27",
					},
				},
				lastScan: "2025-12-27T00:00:00Z",
			};

			const newState: VoiceState = {
				processedMemos: {
					"new.m4a": {
						processedAt: "2025-12-28T00:00:00Z",
						transcription: "New",
						dailyNote: "2025-12-28",
					},
				},
				lastScan: "2025-12-28T00:00:00Z",
			};

			saveVoiceState(stateFilePath, initialState);
			saveVoiceState(stateFilePath, newState);

			const loaded = loadVoiceState(stateFilePath);
			expect(loaded).toEqual(newState);
		});

		test("creates parent directory if needed", () => {
			const nestedPath = join(tempDir, "nested", "dir", "state.json");

			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			saveVoiceState(nestedPath, state);

			expect(pathExistsSync(nestedPath)).toBe(true);
		});
	});

	describe("isProcessed", () => {
		test("returns false for unprocessed memo", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			expect(isProcessed(state, "20251228 143045-abc123.m4a")).toBe(false);
		});

		test("returns true for processed memo", () => {
			const state: VoiceState = {
				processedMemos: {
					"20251228 143045-abc123.m4a": {
						processedAt: "2025-12-28T14:35:00Z",
						transcription: "Test",
						dailyNote: "2025-12-28",
					},
				},
				lastScan: null,
			};

			expect(isProcessed(state, "20251228 143045-abc123.m4a")).toBe(true);
		});
	});

	describe("markAsProcessed", () => {
		test("adds new memo to state", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			const metadata: ProcessedMemoMetadata = {
				processedAt: "2025-12-28T14:35:00Z",
				transcription: "Test transcription...",
				dailyNote: "2025-12-28",
			};

			const updated = markAsProcessed(
				state,
				"20251228 143045-abc123.m4a",
				metadata,
			);

			expect(updated.processedMemos["20251228 143045-abc123.m4a"]).toEqual(
				metadata,
			);
			expect(updated.lastScan).toBe("2025-12-28T14:35:00Z");
		});

		test("updates existing memo", () => {
			const state: VoiceState = {
				processedMemos: {
					"20251228 143045-abc123.m4a": {
						processedAt: "2025-12-28T14:35:00Z",
						transcription: "Old transcription",
						dailyNote: "2025-12-28",
					},
				},
				lastScan: "2025-12-28T14:35:00Z",
			};

			const newMetadata: ProcessedMemoMetadata = {
				processedAt: "2025-12-29T10:00:00Z",
				transcription: "New transcription",
				dailyNote: "2025-12-29",
			};

			const updated = markAsProcessed(
				state,
				"20251228 143045-abc123.m4a",
				newMetadata,
			);

			expect(updated.processedMemos["20251228 143045-abc123.m4a"]).toEqual(
				newMetadata,
			);
			expect(updated.lastScan).toBe("2025-12-29T10:00:00Z");
		});

		test("preserves other processed memos", () => {
			const state: VoiceState = {
				processedMemos: {
					"existing.m4a": {
						processedAt: "2025-12-27T00:00:00Z",
						transcription: "Existing",
						dailyNote: "2025-12-27",
					},
				},
				lastScan: "2025-12-27T00:00:00Z",
			};

			const newMetadata: ProcessedMemoMetadata = {
				processedAt: "2025-12-28T14:35:00Z",
				transcription: "New",
				dailyNote: "2025-12-28",
			};

			const updated = markAsProcessed(state, "new.m4a", newMetadata);

			expect(updated.processedMemos["existing.m4a"]).toBeDefined();
			expect(updated.processedMemos["new.m4a"]).toBeDefined();
		});

		test("doesn't mutate original state", () => {
			const state: VoiceState = {
				processedMemos: {},
				lastScan: null,
			};

			const metadata: ProcessedMemoMetadata = {
				processedAt: "2025-12-28T14:35:00Z",
				transcription: "Test",
				dailyNote: "2025-12-28",
			};

			const updated = markAsProcessed(state, "test.m4a", metadata);

			// Original should be unchanged
			expect(state.processedMemos).toEqual({});
			expect(state.lastScan).toBeNull();

			// Updated should have the new memo
			expect(updated.processedMemos["test.m4a"]).toBeDefined();
		});
	});
});
