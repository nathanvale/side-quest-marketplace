/**
 * JSONL-based SLO event persistence with rotation and circuit breaker.
 */

import { join } from "node:path";
import {
	appendToFile,
	ensureDir,
	pathExists,
	readTextFile,
	stat,
	writeTextFileAtomic,
} from "../fs/index.js";
import type { SLOEvent, SLOLogger } from "./types.js";

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
	/** Path to JSONL file */
	filePath: string;
	/** Max file size before rotation (bytes) */
	maxSizeBytes: number;
	/** Max age in days for events */
	maxAgeDays: number;
	/** Optional logger */
	logger?: SLOLogger;
}

/**
 * SLO event persistence manager
 *
 * Handles JSONL storage with automatic rotation, pruning, and circuit breaker.
 */
export class SLOPersistence {
	private readonly config: PersistenceConfig;
	private eventsLoaded = false;
	private loadPromise: Promise<void> | null = null;
	private writeChain: Promise<void> = Promise.resolve();
	private writeFailures = 0;
	private readonly MAX_WRITE_FAILURES = 3;

	constructor(config: PersistenceConfig) {
		this.config = config;
	}

	/**
	 * Load events from disk (lazy, once per instance)
	 *
	 * @returns Map of SLO name to events
	 */
	async loadEvents(): Promise<Map<string, SLOEvent[]>> {
		// If already loaded, return existing promise
		if (this.eventsLoaded && !this.loadPromise) {
			return this.readEventsFromDisk();
		}

		if (this.loadPromise) {
			await this.loadPromise;
			return this.readEventsFromDisk();
		}

		// Create load promise to prevent duplicate loads
		this.loadPromise = (async () => {
			try {
				const fileExists = await pathExists(this.config.filePath);

				if (!fileExists) {
					this.config.logger?.info("No existing SLO events file found", {
						path: this.config.filePath,
					});
					return;
				}

				const events = await this.readEventsFromDisk();
				const cutoffTime =
					Date.now() - this.config.maxAgeDays * 24 * 60 * 60 * 1000;

				// Count stale events
				let totalCount = 0;
				let prunedCount = 0;
				for (const evts of events.values()) {
					for (const evt of evts) {
						totalCount++;
						if (evt.timestamp < cutoffTime) {
							prunedCount++;
						}
					}
				}

				// If >10% stale, trigger rotation
				if (totalCount > 0 && prunedCount / totalCount > 0.1) {
					this.config.logger?.info("Rotating SLO events file (stale data)", {
						totalEvents: totalCount,
						prunedEvents: prunedCount,
					});
					await this.rotateEventsFile(events);
				}
			} catch (error: unknown) {
				this.config.logger?.error("Failed to load SLO events from disk", {
					error,
				});
			} finally {
				// CRITICAL: Set eventsLoaded BEFORE clearing loadPromise to prevent race condition
				this.eventsLoaded = true;
				this.loadPromise = null;
			}
		})();

		await this.loadPromise;
		return this.readEventsFromDisk();
	}

	/**
	 * Read events from disk into a map
	 */
	private async readEventsFromDisk(): Promise<Map<string, SLOEvent[]>> {
		const sloEvents = new Map<string, SLOEvent[]>();

		const fileExists = await pathExists(this.config.filePath);
		if (!fileExists) {
			return sloEvents;
		}

		const content = await readTextFile(this.config.filePath);
		const lines = content.trim().split("\n").filter(Boolean);

		const cutoffTime =
			Date.now() - this.config.maxAgeDays * 24 * 60 * 60 * 1000;

		for (const line of lines) {
			try {
				const event = JSON.parse(line) as SLOEvent;

				// Skip events older than maxAgeDays
				if (event.timestamp < cutoffTime) {
					continue;
				}

				const events = sloEvents.get(event.sloName) ?? [];
				events.push(event);
				sloEvents.set(event.sloName, events);
			} catch (error: unknown) {
				this.config.logger?.error("Failed to parse SLO event line", {
					line: line.substring(0, 100),
					error,
				});
			}
		}

		return sloEvents;
	}

	/**
	 * Append a single SLO event to disk (fire-and-forget, non-blocking)
	 *
	 * @param event - SLO event to persist
	 */
	async appendEvent(event: SLOEvent): Promise<void> {
		// Ensure parent directory exists
		const parentDir = join(this.config.filePath, "..");
		await ensureDir(parentDir);

		// Check if file exists and size
		const fileExists = await pathExists(this.config.filePath);
		if (fileExists) {
			const stats = await stat(this.config.filePath);
			const currentSize = stats.size;

			// If file exceeds max size, rotate it first
			if (currentSize >= this.config.maxSizeBytes) {
				this.config.logger?.info("Rotating SLO events file (size limit)", {
					currentSize,
					maxSize: this.config.maxSizeBytes,
				});
				const events = await this.readEventsFromDisk();
				await this.rotateEventsFile(events);
			}
		}

		// Serialize disk writes to prevent interleaving
		this.writeChain = this.writeChain
			.then(() => {
				// Circuit breaker: Skip writes if too many failures
				if (this.writeFailures >= this.MAX_WRITE_FAILURES) {
					this.config.logger?.error(
						"SLO persistence disabled - too many consecutive failures",
					);
					return;
				}

				// Append event as JSON line
				const line = `${JSON.stringify(event)}\n`;
				return appendToFile(this.config.filePath, line);
			})
			.then(() => {
				// Reset failure count on success
				this.writeFailures = 0;
			})
			.catch((error: unknown) => {
				// Increment failure count and log
				this.writeFailures++;
				this.config.logger?.error("Failed to persist SLO event", {
					failureCount: this.writeFailures,
					maxFailures: this.MAX_WRITE_FAILURES,
					error,
				});
				if (this.writeFailures >= this.MAX_WRITE_FAILURES) {
					this.config.logger?.error(
						"SLO persistence disabled - too many failures",
					);
				}
			});
	}

	/**
	 * Rotate the events file when it exceeds size limit or has too many stale events.
	 * Rewrites the file with only recent events (atomic operation).
	 */
	private async rotateEventsFile(
		events: Map<string, SLOEvent[]>,
	): Promise<void> {
		const cutoffTime =
			Date.now() - this.config.maxAgeDays * 24 * 60 * 60 * 1000;

		// Collect all recent events
		const allEvents: SLOEvent[] = [];
		for (const evts of events.values()) {
			for (const event of evts) {
				if (event.timestamp >= cutoffTime) {
					allEvents.push(event);
				}
			}
		}

		// Write atomically (temp file + rename)
		const lines = allEvents.map((e) => JSON.stringify(e)).join("\n");
		const content = lines ? `${lines}\n` : "";
		await writeTextFileAtomic(this.config.filePath, content);

		this.config.logger?.info("SLO events file rotated", {
			eventCount: allEvents.length,
		});
	}

	/**
	 * Reset internal state (useful for testing)
	 */
	reset(): void {
		this.eventsLoaded = false;
		this.loadPromise = null;
		this.writeChain = Promise.resolve();
		this.writeFailures = 0;
	}
}
