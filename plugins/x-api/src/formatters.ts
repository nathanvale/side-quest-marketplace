/**
 * Markdown and JSON formatters for Twitter/X API responses.
 *
 * Provides human-readable markdown output and structured JSON for each
 * tool response type. Used by the MCP handler layer.
 */

import { ResponseFormat } from "@side-quest/core/mcp-response";
import type {
	EnrichedTweet,
	RepliesResult,
	SearchResult,
	ThreadResult,
	TimelineResult,
	User,
} from "./types";

// ---------------------------------------------------------------------------
// Tweet formatting
// ---------------------------------------------------------------------------

/** Format a single tweet as markdown. */
function formatTweetMarkdown(tweet: EnrichedTweet): string {
	const lines: string[] = [];

	const author = tweet.author;
	if (author) {
		lines.push(`**@${author.username}** (${author.name})`);
	}

	lines.push(tweet.text);

	if (tweet.created_at) {
		lines.push(`*${new Date(tweet.created_at).toLocaleString()}*`);
	}

	const m = tweet.public_metrics;
	if (m) {
		const parts: string[] = [];
		if (m.like_count > 0) parts.push(`${m.like_count} likes`);
		if (m.retweet_count > 0) parts.push(`${m.retweet_count} retweets`);
		if (m.reply_count > 0) parts.push(`${m.reply_count} replies`);
		if (m.quote_count > 0) parts.push(`${m.quote_count} quotes`);
		if (parts.length > 0) lines.push(parts.join(" | "));
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public formatters
// ---------------------------------------------------------------------------

/** Format a single enriched tweet result. */
export function formatTweet(
	tweet: EnrichedTweet,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(tweet, null, 2);
	}
	return formatTweetMarkdown(tweet);
}

/** Format a thread result. */
export function formatThread(
	result: ThreadResult,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	const lines: string[] = [];
	if (result.ageWarning) {
		lines.push(`> ${result.ageWarning}`);
		lines.push("");
	}
	lines.push(`**Thread** (${result.tweets.length} tweets)`);
	lines.push("---");
	for (const tweet of result.tweets) {
		lines.push(formatTweetMarkdown(tweet));
		lines.push("---");
	}
	return lines.join("\n");
}

/** Format a timeline result. */
export function formatTimeline(
	result: TimelineResult,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	const lines: string[] = [];
	const u = result.user;
	lines.push(`**@${u.username}** (${u.name})`);
	if (u.description) lines.push(u.description);
	if (u.public_metrics) {
		lines.push(
			`${u.public_metrics.followers_count} followers | ${u.public_metrics.following_count} following | ${u.public_metrics.tweet_count} tweets`,
		);
	}
	lines.push("");
	lines.push(`**Recent tweets** (${result.tweets.length})`);
	lines.push("---");
	for (const tweet of result.tweets) {
		lines.push(formatTweetMarkdown(tweet));
		lines.push("---");
	}
	return lines.join("\n");
}

/** Format a search result. */
export function formatSearch(
	result: SearchResult,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	const lines: string[] = [];
	lines.push(`**Search:** "${result.query}" (${result.resultCount} results)`);
	lines.push("---");
	for (const tweet of result.tweets) {
		lines.push(formatTweetMarkdown(tweet));
		lines.push("---");
	}
	return lines.join("\n");
}

/** Format a user profile. */
export function formatUser(user: User, format: ResponseFormat): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(user, null, 2);
	}

	const lines: string[] = [];
	lines.push(`**@${user.username}** (${user.name})`);
	if (user.description) lines.push(user.description);
	if (user.created_at) {
		lines.push(`Joined: ${new Date(user.created_at).toLocaleDateString()}`);
	}
	if (user.public_metrics) {
		const m = user.public_metrics;
		lines.push(
			`${m.followers_count} followers | ${m.following_count} following | ${m.tweet_count} tweets`,
		);
	}
	return lines.join("\n");
}

/** Format a replies result. */
export function formatReplies(
	result: RepliesResult,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result, null, 2);
	}

	const lines: string[] = [];
	lines.push("**Original tweet:**");
	lines.push(formatTweetMarkdown(result.originalTweet));
	lines.push("");
	lines.push(`**Replies** (${result.resultCount})`);
	lines.push("---");
	for (const reply of result.replies) {
		lines.push(formatTweetMarkdown(reply));
		lines.push("---");
	}
	return lines.join("\n");
}
