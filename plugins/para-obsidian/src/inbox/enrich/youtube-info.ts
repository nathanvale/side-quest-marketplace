/**
 * YouTube Video Info Client
 *
 * Fetches video metadata (channel, duration, description, published date)
 * by scraping the YouTube page directly (no API key required).
 *
 * @module inbox/enrich/youtube-info
 */

import { observe } from "../../shared/instrumentation.js";
import { enrichLogger } from "../../shared/logger.js";

/**
 * Video info returned from YouTube.
 */
export interface YouTubeVideoInfo {
	/** Video title */
	title: string;
	/** Channel name (uploader) */
	channel: string;
	/** Video description (full description from YouTube page) */
	description: string;
	/** Upload date (YYYY-MM-DD format) */
	uploadDate: string;
	/** Duration as human-readable string (e.g., "4 minutes") */
	duration: string;
}

/**
 * Result of fetching video info.
 */
export interface VideoInfoResult {
	status: "success" | "failed";
	info?: YouTubeVideoInfo;
	error?: string;
}

/**
 * Format seconds as human-readable duration string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration (e.g., "4 minutes", "1 hour 23 minutes")
 */
function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${seconds} seconds`;
	}

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return minutes > 0
			? `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minute${minutes > 1 ? "s" : ""}`
			: `${hours} hour${hours > 1 ? "s" : ""}`;
	}

	return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/**
 * Fetch YouTube video info by scraping the YouTube page.
 *
 * Extracts video metadata from the embedded ytInitialPlayerResponse JSON
 * which includes title, description, channel, duration, and upload date.
 * No API key required.
 *
 * @param videoId - YouTube video ID
 * @returns Video info result
 *
 * @example
 * ```typescript
 * const result = await fetchVideoInfo("dQw4w9WgXcQ");
 * if (result.status === "success") {
 *   console.log(result.info?.channel); // "Rick Astley"
 *   console.log(result.info?.description); // Full video description
 * }
 * ```
 */
export async function fetchVideoInfo(
	videoId: string,
): Promise<VideoInfoResult> {
	const log = enrichLogger;

	return observe(
		log,
		"enrich:fetchVideoInfo",
		async () => {
			try {
				// Fetch the YouTube video page
				const url = `https://www.youtube.com/watch?v=${videoId}`;
				const response = await fetch(url, {
					headers: {
						// Use a realistic user agent to avoid blocks
						"User-Agent":
							"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						"Accept-Language": "en-US,en;q=0.9",
					},
				});

				if (!response.ok) {
					throw new Error(`YouTube returned ${response.status}`);
				}

				const html = await response.text();

				// Extract ytInitialPlayerResponse from the page
				// This contains video metadata including description
				const playerResponseMatch = html.match(
					/var ytInitialPlayerResponse\s*=\s*({.+?});/s,
				);

				if (!playerResponseMatch) {
					throw new Error("Could not find video data in YouTube page");
				}

				// biome-ignore lint/suspicious/noExplicitAny: YouTube's response structure varies
				let playerData: any;
				try {
					const jsonString = playerResponseMatch[1];
					if (!jsonString) {
						throw new Error("Empty video data");
					}
					playerData = JSON.parse(jsonString);
				} catch {
					throw new Error("Failed to parse YouTube video data");
				}

				// Extract video details from the player response
				const videoDetails = playerData?.videoDetails;
				const microformat = playerData?.microformat?.playerMicroformatRenderer;

				if (!videoDetails) {
					throw new Error("No video details found in YouTube response");
				}

				// Build the video info
				const info: YouTubeVideoInfo = {
					title: videoDetails.title || "",
					channel: videoDetails.author || "",
					description: videoDetails.shortDescription || "",
					uploadDate: microformat?.uploadDate || microformat?.publishDate || "",
					duration: videoDetails.lengthSeconds
						? formatDuration(Number.parseInt(videoDetails.lengthSeconds, 10))
						: "",
				};

				if (log) {
					log.info`enrich:fetchVideoInfo:success videoId=${videoId} channel=${info.channel} hasDescription=${info.description.length > 0}`;
				}

				return {
					status: "success",
					info,
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				if (log) {
					log.error`enrich:fetchVideoInfo:error videoId=${videoId} error=${errorMsg}`;
				}
				return {
					status: "failed",
					error: errorMsg,
				};
			}
		},
		{ context: { videoId } },
	);
}
