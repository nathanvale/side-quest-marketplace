/**
 * Thread reconstruction with cursor pagination.
 *
 * Fetches a root tweet, then searches the conversation using the v2 search
 * endpoint with pagination. Sorts into reading order (chronological).
 * Warns if the tweet is older than 7 days (search API limitation).
 */

import { mergeSingleTweet, mergeTweetList } from "./includes";
import type {
	EnrichedTweet,
	ThreadResult,
	Tweet,
	TwitterV2ListResponse,
	TwitterV2Response,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Generic request function matching the client's internal shape. */
export type RequestFn = <T>(
	endpoint: string,
	params?: URLSearchParams,
) => Promise<T>;

export interface ThreadFieldParams {
	tweetFields: string;
	expansions: string;
	userFields: string;
}

// ---------------------------------------------------------------------------
// Thread builder
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_THREAD_TWEETS = 200;

/**
 * Build a conversation thread from a root tweet ID.
 *
 * 1. Fetches the root tweet to get conversation_id
 * 2. Warns if tweet is older than 7 days (search won't find old replies)
 * 3. Paginates through search results for the conversation
 * 4. Sorts chronologically for reading order
 */
export async function buildThread(
	request: RequestFn,
	tweetId: string,
	maxResults: number,
	fields: ThreadFieldParams,
): Promise<ThreadResult> {
	const cap = Math.min(maxResults, MAX_THREAD_TWEETS);

	// Step 1: Get root tweet
	const rootParams = new URLSearchParams({
		"tweet.fields": fields.tweetFields,
		expansions: fields.expansions,
		"user.fields": fields.userFields,
	});
	const rootResponse = await request<TwitterV2Response<Tweet>>(
		`/tweets/${tweetId}`,
		rootParams,
	);
	const rootTweet = mergeSingleTweet(rootResponse);
	const conversationId =
		rootResponse.data.conversation_id ?? rootResponse.data.id;

	// Step 2: Check age
	let ageWarning: string | undefined;
	if (rootResponse.data.created_at) {
		const tweetAge =
			Date.now() - new Date(rootResponse.data.created_at).getTime();
		if (tweetAge > SEVEN_DAYS_MS) {
			ageWarning =
				"Warning: Tweet is older than 7 days. Search API only returns recent replies.";
		}
	}

	// Step 3: Search conversation with cursor pagination
	const allTweets: EnrichedTweet[] = [rootTweet];
	const seenIds = new Set<string>([tweetId]);
	let nextToken: string | undefined;
	let fetched = 0;

	while (fetched < cap) {
		const pageSize = Math.min(100, cap - fetched);
		const params = new URLSearchParams({
			query: `conversation_id:${conversationId}`,
			max_results: String(Math.max(pageSize, 10)), // API minimum is 10
			"tweet.fields": fields.tweetFields,
			expansions: fields.expansions,
			"user.fields": fields.userFields,
		});
		if (nextToken) params.set("next_token", nextToken);

		const page = await request<TwitterV2ListResponse<Tweet>>(
			"/tweets/search/recent",
			params,
		);

		if (page.data) {
			const enriched = mergeTweetList(page);
			for (const tweet of enriched) {
				if (!seenIds.has(tweet.id)) {
					seenIds.add(tweet.id);
					allTweets.push(tweet);
					fetched++;
				}
			}
		}

		nextToken = page.meta?.next_token;
		if (!nextToken || !page.data?.length) break;
	}

	// Step 4: Sort chronologically
	allTweets.sort((a, b) => {
		if (!a.created_at || !b.created_at) return 0;
		return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
	});

	return { tweets: allTweets, ageWarning };
}
