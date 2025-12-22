/**
 * YouTube Video Classifier
 *
 * Detects and extracts data from YouTube video notes captured via web clipper or manual entry.
 * Classifies videos into PARA categories based on content analysis from transcripts and metadata.
 *
 * @module classifiers/definitions/youtube
 */

import type { InboxConverter } from "../types";

/**
 * YouTube video classifier for video content from YouTube
 *
 * @remarks
 * This classifier detects YouTube video notes by matching frontmatter patterns.
 * It uses transcript content (if available) to make intelligent PARA classification.
 * Prioritized below research (85) but above bookmark (70) to prefer research classification
 * when both patterns match.
 */
export const youtubeClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "youtube",
	displayName: "YouTube Video",
	enabled: true,
	priority: 80, // Below research (85), above clipping (75)

	heuristics: {
		filenamePatterns: [], // YouTube video titles are too variable for filename matching
		contentMarkers: [
			{ pattern: "type:\\s*youtube", weight: 1.0 },
			{ pattern: "video_id:\\s*[A-Za-z0-9_-]{11}", weight: 0.95 },
			{ pattern: "source:\\s*youtube\\.com", weight: 0.9 },
			{ pattern: "channel:", weight: 0.8 },
			{ pattern: "duration:\\s*PT", weight: 0.8 }, // ISO 8601 duration format
			{ pattern: "transcript_status:", weight: 0.7 },
			{ pattern: "watch_status:", weight: 0.7 },
		],
		threshold: 0.3, // Optimized for content-only matching
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Video title",
			requirement: "required",
		},
		{
			name: "channel",
			type: "string",
			description: "YouTube channel name",
			requirement: "required",
		},
		{
			name: "published",
			type: "date",
			description: "Video publication date (YYYY-MM-DD)",
			requirement: "optional",
		},
		{
			name: "para",
			type: "string",
			description:
				"PARA destination (project name, area name, or 'resources') - use transcript to determine relevance",
			requirement: "required",
		},
	],

	extraction: {
		promptHint: `Extract YouTube video metadata and determine PARA classification:

Key fields to extract:
- title: Full video title
- channel: YouTube channel name
- published: Publication date (YYYY-MM-DD)

CRITICAL - Use transcript to determine PARA classification:
If transcript is available, analyze it to suggest:
- Project: If video is actionable and relates to current projects (coding tutorials for active project, how-to videos for current goal)
- Area: If video is educational/reference for ongoing responsibility (career development, health, finance, relationships, hobby learning)
- Resources: If video is general reference, entertainment, or not immediately actionable (interesting but not urgent)

Guidelines:
- Transcripts about specific technologies/tools for active projects → Suggest relevant project
- Career/skill development content → Suggest "Career Development" area
- Health/fitness/wellness content → Suggest "Health" area
- Finance/investing content → Suggest "Finance" area
- Relationship/communication content → Suggest "Relationships" area
- General education/inspiration → Suggest "Resources"
- Entertainment/casual viewing → Suggest "Resources"

Return in format:
{
  "title": "...",
  "channel": "...",
  "published": "YYYY-MM-DD",
  "para": "project-name|area-name|resources"
}`,
		keyFields: ["title", "channel", "para"],
	},

	template: {
		name: "youtube",
		fieldMappings: {
			title: "Video title",
			channel: "YouTube channel name",
			published: "Publication date (YYYY-MM-DD)",
			para: "PARA destination (project/area/resources)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
