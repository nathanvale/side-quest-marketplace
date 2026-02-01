/**
 * Twitter/X API v2 client.
 *
 * Uses raw fetch with injectable fetch function for testability.
 * Includes retry with exponential backoff, timeout protection, and
 * rate limit header warnings.
 */

import { TimeoutError, withTimeout } from "@sidequest/core/concurrency";
import { getErrorCategory } from "@sidequest/core/instrumentation";
import { createCorrelationId } from "@sidequest/core/logging";
import { retry } from "@sidequest/core/utils";
import { mergeSingleTweet, mergeTweetList } from "./includes";
import { logger } from "./logger";
import { buildThread } from "./thread";
import type {
	EnrichedTweet,
	RepliesResult,
	SearchResult,
	ThreadResult,
	TimelineResult,
	Tweet,
	TwitterV2ListResponse,
	TwitterV2Response,
	User,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.twitter.com/2";

/** Fields requested on every tweet endpoint */
const TWEET_FIELDS =
	"author_id,conversation_id,created_at,in_reply_to_user_id,public_metrics,referenced_tweets";

/** Expansions requested on tweet endpoints */
const TWEET_EXPANSIONS = "author_id,referenced_tweets.id";

/** Fields requested for expanded user objects */
const USER_FIELDS =
	"created_at,description,profile_image_url,public_metrics,verified";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class TwitterApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly category: "transient" | "permanent" | "configuration",
	) {
		super(message);
		this.name = "TwitterApiError";
	}
}

/**
 * Parse Twitter API error response into a categorized error.
 */
function parseTwitterError(status: number, body: string): TwitterApiError {
	let detail: string;
	try {
		const parsed = JSON.parse(body);
		detail = parsed?.detail ?? parsed?.errors?.[0]?.message ?? body;
	} catch {
		detail = body;
	}

	if (status === 429)
		return new TwitterApiError(`Rate limited: ${detail}`, status, "transient");
	if (status === 401)
		return new TwitterApiError(
			`Auth failed: ${detail}`,
			status,
			"configuration",
		);
	if (status === 403)
		return new TwitterApiError(
			`Forbidden: ${detail} (check API tier)`,
			status,
			"configuration",
		);
	if (status === 404)
		return new TwitterApiError(`Not found: ${detail}`, status, "permanent");
	if (status >= 500)
		return new TwitterApiError(
			`Server error ${status}: ${detail}`,
			status,
			"transient",
		);
	return new TwitterApiError(
		`API error ${status}: ${detail}`,
		status,
		"permanent",
	);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface XApiClientConfig {
	bearerToken: string;
	/** Injectable fetch for testing — no global mock needed */
	fetchFn?: typeof fetch;
	/** Request timeout in ms (default: 10_000) */
	timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/** Create a Twitter/X API v2 client with retry, timeout, and rate limit awareness. */
export function createXApiClient(config: XApiClientConfig) {
	const { bearerToken, fetchFn = fetch, timeoutMs = 10_000 } = config;

	/**
	 * Low-level request with retry, timeout, and rate limit header checking.
	 */
	async function request<T>(
		endpoint: string,
		params?: URLSearchParams,
	): Promise<T> {
		const cid = createCorrelationId();
		const url = params
			? `${BASE_URL}${endpoint}?${params}`
			: `${BASE_URL}${endpoint}`;

		logger.info`x-api:request:start cid=${cid} endpoint=${endpoint}`;

		const result = await retry(
			async () => {
				const response = await withTimeout(
					fetchFn(url, {
						headers: { Authorization: `Bearer ${bearerToken}` },
					}),
					timeoutMs,
					`Twitter API timeout: ${endpoint}`,
				);

				// Check rate limit headers and warn when low
				const remaining = response.headers.get("x-rate-limit-remaining");
				const reset = response.headers.get("x-rate-limit-reset");
				if (remaining && Number(remaining) < 3) {
					logger.warn`x-api:rateLimit:low cid=${cid} remaining=${remaining} resetAt=${reset}`;
				}

				if (!response.ok) {
					const errorBody = await response.text();
					throw parseTwitterError(response.status, errorBody);
				}

				return response.json() as Promise<T>;
			},
			{
				maxAttempts: 3,
				initialDelay: 1000,
				shouldRetry: (error: Error) => {
					if (error instanceof TimeoutError) return true;
					if (error instanceof TwitterApiError)
						return error.category === "transient";
					return getErrorCategory(error) === "transient";
				},
			},
		);

		logger.info`x-api:request:complete cid=${cid} endpoint=${endpoint}`;
		return result;
	}

	// -----------------------------------------------------------------------
	// Default param builders
	// -----------------------------------------------------------------------

	function defaultTweetParams(): URLSearchParams {
		return new URLSearchParams({
			"tweet.fields": TWEET_FIELDS,
			expansions: TWEET_EXPANSIONS,
			"user.fields": USER_FIELDS,
		});
	}

	function defaultUserParams(): URLSearchParams {
		return new URLSearchParams({
			"user.fields": USER_FIELDS,
		});
	}

	// -----------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------

	return {
		/** Fetch a single tweet by ID with author and metrics. */
		async getTweet(id: string): Promise<EnrichedTweet> {
			const response = await request<TwitterV2Response<Tweet>>(
				`/tweets/${id}`,
				defaultTweetParams(),
			);
			return mergeSingleTweet(response);
		},

		/** Reconstruct a conversation thread with pagination. */
		async getThread(
			tweetId: string,
			maxResults: number,
		): Promise<ThreadResult> {
			return buildThread(request, tweetId, maxResults, {
				tweetFields: TWEET_FIELDS,
				expansions: TWEET_EXPANSIONS,
				userFields: USER_FIELDS,
			});
		},

		/** Fetch a user's recent tweets. */
		async getTimeline(
			username: string,
			maxResults: number,
		): Promise<TimelineResult> {
			// Step 1: Resolve username to user ID
			const userResponse = await request<TwitterV2Response<User>>(
				`/users/by/username/${username}`,
				defaultUserParams(),
			);

			// Step 2: Fetch timeline
			const params = defaultTweetParams();
			params.set("max_results", String(Math.min(maxResults, 100)));

			const timeline = await request<TwitterV2ListResponse<Tweet>>(
				`/users/${userResponse.data.id}/tweets`,
				params,
			);

			return {
				user: userResponse.data,
				tweets: mergeTweetList(timeline),
			};
		},

		/** Search recent tweets (7-day window). */
		async searchRecent(
			query: string,
			maxResults: number,
		): Promise<SearchResult> {
			const params = defaultTweetParams();
			params.set("query", query);
			params.set("max_results", String(Math.min(maxResults, 100)));

			const response = await request<TwitterV2ListResponse<Tweet>>(
				"/tweets/search/recent",
				params,
			);

			return {
				query,
				tweets: mergeTweetList(response),
				resultCount: response.meta?.result_count ?? 0,
			};
		},

		/** Fetch a user profile by username. */
		async getUser(username: string): Promise<User> {
			const response = await request<TwitterV2Response<User>>(
				`/users/by/username/${username}`,
				defaultUserParams(),
			);
			return response.data;
		},

		/** Fetch direct replies to a tweet. */
		async getReplies(
			tweetId: string,
			maxResults: number,
		): Promise<RepliesResult> {
			// Step 1: Get original tweet for context
			const original = await request<TwitterV2Response<Tweet>>(
				`/tweets/${tweetId}`,
				defaultTweetParams(),
			);
			const enrichedOriginal = mergeSingleTweet(original);

			// Step 2: Search for replies using conversation_id
			const conversationId = original.data.conversation_id ?? original.data.id;
			const params = defaultTweetParams();
			params.set(
				"query",
				`conversation_id:${conversationId} in_reply_to_tweet_id:${tweetId}`,
			);
			params.set("max_results", String(Math.min(maxResults, 100)));

			const response = await request<TwitterV2ListResponse<Tweet>>(
				"/tweets/search/recent",
				params,
			);

			return {
				originalTweet: enrichedOriginal,
				replies: mergeTweetList(response),
				resultCount: response.meta?.result_count ?? 0,
			};
		},
	};
}

export type XApiClient = ReturnType<typeof createXApiClient>;
