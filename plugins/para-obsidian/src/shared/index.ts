/**
 * Shared infrastructure utilities.
 *
 * This module exports shared utilities for filesystem operations, logging,
 * security, and reliability features used across the para-obsidian plugin.
 *
 * @module shared
 */

export * from "./atomic-fs";
export * from "./file-lock";
export * from "./fs";
export * from "./logger";
export * from "./transaction";
export * from "./validation";
