/**
 * Twitter v2 includes merge strategy.
 *
 * The v2 API returns expanded objects (users, referenced tweets) in a separate
 * `includes` object. This module merges them back into tweet data for a flat,
 * usable structure — the fiddliest part of the v2 API.
 */

import type {
	EnrichedTweet,
	Tweet,
	TwitterIncludes,
	TwitterV2ListResponse,
	TwitterV2Response,
	User,
} from "./types";

/**
 * Build lookup maps from includes for O(1) access.
 */
function buildMaps(includes?: TwitterIncludes): {
	userMap: Map<string, User>;
	tweetMap: Map<string, Tweet>;
} {
	const userMap = new Map<string, User>(includes?.users?.map((u) => [u.id, u]));
	const tweetMap = new Map<string, Tweet>(
		includes?.tweets?.map((t) => [t.id, t]),
	);
	return { userMap, tweetMap };
}

/**
 * Enrich a single tweet with author and referenced tweet data from includes.
 */
function enrichTweet(
	tweet: Tweet,
	userMap: Map<string, User>,
	tweetMap: Map<string, Tweet>,
): EnrichedTweet {
	return {
		...tweet,
		author: tweet.author_id ? userMap.get(tweet.author_id) : undefined,
		referenced_tweet_data: tweet.referenced_tweets?.[0]
			? tweetMap.get(tweet.referenced_tweets[0].id)
			: undefined,
	};
}

/**
 * Merge includes into a single tweet response.
 */
export function mergeSingleTweet(
	response: TwitterV2Response<Tweet>,
): EnrichedTweet {
	const { userMap, tweetMap } = buildMaps(response.includes);
	return enrichTweet(response.data, userMap, tweetMap);
}

/**
 * Merge includes into a list of tweets.
 */
export function mergeTweetList(
	response: TwitterV2ListResponse<Tweet>,
): EnrichedTweet[] {
	if (!response.data) return [];
	const { userMap, tweetMap } = buildMaps(response.includes);
	return response.data.map((tweet) => enrichTweet(tweet, userMap, tweetMap));
}
