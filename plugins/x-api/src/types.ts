/**
 * Twitter/X API v2 types.
 *
 * Covers tweet, user, and includes structures returned by the v2 endpoints.
 * Only models the fields we actually request via tweet.fields / user.fields.
 */

// ---------------------------------------------------------------------------
// Tweet
// ---------------------------------------------------------------------------

export interface Tweet {
	id: string;
	text: string;
	author_id?: string;
	conversation_id?: string;
	created_at?: string;
	in_reply_to_user_id?: string;
	referenced_tweets?: ReferencedTweet[];
	public_metrics?: TweetPublicMetrics;
}

export interface ReferencedTweet {
	type: "retweeted" | "quoted" | "replied_to";
	id: string;
}

export interface TweetPublicMetrics {
	retweet_count: number;
	reply_count: number;
	like_count: number;
	quote_count: number;
	bookmark_count?: number;
	impression_count?: number;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface User {
	id: string;
	name: string;
	username: string;
	description?: string;
	created_at?: string;
	profile_image_url?: string;
	verified?: boolean;
	public_metrics?: UserPublicMetrics;
}

export interface UserPublicMetrics {
	followers_count: number;
	following_count: number;
	tweet_count: number;
	listed_count: number;
}

// ---------------------------------------------------------------------------
// V2 includes (expansion objects returned alongside data)
// ---------------------------------------------------------------------------

export interface TwitterIncludes {
	users?: User[];
	tweets?: Tweet[];
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface TwitterV2Response<T> {
	data: T;
	includes?: TwitterIncludes;
}

export interface TwitterV2ListResponse<T> {
	data?: T[];
	includes?: TwitterIncludes;
	meta?: TwitterMeta;
}

export interface TwitterMeta {
	result_count: number;
	newest_id?: string;
	oldest_id?: string;
	next_token?: string;
}

// ---------------------------------------------------------------------------
// Enriched types (after includes merge)
// ---------------------------------------------------------------------------

export interface EnrichedTweet extends Tweet {
	author?: User;
	referenced_tweet_data?: Tweet;
}

// ---------------------------------------------------------------------------
// Tool result types
// ---------------------------------------------------------------------------

export interface ThreadResult {
	tweets: EnrichedTweet[];
	ageWarning?: string;
}

export interface TimelineResult {
	user: User;
	tweets: EnrichedTweet[];
}

export interface SearchResult {
	query: string;
	tweets: EnrichedTweet[];
	resultCount: number;
}

export interface RepliesResult {
	originalTweet: EnrichedTweet;
	replies: EnrichedTweet[];
	resultCount: number;
}
