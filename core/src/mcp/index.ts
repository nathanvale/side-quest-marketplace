/**
 * MCP Easy - Simplified MCP Server API
 *
 * Based on mcpez by John Lindquist (MIT License)
 * https://github.com/johnlindquist/mcpez
 *
 * Forked into @sidequest/core to fix ToolOptions type (missing annotations field)
 * and provide a single source of truth for MCP server development.
 *
 * ## Why This Abstraction Exists
 *
 * The official `@modelcontextprotocol/sdk` is powerful but verbose. Building an
 * MCP server requires significant boilerplate: creating server instances, managing
 * transport connections, handling registration timing, and navigating complex
 * TypeScript overloads that often resolve to `never`.
 *
 * This module eliminates that friction with a declarative, function-based API.
 *
 * ## Key Benefits
 *
 * ### 1. Drastically Reduced Boilerplate
 *
 * **Without this abstraction (official SDK):**
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 * import { z } from "zod";
 *
 * const server = new McpServer({ name: "my-server", version: "1.0.0" });
 *
 * server.registerTool("greet", {
 *   description: "Greet someone",
 *   inputSchema: { name: z.string() },
 * }, async ({ name }) => ({ content: [{ type: "text", text: `Hello ${name}!` }] }));
 *
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 * process.stdin.resume(); // Keep alive for stdio
 * ```
 *
 * **With this abstraction:**
 * ```ts
 * import { tool, z } from "@sidequest/core/mcp";
 *
 * tool("greet", {
 *   description: "Greet someone",
 *   inputSchema: { name: z.string() },
 * }, async ({ name }) => ({ content: [{ type: "text", text: `Hello ${name}!` }] }));
 * ```
 *
 * That's it. The server auto-starts, transport connects, and process stays alive.
 *
 * ### 2. Deferred Registration (Call Order Independence)
 *
 * Tools, prompts, and resources can be registered **before** the server starts.
 * Registrations are queued and flushed when the server connects. This enables:
 * - Modular code organization (register in separate files)
 * - No timing coordination between modules
 * - Dynamic registration at runtime
 *
 * ### 3. Auto-Start Behavior
 *
 * The server automatically starts on the next event loop tick after any
 * registration. No explicit `startServer()` call needed for simple cases.
 * For custom configuration, call `startServer(name, options)` explicitly.
 *
 * ### 4. Fixed TypeScript Types
 *
 * The official SDK's `registerTool` has complex overloads that cause
 * `Parameters<McpServer["registerTool"]>[1]` to resolve to `never`.
 * This module provides explicit `ToolOptions` with proper typing, including
 * the `annotations` field for tool behavior hints (missing in SDK types).
 *
 * ### 5. Zod Re-export
 *
 * Zod is re-exported so consumers don't need a separate dependency.
 * Handles Zod v3/v4 compatibility internally.
 *
 * ### 6. Structured Logging
 *
 * Simple logging API that queues messages until the server connects:
 * ```ts
 * import { log } from "@sidequest/core/mcp";
 * log.info({ action: "started" });
 * log.error({ error: "something failed" }, "my-logger");
 * ```
 *
 * ### 7. Optional File Logging (Observability)
 *
 * Enable JSONL file logging for debugging and post-mortem analysis:
 * ```ts
 * import { startServer, log, createCorrelationId } from "@sidequest/core/mcp";
 *
 * await startServer("my-plugin", {
 *   fileLogging: {
 *     enabled: true,
 *     subsystems: ["api", "cache"],
 *     level: "debug",
 *   },
 * });
 *
 * // Logs go to both MCP protocol AND ~/.claude/logs/my-plugin.jsonl
 * const correlationId = createCorrelationId();
 * log.info({ correlationId, action: "request-started" });
 * ```
 *
 * File logging features:
 * - Rotating JSONL files (1MB default, 5 files)
 * - Correlation IDs for request tracing
 * - Subsystem-based hierarchical logging
 * - Works even when MCP inspector disconnects
 *
 * ## When to Use This vs. Raw SDK
 *
 * **Use this abstraction when:**
 * - Building typical MCP servers with tools/prompts/resources
 * - You want minimal boilerplate and fast iteration
 * - You need deferred registration across modules
 *
 * **Use raw SDK when:**
 * - You need custom transport implementations
 * - You require fine-grained control over server lifecycle
 * - You're building MCP infrastructure (not servers)
 *
 * @module @sidequest/core/mcp
 */

import type { Logger } from "@logtape/logtape";
import type { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import type {
	ReadResourceCallback,
	ReadResourceTemplateCallback,
	ResourceMetadata,
	ResourceTemplate as ResourceTemplateType,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import {
	createCorrelationId,
	createPluginLogger,
	type LogLevel,
	type PluginLogger,
} from "../logging/index.ts";

// ============================================================================
// Internal State Management
// ============================================================================

type DeferredPrompt = {
	kind: "prompt";
	name: string;
	options: RegisterPromptOptions;
	handler: PromptHandler;
};

type DeferredTool = {
	kind: "tool";
	name: string;
	options: ToolOptions;
	handler: ToolHandler;
};

type DeferredResource = {
	kind: "resource";
	name: string;
	uriOrTemplate: string | ResourceTemplateType;
	metadata: ResourceOptions;
	readCallback: ResourceReadCallback | ResourceTemplateReadCallback;
};

type DeferredLog = {
	kind: "log";
	level: string;
	message?: string;
	logger?: string;
	data: unknown;
};

type DeferredNotification =
	| { kind: "resourceListChanged" }
	| { kind: "toolListChanged" }
	| { kind: "promptListChanged" };

type DeferredRegistration =
	| DeferredPrompt
	| DeferredTool
	| DeferredResource
	| DeferredLog
	| DeferredNotification;

let serverSingleton: McpServer | null = null;
const deferredRegistrations: DeferredRegistration[] = [];
let deferredRegistrationCallback: (() => void) | null = null;

// File logging state (optional observability layer)
let fileLogger: PluginLogger | null = null;
let fileLoggerRoot: Logger | null = null;

function hasServerStarted(): boolean {
	return serverSingleton !== null;
}

function setServerInstance(server: McpServer): void {
	serverSingleton = server;
}

function getServerInstance(): McpServer | null {
	return serverSingleton;
}

function setDeferredRegistrationCallback(callback: (() => void) | null): void {
	deferredRegistrationCallback = callback;
}

function enqueueRegistration(reg: DeferredRegistration): void {
	deferredRegistrations.push(reg);
	deferredRegistrationCallback?.();
}

function flushRegistrations(target: McpServer): void {
	const remaining: DeferredRegistration[] = [];
	const queued = deferredRegistrations.splice(0);
	for (const reg of queued) {
		switch (reg.kind) {
			case "prompt": {
				target.registerPrompt(
					reg.name,
					reg.options as unknown as Parameters<McpServer["registerPrompt"]>[1],
					reg.handler,
				);
				break;
			}
			case "tool":
				// Using 'any' because McpServer.registerTool has complex overloads
				// that TypeScript can't resolve when extracting parameter types
				target.registerTool(
					reg.name,
					// biome-ignore lint/suspicious/noExplicitAny: SDK overloads prevent proper typing
					reg.options as any,
					// biome-ignore lint/suspicious/noExplicitAny: SDK overloads prevent proper typing
					reg.handler as any,
				);
				break;
			case "resource":
				if (typeof reg.uriOrTemplate === "string") {
					target.registerResource(
						reg.name,
						reg.uriOrTemplate,
						reg.metadata,
						reg.readCallback as ResourceReadCallback,
					);
				} else {
					target.registerResource(
						reg.name,
						reg.uriOrTemplate,
						reg.metadata,
						reg.readCallback as ResourceTemplateReadCallback,
					);
				}
				break;
			case "log": {
				if (target.isConnected()) {
					void target.sendLoggingMessage({
						level: reg.level as Parameters<
							typeof target.sendLoggingMessage
						>[0]["level"],
						logger: reg.logger,
						data: reg.data,
					});
				} else {
					remaining.push(reg);
				}
				break;
			}
			case "resourceListChanged":
				target.sendResourceListChanged();
				break;
			case "toolListChanged":
				target.sendToolListChanged();
				break;
			case "promptListChanged":
				target.sendPromptListChanged();
				break;
		}
	}
	if (remaining.length > 0) {
		deferredRegistrations.push(...remaining);
	}
}

// ============================================================================
// Auto-start scheduling
// ============================================================================

let autoStartTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPendingAutoStart(): void {
	if (autoStartTimer !== null && typeof clearTimeout === "function") {
		clearTimeout(autoStartTimer);
	}
	autoStartTimer = null;
}

function scheduleAutomaticStart(): void {
	if (hasServerStarted() || autoStartTimer !== null) {
		return;
	}

	if (typeof setTimeout !== "function") {
		return;
	}

	autoStartTimer = setTimeout(() => {
		autoStartTimer = null;
		if (!hasServerStarted()) {
			void startServer().catch((error) => {
				const consoleLike = globalThis.console as
					| {
							error?: (message?: unknown, ...optionalParams: unknown[]) => void;
					  }
					| undefined;
				consoleLike?.error?.(
					"Failed to automatically start MCP server:",
					error,
				);
			});
		}
	}, 0);
}

setDeferredRegistrationCallback(scheduleAutomaticStart);

// ============================================================================
// Type Exports
// ============================================================================

export type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/** LoggingLevel is a union of valid log severity levels per MCP specification */
export type LoggingLevel =
	| "debug"
	| "info"
	| "notice"
	| "warning"
	| "error"
	| "critical"
	| "alert"
	| "emergency";

// Re-export Zod so users don't need to install it separately
export { z } from "zod";

// Re-export correlation ID helper for request tracing
export { createCorrelationId };

// ============================================================================
// Option Types (with fixed ToolOptions including annotations)
// ============================================================================

type RegisterPromptParams = Parameters<
	typeof McpServer.prototype.registerPrompt
>;
type SDKRegisterPromptOptions = RegisterPromptParams[1];
export type PromptHandler = RegisterPromptParams[2];

/** Prompt registration options with loosened Zod typing for v3/v4 compatibility */
export type RegisterPromptOptions = Omit<
	SDKRegisterPromptOptions,
	"argsSchema"
> & {
	argsSchema?: Record<string, unknown> | unknown;
};

/**
 * Tool registration options.
 *
 * Defined explicitly rather than derived from SDK types because
 * McpServer.registerTool has complex overloads that result in
 * Parameters<>[1] resolving to 'never'.
 *
 * Includes:
 * - Loosened Zod typing for v3/v4 compatibility
 * - annotations field for tool behavior hints
 */
export type ToolOptions = {
	/** Tool title (optional, for display) */
	title?: string;
	/** Tool description shown to LLMs */
	description?: string;
	/**
	 * Input schema (Zod or JSON Schema)
	 *
	 * IMPORTANT: Use plain object with Zod validators per field (mcpez pattern):
	 * ```typescript
	 * inputSchema: {
	 *   query: z.string().describe("Search query"),
	 *   limit: z.number().optional().describe("Max results")
	 * }
	 * ```
	 *
	 * NOT a Zod object wrapper:
	 * ```typescript
	 * inputSchema: z.object({ query: z.string() })  // WRONG!
	 * ```
	 */
	inputSchema?: Record<string, unknown> | unknown;
	/** Output schema (Zod or JSON Schema) */
	outputSchema?: Record<string, unknown> | unknown;
	/**
	 * Tool annotations providing hints about behavior.
	 * These help LLMs understand tool characteristics.
	 */
	annotations?: ToolAnnotations;
	/** Extra metadata */
	_meta?: Record<string, unknown>;
};

/** Tool callback function type */
export type ToolHandler = (
	args: Record<string, unknown>,
	extra: unknown,
) => unknown | Promise<unknown>;

export type ResourceOptions = ResourceMetadata;
export type ResourceReadCallback = ReadResourceCallback;
export type ResourceTemplateReadCallback = ReadResourceTemplateCallback;

// ============================================================================
// File Logging Configuration
// ============================================================================

/**
 * Configuration for optional JSONL file logging.
 *
 * When enabled, logs are written to both the MCP protocol (for Claude Desktop)
 * and to rotating JSONL files (for debugging and post-mortem analysis).
 *
 * @example
 * ```ts
 * await startServer("my-plugin", {
 *   fileLogging: {
 *     enabled: true,
 *     subsystems: ["api", "cache"],
 *     level: "debug",
 *   },
 * });
 * ```
 */
export interface FileLoggingConfig {
	/** Enable file logging (default: false) */
	enabled: boolean;
	/** Subsystem names for hierarchical logging (optional) */
	subsystems?: string[];
	/** Minimum log level (default: "info") */
	level?: LogLevel;
	/** Max file size in bytes before rotation (default: 1MB) */
	maxSize?: number;
	/** Number of rotated files to keep (default: 5) */
	maxFiles?: number;
}

/**
 * Extended server options including file logging configuration.
 */
export interface ServerConfig extends Record<string, unknown> {
	/** Server version (default: "1.0.0") */
	version?: string;
	/** Server capabilities */
	capabilities?: Record<string, unknown>;
	/** Server instructions for LLMs */
	instructions?: string;
	/** Optional file logging configuration */
	fileLogging?: FileLoggingConfig;
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Start the MCP server with optional configuration.
 * Must only be called once per process.
 *
 * @param name - Server name (used for identification and file logging)
 * @param serverOptions - Configuration including capabilities, instructions, and file logging
 * @param transport - Optional custom transport (defaults to StdioServerTransport)
 *
 * @example
 * ```ts
 * // Basic usage - auto-starts with defaults
 * tool("greet", { ... }, handler);
 *
 * // With file logging for debugging
 * await startServer("my-plugin", {
 *   version: "1.0.0",
 *   fileLogging: {
 *     enabled: true,
 *     subsystems: ["api", "cache"],
 *     level: "debug",
 *   },
 * });
 * ```
 */
export async function startServer(
	name = "mcpez",
	serverOptions?: ServerConfig,
	transport?: StdioServerTransport,
): Promise<void> {
	cancelPendingAutoStart();

	if (hasServerStarted()) {
		throw new Error(
			"MCP server already started. startServer must be called only once.",
		);
	}

	const {
		version,
		capabilities,
		instructions,
		fileLogging,
		...implementationDetails
	} = serverOptions ?? {};

	// Initialize file logging if configured
	if (fileLogging?.enabled) {
		fileLogger = createPluginLogger({
			name,
			subsystems: fileLogging.subsystems,
			lowestLevel: fileLogging.level,
			maxSize: fileLogging.maxSize,
			maxFiles: fileLogging.maxFiles,
		});
		await fileLogger.initLogger();
		fileLoggerRoot = fileLogger.rootLogger;
		fileLoggerRoot.info("MCP server starting with file logging enabled", {
			name,
		});
	}

	const baseCapabilities =
		capabilities && typeof capabilities === "object"
			? (capabilities as Record<string, unknown>)
			: undefined;

	const normalizedCapabilities: Record<string, unknown> = {
		...(baseCapabilities ?? {}),
	};
	const loggingCapability =
		baseCapabilities &&
		typeof baseCapabilities.logging === "object" &&
		baseCapabilities.logging !== null
			? (baseCapabilities.logging as Record<string, unknown>)
			: {};
	normalizedCapabilities.logging = loggingCapability;

	const server = new McpServer(
		{
			name,
			version: typeof version === "string" ? version : "1.0.0",
			...implementationDetails,
		},
		{
			capabilities: normalizedCapabilities as ServerOptions["capabilities"],
			instructions: typeof instructions === "string" ? instructions : undefined,
		},
	);

	setServerInstance(server);

	// Ensure any registrations done before start are attached now
	flushRegistrations(server);

	const chosenTransport = transport ?? new StdioServerTransport();
	await server.connect(chosenTransport);
	flushRegistrations(server);

	// Ensure the process stays alive for stdio transports, mirroring SDK behavior in Node
	if (
		typeof process !== "undefined" &&
		(process as unknown as { stdin?: unknown }).stdin
	) {
		const stdin = (process as unknown as { stdin?: { resume?: () => void } })
			.stdin;
		stdin?.resume?.();
	}

	// Exit the process when the transport closes (e.g., inspector disconnects)
	const t = chosenTransport as StdioServerTransport & { onclose?: () => void };
	t.onclose = () => {
		if (
			typeof process !== "undefined" &&
			(process as unknown as { exit?: (code?: number) => never }).exit
		) {
			try {
				(process as unknown as { exit: (code?: number) => never }).exit(0);
			} catch {
				// Ignore exit errors
			}
		}
	};
}

/**
 * Register a prompt with the MCP server.
 * Can be called before startServer() - registration will be queued.
 */
export function prompt(
	name: string,
	options: RegisterPromptOptions,
	handler: PromptHandler,
): void {
	const server = getServerInstance();
	if (server) {
		server.registerPrompt(
			name,
			options as unknown as SDKRegisterPromptOptions,
			handler,
		);
		return;
	}
	enqueueRegistration({ kind: "prompt", name, options, handler });
}

/**
 * Register a tool with the MCP server.
 * Can be called before startServer() - registration will be queued.
 */
export function tool(
	name: string,
	options: ToolOptions,
	handler: ToolHandler,
): void {
	const server = getServerInstance();
	if (server) {
		// Using 'any' because McpServer.registerTool has complex overloads
		// that TypeScript can't resolve when extracting parameter types
		server.registerTool(
			name,
			// biome-ignore lint/suspicious/noExplicitAny: SDK overloads prevent proper typing
			options as any,
			// biome-ignore lint/suspicious/noExplicitAny: SDK overloads prevent proper typing
			handler as any,
		);
		return;
	}
	enqueueRegistration({ kind: "tool", name, options, handler });
}

/**
 * Register a resource with the MCP server.
 * Can be called before startServer() - registration will be queued.
 */
export function resource(
	name: string,
	uri: string,
	metadata: ResourceOptions,
	readCallback: ResourceReadCallback,
): void;
export function resource(
	name: string,
	template: ResourceTemplateType,
	metadata: ResourceOptions,
	readCallback: ResourceTemplateReadCallback,
): void;
export function resource(
	name: string,
	uriOrTemplate: string | ResourceTemplateType,
	metadata: ResourceOptions,
	readCallback: ResourceReadCallback | ResourceTemplateReadCallback,
): void {
	const server = getServerInstance();
	if (server) {
		if (typeof uriOrTemplate === "string") {
			server.registerResource(
				name,
				uriOrTemplate,
				metadata,
				readCallback as ReadResourceCallback,
			);
		} else {
			server.registerResource(
				name,
				uriOrTemplate,
				metadata,
				readCallback as ReadResourceTemplateCallback,
			);
		}
		return;
	}
	enqueueRegistration({
		kind: "resource",
		name,
		uriOrTemplate,
		metadata,
		readCallback,
	});
}

/**
 * Register a resource template with the MCP server.
 * Can be called before startServer() - registration will be queued.
 */
export function resourceTemplate(
	name: string,
	template: ResourceTemplateType,
	metadata: ResourceOptions,
	readCallback: ResourceTemplateReadCallback,
): void {
	const server = getServerInstance();
	if (server) {
		server.registerResource(name, template, metadata, readCallback);
		return;
	}
	enqueueRegistration({
		kind: "resource",
		name,
		uriOrTemplate: template,
		metadata,
		readCallback,
	});
}

/**
 * Returns the MCP server instance, if it has been started.
 * Useful for advanced operations like sending notifications or accessing the underlying server.
 */
export function getServer(): McpServer | null {
	return getServerInstance();
}

// ============================================================================
// Logging API
// ============================================================================

type LogMethod = (data: unknown, logger?: string) => void;

export type LogApi = Record<LoggingLevel, LogMethod> & {
	emit: (level: LoggingLevel, data: unknown, logger?: string) => void;
};

/**
 * Map MCP logging levels to LogTape levels.
 * MCP has more granular levels than LogTape.
 */
const mcpToLogTapeLevel: Record<
	LoggingLevel,
	"debug" | "info" | "warning" | "error" | "fatal"
> = {
	debug: "debug",
	info: "info",
	notice: "info",
	warning: "warning",
	error: "error",
	critical: "error",
	alert: "fatal",
	emergency: "fatal",
};

function emitLog(level: LoggingLevel, data: unknown, logger?: string): void {
	// Dual-log to file if enabled (always, regardless of MCP connection)
	if (fileLoggerRoot) {
		const logTapeLevel = mcpToLogTapeLevel[level];
		// LogTape expects (message, properties) - convert data appropriately
		const props =
			typeof data === "object" && data !== null
				? (data as Record<string, unknown>)
				: { value: data };
		const loggerInstance = logger
			? (fileLogger?.subsystemLoggers?.[logger] ?? fileLoggerRoot)
			: fileLoggerRoot;

		switch (logTapeLevel) {
			case "debug":
				loggerInstance.debug("mcp-log", { level, logger, ...props });
				break;
			case "info":
				loggerInstance.info("mcp-log", { level, logger, ...props });
				break;
			case "warning":
				loggerInstance.warn("mcp-log", { level, logger, ...props });
				break;
			case "error":
				loggerInstance.error("mcp-log", { level, logger, ...props });
				break;
			case "fatal":
				loggerInstance.fatal("mcp-log", { level, logger, ...props });
				break;
		}
	}

	// Send to MCP protocol
	const server = getServerInstance();
	if (server) {
		void server.sendLoggingMessage({ level, data, logger });
		return;
	}
	enqueueRegistration({ kind: "log", level, data, logger });
}

const logObject: LogApi = {
	emit: emitLog,
	debug: (data, logger) => emitLog("debug", data, logger),
	info: (data, logger) => emitLog("info", data, logger),
	notice: (data, logger) => emitLog("notice", data, logger),
	warning: (data, logger) => emitLog("warning", data, logger),
	error: (data, logger) => emitLog("error", data, logger),
	critical: (data, logger) => emitLog("critical", data, logger),
	alert: (data, logger) => emitLog("alert", data, logger),
	emergency: (data, logger) => emitLog("emergency", data, logger),
};

/**
 * Logging helpers for sending MCP logging notifications.
 * Use `log.info(data)` or other severity helpers for convenience,
 * or `log.emit(level, data)` for dynamic levels.
 */
export const log: LogApi = Object.freeze(logObject) as LogApi;

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Notifies the client that the list of resources has changed.
 * If called before the server starts, the notification is queued.
 */
export function notifyResourceListChanged(): void {
	const server = getServerInstance();
	if (server) {
		server.sendResourceListChanged();
		return;
	}
	enqueueRegistration({ kind: "resourceListChanged" });
}

/**
 * Notifies the client that the list of tools has changed.
 * If called before the server starts, the notification is queued.
 */
export function notifyToolListChanged(): void {
	const server = getServerInstance();
	if (server) {
		server.sendToolListChanged();
		return;
	}
	enqueueRegistration({ kind: "toolListChanged" });
}

/**
 * Notifies the client that the list of prompts has changed.
 * If called before the server starts, the notification is queued.
 */
export function notifyPromptListChanged(): void {
	const server = getServerInstance();
	if (server) {
		server.sendPromptListChanged();
		return;
	}
	enqueueRegistration({ kind: "promptListChanged" });
}
