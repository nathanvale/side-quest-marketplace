import { describe, expect, test } from "bun:test";
import { ResponseFormat } from "@sidequest/core/mcp-response";
import {
	formatReplies,
	formatSearch,
	formatThread,
	formatTimeline,
	formatTweet,
	formatUser,
} from "./formatters";
import type {
	EnrichedTweet,
	RepliesResult,
	SearchResult,
	ThreadResult,
	TimelineResult,
	User,
} from "./types";

const mockUser: User = {
	id: "user_1",
	name: "Test User",
	username: "testuser",
	description: "A test account",
	created_at: "2020-01-01T00:00:00.000Z",
	public_metrics: {
		followers_count: 1000,
		following_count: 500,
		tweet_count: 5000,
		listed_count: 50,
	},
};

const mockTweet: EnrichedTweet = {
	id: "tweet_1",
	text: "Hello world!",
	author_id: "user_1",
	author: mockUser,
	created_at: "2025-06-15T12:00:00.000Z",
	public_metrics: {
		retweet_count: 10,
		reply_count: 5,
		like_count: 50,
		quote_count: 2,
	},
};

describe("formatTweet", () => {
	test("renders markdown with author and metrics", () => {
		const result = formatTweet(mockTweet, ResponseFormat.MARKDOWN);
		expect(result).toContain("@testuser");
		expect(result).toContain("Hello world!");
		expect(result).toContain("50 likes");
		expect(result).toContain("10 retweets");
	});

	test("renders JSON with full structure", () => {
		const result = formatTweet(mockTweet, ResponseFormat.JSON);
		const parsed = JSON.parse(result);
		expect(parsed.id).toBe("tweet_1");
		expect(parsed.author.username).toBe("testuser");
	});

	test("handles tweet without author gracefully", () => {
		const tweet: EnrichedTweet = { id: "t1", text: "No author" };
		const result = formatTweet(tweet, ResponseFormat.MARKDOWN);
		expect(result).toContain("No author");
		expect(result).not.toContain("@");
	});

	test("handles tweet without metrics", () => {
		const tweet: EnrichedTweet = {
			id: "t1",
			text: "No metrics",
			author: mockUser,
		};
		const result = formatTweet(tweet, ResponseFormat.MARKDOWN);
		expect(result).toContain("No metrics");
		expect(result).not.toContain("likes");
	});
});

describe("formatThread", () => {
	test("renders thread in markdown with tweet count", () => {
		const thread: ThreadResult = {
			tweets: [mockTweet, { ...mockTweet, id: "tweet_2", text: "Reply" }],
		};
		const result = formatThread(thread, ResponseFormat.MARKDOWN);
		expect(result).toContain("Thread");
		expect(result).toContain("2 tweets");
		expect(result).toContain("Hello world!");
		expect(result).toContain("Reply");
	});

	test("includes age warning when present", () => {
		const thread: ThreadResult = {
			tweets: [mockTweet],
			ageWarning: "Tweet is older than 7 days.",
		};
		const result = formatThread(thread, ResponseFormat.MARKDOWN);
		expect(result).toContain("Tweet is older than 7 days.");
	});

	test("renders JSON", () => {
		const thread: ThreadResult = { tweets: [mockTweet] };
		const result = formatThread(thread, ResponseFormat.JSON);
		const parsed = JSON.parse(result);
		expect(parsed.tweets).toHaveLength(1);
	});
});

describe("formatTimeline", () => {
	test("renders user info and tweets", () => {
		const timeline: TimelineResult = {
			user: mockUser,
			tweets: [mockTweet],
		};
		const result = formatTimeline(timeline, ResponseFormat.MARKDOWN);
		expect(result).toContain("@testuser");
		expect(result).toContain("A test account");
		expect(result).toContain("1000 followers");
		expect(result).toContain("Recent tweets");
	});
});

describe("formatSearch", () => {
	test("renders search query and results", () => {
		const search: SearchResult = {
			query: "bun runtime",
			tweets: [mockTweet],
			resultCount: 1,
		};
		const result = formatSearch(search, ResponseFormat.MARKDOWN);
		expect(result).toContain("bun runtime");
		expect(result).toContain("1 results");
	});
});

describe("formatUser", () => {
	test("renders user profile in markdown", () => {
		const result = formatUser(mockUser, ResponseFormat.MARKDOWN);
		expect(result).toContain("@testuser");
		expect(result).toContain("Test User");
		expect(result).toContain("A test account");
		expect(result).toContain("1000 followers");
	});

	test("renders JSON", () => {
		const result = formatUser(mockUser, ResponseFormat.JSON);
		const parsed = JSON.parse(result);
		expect(parsed.username).toBe("testuser");
	});
});

describe("formatReplies", () => {
	test("renders original tweet and replies", () => {
		const replies: RepliesResult = {
			originalTweet: mockTweet,
			replies: [{ id: "r1", text: "Great tweet!", author: mockUser }],
			resultCount: 1,
		};
		const result = formatReplies(replies, ResponseFormat.MARKDOWN);
		expect(result).toContain("Original tweet");
		expect(result).toContain("Hello world!");
		expect(result).toContain("Great tweet!");
		expect(result).toContain("Replies");
	});
});
