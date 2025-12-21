/**
 * Shared CLI utilities.
 *
 * This module provides common functionality used across CLI commands:
 * - Session management with correlation ID tracking
 * - Unified start/end output formatting
 *
 * @module cli/shared
 */

export { type Session, type SessionEndOptions, startSession } from "./session";
