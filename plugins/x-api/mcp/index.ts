#!/usr/bin/env bun

/// <reference types="bun-types" />

/**
 * X-API MCP Server — Read-only Twitter/X API v2 integration.
 *
 * Provides 6 tools for fetching tweets, threads, timelines, search results,
 * user profiles, and replies. All tools are read-only.
 *
 * Requires X_BEARER_TOKEN environment variable.
 */

import { startServer, tool, z } from "@sidequest/core/mcp";
import {
	createLoggerAdapter,
	type ResponseFormat,
	setMcpLogger,
	wrapToolHandler,
} from "@sidequest/core/mcp-response";
import { createXApiClient } from "../src/client";
import {
	formatReplies,
	formatSearch,
	formatThread,
	formatTimeline,
	formatTweet,
	formatUser,
} from "../src/formatters";
import { createCorrelationId, initLogger, logger } from "../src/logger";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

await initLogger();
const logAdapter = createLoggerAdapter(logger);
setMcpLogger(logAdapter);

const bearerToken = process.env.X_BEARER_TOKEN;
if (!bearerToken) {
	console.error("X_BEARER_TOKEN environment variable is required");
	process.exit(1);
}

const client = createXApiClient({ bearerToken });

// ---------------------------------------------------------------------------
// Shared schema parts
// ---------------------------------------------------------------------------

const responseFormatSchema = z
	.enum(["markdown", "json"])
	.optional()
	.default("json")
	.describe("Output format: 'markdown' or 'json' (default)");

const readOnlyAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: true,
} as const;

const handlerOpts = (toolName: string) => ({
	toolName,
	logger: logAdapter,
	createCid: createCorrelationId,
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

tool(
	"x_get_tweet",
	{
		description:
			"Get a single tweet by ID with author info and engagement metrics",
		inputSchema: {
			tweet_id: z.string().describe("The tweet/post ID"),
			response_format: responseFormatSchema,
		},
		annotations: readOnlyAnnotations,
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const result = await client.getTweet(args.tweet_id as string);
			return formatTweet(result, format);
		},
		handlerOpts("x_get_tweet"),
	),
);

tool(
	"x_get_thread",
	{
		description:
			"Get a full conversation thread starting from a tweet ID. Uses search API (7-day window). Returns tweets in chronological reading order.",
		inputSchema: {
			tweet_id: z.string().describe("The root tweet/post ID"),
			max_results: z
				.number()
				.int()
				.min(1)
				.max(200)
				.optional()
				.default(50)
				.describe("Maximum conversation tweets to fetch (default 50, max 200)"),
			response_format: responseFormatSchema,
		},
		annotations: readOnlyAnnotations,
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const result = await client.getThread(
				args.tweet_id as string,
				(args.max_results as number) ?? 50,
			);
			return formatThread(result, format);
		},
		handlerOpts("x_get_thread"),
	),
);

tool(
	"x_get_timeline",
	{
		description: "Get a user's recent tweets by username",
		inputSchema: {
			username: z.string().describe("Twitter username (without @ prefix)"),
			max_results: z
				.number()
				.int()
				.min(1)
				.max(100)
				.optional()
				.default(10)
				.describe("Number of tweets to fetch (default 10, max 100)"),
			response_format: responseFormatSchema,
		},
		annotations: readOnlyAnnotations,
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const result = await client.getTimeline(
				args.username as string,
				(args.max_results as number) ?? 10,
			);
			return formatTimeline(result, format);
		},
		handlerOpts("x_get_timeline"),
	),
);

tool(
	"x_search",
	{
		description:
			"Search recent tweets (7-day window). Uses Twitter search API — may require elevated API tier.",
		inputSchema: {
			query: z
				.string()
				.describe("Search query (supports Twitter search operators)"),
			max_results: z
				.number()
				.int()
				.min(10)
				.max(100)
				.optional()
				.default(10)
				.describe("Number of results to return (default 10, max 100)"),
			response_format: responseFormatSchema,
		},
		annotations: readOnlyAnnotations,
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const result = await client.searchRecent(
				args.query as string,
				(args.max_results as number) ?? 10,
			);
			return formatSearch(result, format);
		},
		handlerOpts("x_get_search"),
	),
);

tool(
	"x_get_user",
	{
		description:
			"Get a Twitter/X user profile by username — bio, follower counts, tweet count",
		inputSchema: {
			username: z.string().describe("Twitter username (without @ prefix)"),
			response_format: responseFormatSchema,
		},
		annotations: readOnlyAnnotations,
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const result = await client.getUser(args.username as string);
			return formatUser(result, format);
		},
		handlerOpts("x_get_user"),
	),
);

tool(
	"x_get_replies",
	{
		description:
			"Get direct replies to a tweet. Uses search API (7-day window) — may require elevated API tier.",
		inputSchema: {
			tweet_id: z.string().describe("The tweet/post ID to get replies for"),
			max_results: z
				.number()
				.int()
				.min(10)
				.max(100)
				.optional()
				.default(20)
				.describe("Maximum replies to fetch (default 20, max 100)"),
			response_format: responseFormatSchema,
		},
		annotations: readOnlyAnnotations,
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const result = await client.getReplies(
				args.tweet_id as string,
				(args.max_results as number) ?? 20,
			);
			return formatReplies(result, format);
		},
		handlerOpts("x_get_replies"),
	),
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

startServer("x-api", {
	version: "1.0.0",
	fileLogging: {
		enabled: true,
		subsystems: ["mcp"],
		level: "info",
	},
});
