import { describe, expect, test } from "bun:test";
import { createXApiClient, TwitterApiError } from "./client";
import type { Tweet, TwitterV2Response, User } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock fetch that returns a sequence of responses. */
function mockFetch(
	...responses: Array<{
		status?: number;
		body?: unknown;
		headers?: Record<string, string>;
	}>
): typeof fetch {
	let callIndex = 0;
	const fn = async (_url: string | URL | Request, _init?: RequestInit) => {
		// biome-ignore lint: test helper — array always has at least 1 element
		const config = (responses[callIndex] ?? responses[responses.length - 1])!;
		callIndex++;
		const status = config.status ?? 200;
		const body =
			typeof config.body === "string"
				? config.body
				: JSON.stringify(config.body ?? {});
		return new Response(body, {
			status,
			headers: {
				"content-type": "application/json",
				...(config.headers ?? {}),
			},
		});
	};
	return fn as unknown as typeof fetch;
}

const mockUser: User = {
	id: "user_1",
	name: "Test User",
	username: "testuser",
	public_metrics: {
		followers_count: 100,
		following_count: 50,
		tweet_count: 200,
		listed_count: 5,
	},
};

const mockTweet: Tweet = {
	id: "tweet_1",
	text: "Hello world",
	author_id: "user_1",
	conversation_id: "tweet_1",
	created_at: "2025-01-01T00:00:00.000Z",
	public_metrics: {
		retweet_count: 10,
		reply_count: 5,
		like_count: 50,
		quote_count: 2,
	},
};

// ---------------------------------------------------------------------------
// getTweet
// ---------------------------------------------------------------------------

describe("getTweet", () => {
	test("fetches and enriches a single tweet", async () => {
		const response: TwitterV2Response<Tweet> = {
			data: mockTweet,
			includes: { users: [mockUser] },
		};

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn: mockFetch({ body: response }),
		});

		const result = await client.getTweet("tweet_1");
		expect(result.id).toBe("tweet_1");
		expect(result.text).toBe("Hello world");
		expect(result.author?.username).toBe("testuser");
	});

	test("sends bearer token in authorization header", async () => {
		let capturedHeaders: Headers | undefined;

		const fetchFn = (async (
			_url: string | URL | Request,
			init?: RequestInit,
		) => {
			capturedHeaders = new Headers(init?.headers);
			return new Response(
				JSON.stringify({ data: mockTweet, includes: { users: [mockUser] } }),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const client = createXApiClient({
			bearerToken: "my-secret-token",
			fetchFn,
		});

		await client.getTweet("tweet_1");
		expect(capturedHeaders!.get("Authorization")).toBe(
			"Bearer my-secret-token",
		);
	});
});

// ---------------------------------------------------------------------------
// getUser
// ---------------------------------------------------------------------------

describe("getUser", () => {
	test("fetches user profile by username", async () => {
		const response: TwitterV2Response<User> = {
			data: mockUser,
		};

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn: mockFetch({ body: response }),
		});

		const result = await client.getUser("testuser");
		expect(result.username).toBe("testuser");
		expect(result.public_metrics?.followers_count).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// getTimeline
// ---------------------------------------------------------------------------

describe("getTimeline", () => {
	test("resolves username then fetches timeline", async () => {
		const userResponse: TwitterV2Response<User> = { data: mockUser };
		const timelineResponse = {
			data: [mockTweet],
			includes: { users: [mockUser] },
			meta: { result_count: 1 },
		};

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn: mockFetch({ body: userResponse }, { body: timelineResponse }),
		});

		const result = await client.getTimeline("testuser", 10);
		expect(result.user.username).toBe("testuser");
		expect(result.tweets).toHaveLength(1);
		expect(result.tweets[0]!.author?.username).toBe("testuser");
	});
});

// ---------------------------------------------------------------------------
// searchRecent
// ---------------------------------------------------------------------------

describe("searchRecent", () => {
	test("searches recent tweets", async () => {
		const response = {
			data: [mockTweet],
			includes: { users: [mockUser] },
			meta: { result_count: 1 },
		};

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn: mockFetch({ body: response }),
		});

		const result = await client.searchRecent("hello", 10);
		expect(result.query).toBe("hello");
		expect(result.tweets).toHaveLength(1);
		expect(result.resultCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// getReplies
// ---------------------------------------------------------------------------

describe("getReplies", () => {
	test("fetches original tweet then searches replies", async () => {
		const originalResponse: TwitterV2Response<Tweet> = {
			data: mockTweet,
			includes: { users: [mockUser] },
		};
		const reply: Tweet = {
			id: "tweet_2",
			text: "Nice tweet!",
			author_id: "user_1",
			in_reply_to_user_id: "user_1",
		};
		const repliesResponse = {
			data: [reply],
			includes: { users: [mockUser] },
			meta: { result_count: 1 },
		};

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn: mockFetch({ body: originalResponse }, { body: repliesResponse }),
		});

		const result = await client.getReplies("tweet_1", 20);
		expect(result.originalTweet.id).toBe("tweet_1");
		expect(result.replies).toHaveLength(1);
		expect(result.replies[0]!.text).toBe("Nice tweet!");
	});
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
	test("throws TwitterApiError on 401", async () => {
		const client = createXApiClient({
			bearerToken: "bad-token",
			fetchFn: mockFetch({
				status: 401,
				body: { detail: "Unauthorized" },
			}),
		});

		await expect(client.getTweet("1")).rejects.toThrow(TwitterApiError);
		try {
			await client.getUser("test");
		} catch (e) {
			expect(e).toBeInstanceOf(TwitterApiError);
			expect((e as TwitterApiError).category).toBe("configuration");
		}
	});

	test("throws TwitterApiError on 404", async () => {
		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn: mockFetch({
				status: 404,
				body: { detail: "Tweet not found" },
			}),
		});

		try {
			await client.getTweet("nonexistent");
		} catch (e) {
			expect(e).toBeInstanceOf(TwitterApiError);
			expect((e as TwitterApiError).category).toBe("permanent");
		}
	});

	test("retries on 429 rate limit", async () => {
		let callCount = 0;
		const fetchFn = (async () => {
			callCount++;
			if (callCount <= 2) {
				return new Response(JSON.stringify({ detail: "Too Many Requests" }), {
					status: 429,
				});
			}
			return new Response(
				JSON.stringify({ data: mockTweet, includes: { users: [mockUser] } }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn,
		});

		const result = await client.getTweet("tweet_1");
		expect(result.id).toBe("tweet_1");
		expect(callCount).toBe(3);
	});

	test("retries on 500 server error", async () => {
		let callCount = 0;
		const fetchFn = (async () => {
			callCount++;
			if (callCount === 1) {
				return new Response(
					JSON.stringify({ detail: "Internal Server Error" }),
					{ status: 500 },
				);
			}
			return new Response(
				JSON.stringify({ data: mockTweet, includes: { users: [mockUser] } }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		}) as unknown as typeof fetch;

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn,
		});

		const result = await client.getTweet("tweet_1");
		expect(result.id).toBe("tweet_1");
		expect(callCount).toBe(2);
	});

	test("does not retry on 403 forbidden", async () => {
		let callCount = 0;
		const fetchFn = (async () => {
			callCount++;
			return new Response(
				JSON.stringify({ detail: "Forbidden — check tier" }),
				{ status: 403 },
			);
		}) as unknown as typeof fetch;

		const client = createXApiClient({
			bearerToken: "test-token",
			fetchFn,
		});

		await expect(client.getTweet("1")).rejects.toThrow(TwitterApiError);
		expect(callCount).toBe(1);
	});
});
