import { describe, expect, test } from "bun:test";
import { mergeSingleTweet, mergeTweetList } from "./includes";
import type {
	Tweet,
	TwitterV2ListResponse,
	TwitterV2Response,
	User,
} from "./types";

const mockUser: User = {
	id: "user_1",
	name: "Test User",
	username: "testuser",
	description: "A test account",
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

const mockReferencedTweet: Tweet = {
	id: "tweet_0",
	text: "Original tweet",
	author_id: "user_1",
};

describe("mergeSingleTweet", () => {
	test("merges author from includes", () => {
		const response: TwitterV2Response<Tweet> = {
			data: mockTweet,
			includes: { users: [mockUser] },
		};

		const result = mergeSingleTweet(response);
		expect(result.author).toEqual(mockUser);
		expect(result.id).toBe("tweet_1");
		expect(result.text).toBe("Hello world");
	});

	test("merges referenced tweet from includes", () => {
		const tweetWithRef: Tweet = {
			...mockTweet,
			referenced_tweets: [{ type: "replied_to", id: "tweet_0" }],
		};
		const response: TwitterV2Response<Tweet> = {
			data: tweetWithRef,
			includes: { users: [mockUser], tweets: [mockReferencedTweet] },
		};

		const result = mergeSingleTweet(response);
		expect(result.referenced_tweet_data).toEqual(mockReferencedTweet);
	});

	test("handles missing includes gracefully", () => {
		const response: TwitterV2Response<Tweet> = {
			data: mockTweet,
		};

		const result = mergeSingleTweet(response);
		expect(result.author).toBeUndefined();
		expect(result.referenced_tweet_data).toBeUndefined();
		expect(result.text).toBe("Hello world");
	});

	test("handles tweet without author_id", () => {
		const tweet: Tweet = { id: "tweet_1", text: "No author" };
		const response: TwitterV2Response<Tweet> = {
			data: tweet,
			includes: { users: [mockUser] },
		};

		const result = mergeSingleTweet(response);
		expect(result.author).toBeUndefined();
	});
});

describe("mergeTweetList", () => {
	test("merges authors into tweet list", () => {
		const user2: User = {
			id: "user_2",
			name: "Other User",
			username: "other",
		};
		const tweet2: Tweet = {
			id: "tweet_2",
			text: "Second tweet",
			author_id: "user_2",
		};

		const response: TwitterV2ListResponse<Tweet> = {
			data: [mockTweet, tweet2],
			includes: { users: [mockUser, user2] },
			meta: { result_count: 2 },
		};

		const result = mergeTweetList(response);
		expect(result).toHaveLength(2);
		expect(result[0]!.author?.username).toBe("testuser");
		expect(result[1]!.author?.username).toBe("other");
	});

	test("returns empty array when data is undefined", () => {
		const response: TwitterV2ListResponse<Tweet> = {
			meta: { result_count: 0 },
		};

		const result = mergeTweetList(response);
		expect(result).toEqual([]);
	});

	test("handles empty includes", () => {
		const response: TwitterV2ListResponse<Tweet> = {
			data: [mockTweet],
			includes: {},
			meta: { result_count: 1 },
		};

		const result = mergeTweetList(response);
		expect(result).toHaveLength(1);
		expect(result[0]!.author).toBeUndefined();
	});
});
