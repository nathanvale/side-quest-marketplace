/**
 * HTTP server for voice memo conversion via iOS Shortcuts.
 *
 * Provides a simple POST endpoint that accepts transcription text
 * and creates a voice memo note in the Obsidian vault.
 *
 * @module cli/voice-server
 */

import { pathExistsSync } from "@sidequest/core/fs";
import { emphasize } from "@sidequest/core/terminal";
import type { ParaObsidianConfig } from "../config/index";
import { initLogger, voiceLogger } from "../shared/logger";
import { createVoiceMemoNote } from "../voice";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Default port for the voice server.
 */
const DEFAULT_PORT = 3847;

/**
 * Request body for the /convert endpoint.
 */
interface ConvertRequest {
	text: string;
	source?: string;
}

/**
 * Response from the /convert endpoint.
 */
interface ConvertResponse {
	success: boolean;
	notePath?: string;
	noteTitle?: string;
	summary?: string;
	error?: string;
	sessionCid?: string;
}

/**
 * Create an HTTP request handler for voice conversion.
 */
function createRequestHandler(config: ParaObsidianConfig) {
	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url);

		// Health check endpoint
		if (url.pathname === "/health" && req.method === "GET") {
			return Response.json({ status: "ok", vault: config.vault });
		}

		// Convert endpoint
		if (url.pathname === "/convert" && req.method === "POST") {
			const session = startSession("voice-server:convert", { silent: true });
			const sessionCid = session.sessionCid;

			try {
				const body = (await req.json()) as ConvertRequest;

				if (!body.text || typeof body.text !== "string") {
					voiceLogger.warn`voice:server:error sessionCid=${sessionCid} error=${"Missing or invalid 'text' field"}`;
					return Response.json(
						{
							success: false,
							error: "Missing or invalid 'text' field in request body",
							sessionCid,
						} satisfies ConvertResponse,
						{ status: 400 },
					);
				}

				const transcription = body.text.trim();
				if (transcription.length === 0) {
					voiceLogger.warn`voice:server:error sessionCid=${sessionCid} error=${"Empty transcription"}`;
					return Response.json(
						{
							success: false,
							error: "Transcription text is empty",
							sessionCid,
						} satisfies ConvertResponse,
						{ status: 400 },
					);
				}

				voiceLogger.info`voice:server:convert sessionCid=${sessionCid} textLength=${transcription.length}`;

				// Create voice memo note
				const noteResult = await createVoiceMemoNote({
					timestamp: new Date(),
					transcription,
					vaultPath: config.vault,
					source: body.source ?? "ios-shortcut",
					sessionCid,
				});

				voiceLogger.info`voice:server:success sessionCid=${sessionCid} notePath=${noteResult.notePath}`;
				session.end({ success: true });

				return Response.json({
					success: true,
					notePath: noteResult.notePath,
					noteTitle: noteResult.noteTitle,
					summary: noteResult.summary,
					sessionCid,
				} satisfies ConvertResponse);
			} catch (error) {
				const err = error as Error;
				voiceLogger.error`voice:server:error sessionCid=${sessionCid} error=${err.message}`;
				session.end({ error: err.message });

				return Response.json(
					{
						success: false,
						error: err.message,
						sessionCid,
					} satisfies ConvertResponse,
					{ status: 500 },
				);
			}
		}

		// 404 for unknown routes
		return Response.json(
			{ error: "Not found", endpoints: ["/health", "/convert"] },
			{ status: 404 },
		);
	};
}

/**
 * Handle the 'voice serve' subcommand.
 *
 * Starts an HTTP server for voice memo conversion via iOS Shortcuts.
 *
 * Usage:
 *   para voice serve [--port 3847]
 */
export async function handleVoiceServe(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, isJson } = ctx;

	// Initialize logger
	await initLogger();

	// Parse port from flags
	const port =
		typeof flags.port === "number"
			? flags.port
			: typeof flags.port === "string"
				? Number.parseInt(flags.port, 10)
				: DEFAULT_PORT;

	if (Number.isNaN(port) || port < 1 || port > 65535) {
		if (isJson) {
			console.log(
				JSON.stringify({
					success: false,
					error: "Invalid port number",
				}),
			);
		} else {
			console.log(emphasize.error("Invalid port number."));
		}
		return { success: false, exitCode: 1 };
	}

	// Validate vault configuration
	if (!config.vault || config.vault.trim() === "") {
		if (isJson) {
			console.log(
				JSON.stringify({
					success: false,
					error: "Vault path not configured",
					hint: "Set PARA_VAULT environment variable",
				}),
			);
		} else {
			console.log(emphasize.error("Vault path not configured."));
			console.log("Set PARA_VAULT environment variable.");
		}
		return { success: false, exitCode: 1 };
	}

	if (!pathExistsSync(config.vault)) {
		if (isJson) {
			console.log(
				JSON.stringify({
					success: false,
					error: "Vault path does not exist",
					path: config.vault,
				}),
			);
		} else {
			console.log(emphasize.error("Vault path does not exist."));
			console.log(`Path: ${config.vault}`);
		}
		return { success: false, exitCode: 1 };
	}

	// Start the server
	const handler = createRequestHandler(config);

	const server = Bun.serve({
		port,
		fetch: handler,
	});

	voiceLogger.info`voice:server:start port=${port} vault=${config.vault}`;

	if (!isJson) {
		console.log(emphasize.success(`Voice server started on port ${port}`));
		console.log("");
		console.log("Endpoints:");
		console.log(`  GET  http://localhost:${port}/health`);
		console.log(`  POST http://localhost:${port}/convert`);
		console.log("");
		console.log("Example request:");
		console.log(`  curl -X POST http://localhost:${port}/convert \\`);
		console.log('    -H "Content-Type: application/json" \\');
		console.log('    -d \'{"text": "Your transcription here..."}\'');
		console.log("");
		console.log("Press Ctrl+C to stop.");
	} else {
		console.log(
			JSON.stringify({
				success: true,
				port,
				endpoints: {
					health: `http://localhost:${port}/health`,
					convert: `http://localhost:${port}/convert`,
				},
			}),
		);
	}

	// Keep the process running until interrupted
	await new Promise<void>((resolve) => {
		process.on("SIGINT", () => {
			voiceLogger.info`voice:server:stop port=${port}`;
			server.stop();
			resolve();
		});
		process.on("SIGTERM", () => {
			voiceLogger.info`voice:server:stop port=${port}`;
			server.stop();
			resolve();
		});
	});

	return { success: true };
}
