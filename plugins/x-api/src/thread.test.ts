import { describe, expect, test } from "bun:test";
import { buildThread, type RequestFn, type ThreadFieldParams } from "./thread";
import type { Tweet, User } from "./types";

const fields: ThreadFieldParams = {
	tweetFields: "author_id,conversation_id,created_at,public_metrics",
	expansions: "author_id",
	userFields: "name,username",
};

const mockUser: User = {
	id: "user_1",
	name: "Test User",
	username: "testuser",
};

function makeTweet(
	id: string,
	text: string,
	createdAt: string,
	conversationId = "tweet_root",
): Tweet {
	return {
		id,
		text,
		author_id: "user_1",
		conversation_id: conversationId,
		created_at: createdAt,
	};
}

describe("buildThread", () => {
	test("fetches root tweet and search results in chronological order", async () => {
		// Use a recent date to avoid age warning
		const now = new Date();
		const recentDate = (minutesAgo: number) =>
			new Date(now.getTime() - minutesAgo * 60_000).toISOString();

		const rootTweet = makeTweet("tweet_root", "Root tweet", recentDate(30));
		const reply1 = makeTweet("tweet_r1", "First reply", recentDate(20));
		const reply2 = makeTweet("tweet_r2", "Second reply", recentDate(25));

		const request: RequestFn = async <T>(
			endpoint: string,
			_params?: URLSearchParams,
		): Promise<T> => {
			if (endpoint.startsWith("/tweets/tweet_root")) {
				return {
					data: rootTweet,
					includes: { users: [mockUser] },
				} as T;
			}
			if (endpoint === "/tweets/search/recent") {
				return {
					data: [reply1, reply2],
					includes: { users: [mockUser] },
					meta: { result_count: 2 },
				} as T;
			}
			throw new Error(`Unexpected endpoint: ${endpoint}`);
		};

		const result = await buildThread(request, "tweet_root", 50, fields);

		expect(result.tweets).toHaveLength(3);
		// Should be sorted chronologically (oldest first)
		expect(result.tweets[0]!.text).toBe("Root tweet");
		expect(result.tweets[1]!.text).toBe("Second reply");
		expect(result.tweets[2]!.text).toBe("First reply");
		expect(result.ageWarning).toBeUndefined();
	});

	test("deduplicates root tweet if it appears in search results", async () => {
		const rootTweet = makeTweet(
			"tweet_root",
			"Root tweet",
			new Date().toISOString(),
		);

		const request: RequestFn = async <T>(endpoint: string): Promise<T> => {
			if (endpoint.startsWith("/tweets/tweet_root")) {
				return {
					data: rootTweet,
					includes: { users: [mockUser] },
				} as T;
			}
			// Search returns root tweet again
			return {
				data: [rootTweet],
				includes: { users: [mockUser] },
				meta: { result_count: 1 },
			} as T;
		};

		const result = await buildThread(request, "tweet_root", 50, fields);
		expect(result.tweets).toHaveLength(1);
	});

	test("adds age warning for tweets older than 7 days", async () => {
		const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
		const rootTweet = makeTweet(
			"tweet_old",
			"Old tweet",
			oldDate.toISOString(),
			"tweet_old",
		);

		const request: RequestFn = async <T>(endpoint: string): Promise<T> => {
			if (endpoint.startsWith("/tweets/tweet_old")) {
				return {
					data: rootTweet,
					includes: { users: [mockUser] },
				} as T;
			}
			return {
				data: [],
				meta: { result_count: 0 },
			} as T;
		};

		const result = await buildThread(request, "tweet_old", 50, fields);
		expect(result.ageWarning).toContain("older than 7 days");
	});

	test("paginates through multiple pages", async () => {
		const now = new Date();
		const rootTweet = makeTweet(
			"tweet_root",
			"Root",
			new Date(now.getTime() - 30 * 60_000).toISOString(),
		);

		let searchCallCount = 0;
		const request: RequestFn = async <T>(
			endpoint: string,
			params?: URLSearchParams,
		): Promise<T> => {
			if (endpoint.startsWith("/tweets/tweet_root")) {
				return {
					data: rootTweet,
					includes: { users: [mockUser] },
				} as T;
			}

			searchCallCount++;
			if (searchCallCount === 1) {
				return {
					data: [
						makeTweet(
							"r1",
							"Reply 1",
							new Date(now.getTime() - 20 * 60_000).toISOString(),
						),
					],
					includes: { users: [mockUser] },
					meta: { result_count: 1, next_token: "page2" },
				} as T;
			}
			return {
				data: [
					makeTweet(
						"r2",
						"Reply 2",
						new Date(now.getTime() - 10 * 60_000).toISOString(),
					),
				],
				includes: { users: [mockUser] },
				meta: { result_count: 1 },
			} as T;
		};

		const result = await buildThread(request, "tweet_root", 50, fields);
		expect(result.tweets).toHaveLength(3);
		expect(searchCallCount).toBe(2);
	});

	test("stops paginating after maxResults cap", async () => {
		const now = new Date();
		const rootTweet = makeTweet(
			"tweet_root",
			"Root",
			new Date(now.getTime() - 60 * 60_000).toISOString(),
		);

		let searchCallCount = 0;
		const request: RequestFn = async <T>(endpoint: string): Promise<T> => {
			if (endpoint.startsWith("/tweets/tweet_root")) {
				return {
					data: rootTweet,
					includes: { users: [mockUser] },
				} as T;
			}
			searchCallCount++;
			// Each page returns 2 tweets
			const pageOffset = (searchCallCount - 1) * 2;
			const tweets = [
				makeTweet(
					`r${pageOffset}`,
					`Reply ${pageOffset}`,
					new Date(now.getTime() - (50 - pageOffset) * 60_000).toISOString(),
				),
				makeTweet(
					`r${pageOffset + 1}`,
					`Reply ${pageOffset + 1}`,
					new Date(now.getTime() - (49 - pageOffset) * 60_000).toISOString(),
				),
			];
			return {
				data: tweets,
				includes: { users: [mockUser] },
				meta: {
					result_count: 2,
					next_token:
						searchCallCount < 5 ? `page${searchCallCount + 1}` : undefined,
				},
			} as T;
		};

		// maxResults = 3, first page gives 2, so it should fetch a 2nd page then stop
		const result = await buildThread(request, "tweet_root", 3, fields);
		// Should not keep paginating forever — at most 2 search calls for cap=3
		expect(searchCallCount).toBeLessThanOrEqual(2);
		// Root + up to 4 search results (2 pages of 2)
		expect(result.tweets.length).toBeGreaterThan(1);
	});
});
