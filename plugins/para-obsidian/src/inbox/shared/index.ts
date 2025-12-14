/**
 * Shared utilities for inbox processing
 */

export type { ErrorCategory, ErrorCode, ErrorContext } from "../types";
export {
	createInboxError,
	InboxError,
	isInboxError,
	isRecoverableError,
} from "./errors";
