/**
 * Deterministic GitHub page extractor.
 *
 * Extracts details from GitHub URLs and Web Clipper content
 * without requiring LLM calls. This is faster, cheaper, and more reliable
 * than LLM-based extraction for structured GitHub data.
 *
 * Supports:
 * - Profile pages (github.com/username)
 * - Repository pages (github.com/owner/repo)
 * - Issue pages (github.com/owner/repo/issues/N)
 * - PR pages (github.com/owner/repo/pull/N)
 *
 * @module inbox/process/github-extractor
 */

/**
 * GitHub page type classification.
 */
export type GitHubPageType =
	| "profile"
	| "repo"
	| "issue"
	| "pr"
	| "gist"
	| "org";

/**
 * Pinned repository info extracted from profile pages.
 */
export interface PinnedRepo {
	readonly name: string;
	readonly description?: string;
	readonly language?: string;
	readonly stars?: number;
	readonly forks?: number;
}

/**
 * GitHub details extracted from URL and content.
 */
export interface GitHubDetails {
	/** Page type classification */
	readonly pageType: GitHubPageType;
	/** GitHub username (for profiles) */
	readonly username?: string;
	/** Display name (human name, not username) */
	readonly displayName?: string;
	/** User bio/tagline */
	readonly bio?: string;
	/** Location */
	readonly location?: string;
	/** Repository name (for repo pages) */
	readonly repoName?: string;
	/** Repository owner */
	readonly repoOwner?: string;
	/** Repository description */
	readonly repoDescription?: string;
	/** Primary programming language */
	readonly repoLanguage?: string;
	/** Star count */
	readonly repoStars?: number;
	/** Fork count */
	readonly repoForks?: number;
	/** Issue/PR number */
	readonly issueNumber?: number;
	/** Issue/PR title */
	readonly issueTitle?: string;
	/** Pinned repositories (for profiles) */
	readonly pinnedRepos?: PinnedRepo[];
	/** Current projects/highlights mentioned in profile */
	readonly currentProjects?: string[];
}

/**
 * Check if a URL is a GitHub URL.
 *
 * @param url - URL to check
 * @returns True if this is a GitHub URL
 */
export function isGitHubUrl(url: string): boolean {
	return /^https?:\/\/(www\.)?github\.com\//i.test(url);
}

/**
 * Determine the GitHub page type from URL.
 *
 * @param url - GitHub URL
 * @returns Page type or null if not a recognized GitHub URL
 *
 * @example
 * ```typescript
 * getGitHubPageType("https://github.com/steipete") // => "profile"
 * getGitHubPageType("https://github.com/facebook/react") // => "repo"
 * getGitHubPageType("https://github.com/facebook/react/issues/123") // => "issue"
 * ```
 */
export function getGitHubPageType(url: string): GitHubPageType | null {
	if (!isGitHubUrl(url)) return null;

	// Extract path after github.com
	const match = url.match(/github\.com\/(.+)/i);
	if (!match?.[1]) return null;

	const path = match[1].replace(/\?.*$/, "").replace(/#.*$/, ""); // Remove query/hash
	const parts = path.split("/").filter(Boolean);

	if (parts.length === 0) return null;

	// Check for special paths
	if (parts[0] === "gist") return "gist";
	if (parts[0] === "orgs") return "org";

	// Single segment = profile (e.g., github.com/steipete)
	if (parts.length === 1) return "profile";

	// Two segments = repo (e.g., github.com/facebook/react)
	if (parts.length === 2) return "repo";

	// Check for issues/pulls
	if (parts[2] === "issues" || parts[2] === "issue") return "issue";
	if (parts[2] === "pull" || parts[2] === "pulls") return "pr";

	// Default to repo for other paths (e.g., github.com/owner/repo/tree/main)
	return "repo";
}

/**
 * Extract username from GitHub profile URL.
 *
 * @param url - GitHub URL
 * @returns Username or null
 */
export function extractUsernameFromUrl(url: string): string | null {
	const match = url.match(/github\.com\/([^/?#]+)/i);
	return match?.[1] || null;
}

/**
 * Extract owner/repo from GitHub repository URL.
 *
 * @param url - GitHub URL
 * @returns Object with owner and repo, or null
 */
export function extractRepoFromUrl(
	url: string,
): { owner: string; repo: string } | null {
	const match = url.match(/github\.com\/([^/?#]+)\/([^/?#]+)/i);
	if (!match?.[1] || !match?.[2]) return null;
	return { owner: match[1], repo: match[2] };
}

/**
 * Extract issue/PR number from URL.
 *
 * @param url - GitHub URL
 * @returns Issue/PR number or null
 */
export function extractIssueNumberFromUrl(url: string): number | null {
	const match = url.match(/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/(\d+)/i);
	if (!match?.[1]) return null;
	return Number.parseInt(match[1], 10);
}

/**
 * Extract display name from profile content.
 * Looks for "Name username" pattern in the profile header.
 *
 * @param content - Web Clipper markdown content
 * @returns Display name or null
 */
export function extractDisplayName(content: string): string | null {
	// Look for "## Name username" pattern
	const match = content.match(/##\s+([^·\n]+?)\s+\w+\s*·/);
	if (match?.[1]) {
		return match[1].trim();
	}

	// Alternative: Look for name after avatar image
	const altMatch = content.match(
		/full-sized avatar\]\([^)]+\)\s*\n\n##\s+([^\n]+)/,
	);
	if (altMatch?.[1]) {
		// Extract name before username (name is usually followed by username)
		const parts = altMatch[1].trim().split(/\s+/);
		if (parts.length >= 2) {
			// Return all but the last part (username)
			return parts.slice(0, -1).join(" ");
		}
	}

	return null;
}

/**
 * Extract bio/tagline from profile content.
 * The bio is usually a short description after the pronouns.
 *
 * @param content - Web Clipper markdown content
 * @returns Bio text or null
 */
export function extractBio(content: string): string | null {
	// Look for text after pronouns line (he/they, she/her, etc.)
	const match = content.match(
		/(?:he\/they|she\/her|they\/them|he\/him)\s*\n\n(.+?)(?:\n\n|$)/i,
	);
	if (match?.[1]) {
		const bio = match[1].trim();
		// Filter out very short or emoji-only bios
		if (bio.length > 5 && !/^[\s\p{Emoji}]+$/u.test(bio)) {
			return bio;
		}
	}

	// Alternative: Look for blockquote (sometimes profile summary is in a quote)
	const blockquoteMatch = content.match(/^>\s*(.+?)$/m);
	if (blockquoteMatch?.[1]) {
		return blockquoteMatch[1].trim();
	}

	return null;
}

/**
 * Extract location from profile content.
 *
 * @param content - Web Clipper markdown content
 * @returns Location or null
 */
export function extractLocation(content: string): string | null {
	// Look for location indicators (📍 or "Living in" patterns)
	const emojiMatch = content.match(/📍\s*\*?\*?([^*\n|]+)/);
	if (emojiMatch?.[1]) {
		return emojiMatch[1].trim();
	}

	// Look for location in profile sidebar
	const locationMatch = content.match(
		/(?:Location|Based in|Living in)[:\s]+([^\n]+)/i,
	);
	if (locationMatch?.[1]) {
		return locationMatch[1].trim();
	}

	return null;
}

/**
 * Extract pinned repositories from profile content.
 *
 * @param content - Web Clipper markdown content
 * @returns Array of pinned repos
 */
export function extractPinnedRepos(content: string): PinnedRepo[] {
	const repos: PinnedRepo[] = [];

	// Look for "Pinned" section followed by repo entries
	const pinnedSection = content.match(
		/## Pinned[^\n]*\n([\s\S]*?)(?=\n## |$)/i,
	);
	if (!pinnedSection?.[1]) return repos;

	const section = pinnedSection[1];

	// Parse repo entries - format: N. [name](url) Public\n\tDescription\n\tLanguage [stars] [forks]
	const repoPattern =
		/\d+\.\s*\[([^\]]+)\]\([^)]+\)[^\n]*\n\t([^\n]+)(?:\n\t([^\n]+))?\s*\[(\d+(?:\.?\d*k?)?)\]/g;

	let match: RegExpExecArray | null = repoPattern.exec(section);
	while (match !== null) {
		const name = match[1];
		const description = match[2]?.trim();
		const languageLine = match[3]?.trim();
		const stars = parseStarCount(match[4]);

		// Extract language from the language line
		let language: string | undefined;
		if (languageLine && !languageLine.includes("[")) {
			language = languageLine.split(/\s/)[0];
		}

		if (name) {
			repos.push({
				name,
				description: description || undefined,
				language,
				stars,
			});
		}
		match = repoPattern.exec(section);
	}

	// Alternative simpler pattern for basic pinned repos
	if (repos.length === 0) {
		const simplePattern =
			/\[([^\]]+)\]\(https:\/\/github\.com\/[^)]+\)[^\n]*Public[^\n]*\n\t([^\n]*)/g;
		match = simplePattern.exec(section);
		while (match !== null) {
			const repoName = match[1];
			if (repoName) {
				repos.push({
					name: repoName,
					description: match[2]?.trim() || undefined,
				});
			}
			match = simplePattern.exec(section);
		}
	}

	return repos;
}

/**
 * Parse star count from various formats (e.g., "1.1k", "820", "1k").
 *
 * @param starStr - Star count string
 * @returns Parsed number or undefined
 */
function parseStarCount(starStr: string | undefined): number | undefined {
	if (!starStr) return undefined;

	const cleaned = starStr.toLowerCase().trim();
	if (cleaned.endsWith("k")) {
		const num = Number.parseFloat(cleaned.slice(0, -1));
		return Number.isNaN(num) ? undefined : Math.round(num * 1000);
	}

	const num = Number.parseInt(cleaned.replace(/,/g, ""), 10);
	return Number.isNaN(num) ? undefined : num;
}

/**
 * Extract current projects from profile README content.
 *
 * @param content - Web Clipper markdown content
 * @returns Array of project names/descriptions
 */
export function extractCurrentProjects(content: string): string[] {
	const projects: string[] = [];

	// Look for "Current Projects" or similar section
	const projectSection = content.match(
		/##\s*Current Projects?\s*\n([\s\S]*?)(?=\n## |$)/i,
	);
	if (!projectSection?.[1]) return projects;

	const section = projectSection[1];

	// Parse project entries - format: - emoji **[Name](url)** - description
	const projectPattern =
		/[-*]\s*[^[]*\*?\*?\[([^\]]+)\]\([^)]+\)\*?\*?\s*[-–]\s*([^\n]+)/g;

	let match: RegExpExecArray | null = projectPattern.exec(section);
	while (match !== null) {
		const name = match[1];
		if (name) {
			const description = match[2]?.trim();
			projects.push(description ? `${name}: ${description}` : name);
		}
		match = projectPattern.exec(section);
	}

	return projects;
}

/**
 * Extract repository description from repo page content.
 *
 * @param content - Web Clipper markdown content
 * @returns Repository description or null
 */
export function extractRepoDescription(content: string): string | null {
	// Look for description in About section
	const aboutMatch = content.match(/About\s*\n\n([^\n]+)/i);
	if (aboutMatch?.[1]) {
		return aboutMatch[1].trim();
	}

	// Look for og:description in metadata pattern
	const metaMatch = content.match(/description[:\s]+["']?([^"'\n]+)/i);
	if (metaMatch?.[1]) {
		return metaMatch[1].trim();
	}

	return null;
}

/**
 * Extract repository stats (stars, forks, language) from content.
 *
 * @param content - Web Clipper markdown content
 * @returns Stats object
 */
export function extractRepoStats(content: string): {
	stars?: number;
	forks?: number;
	language?: string;
} {
	let stars: number | undefined;
	let forks: number | undefined;
	let language: string | undefined;

	// Look for star count
	const starMatch = content.match(/(\d+(?:\.\d+)?k?)\s*stars?/i);
	if (starMatch?.[1]) {
		stars = parseStarCount(starMatch[1]);
	}

	// Look for fork count
	const forkMatch = content.match(/(\d+(?:\.\d+)?k?)\s*forks?/i);
	if (forkMatch?.[1]) {
		forks = parseStarCount(forkMatch[1]);
	}

	// Look for primary language
	const langMatch = content.match(
		/(?:^|\s)(TypeScript|JavaScript|Python|Rust|Go|Java|Swift|Ruby|C\+\+|C#|PHP|Kotlin|Scala)(?:\s|$)/i,
	);
	if (langMatch?.[1]) {
		language = langMatch[1];
	}

	return { stars, forks, language };
}

/**
 * Extract all GitHub details from URL and content.
 *
 * This is the main entry point - combines URL and content extraction
 * to build a complete GitHub profile/repo info without LLM calls.
 *
 * @param url - GitHub URL
 * @param content - Web Clipper markdown content
 * @returns GitHub details or null if not a valid GitHub page
 *
 * @example
 * ```typescript
 * const details = extractGitHubDetails(
 *   "https://github.com/steipete",
 *   clipperContent
 * );
 * // => { pageType: "profile", username: "steipete", displayName: "Peter Steinberger", ... }
 * ```
 */
export function extractGitHubDetails(
	url: string,
	content: string,
): GitHubDetails | null {
	const pageType = getGitHubPageType(url);
	if (!pageType) return null;

	if (pageType === "profile") {
		const username = extractUsernameFromUrl(url);
		const displayName = extractDisplayName(content);
		const bio = extractBio(content);
		const location = extractLocation(content);
		const pinnedRepos = extractPinnedRepos(content);
		const currentProjects = extractCurrentProjects(content);

		return {
			pageType: "profile" as const,
			username: username ?? undefined,
			displayName: displayName ?? undefined,
			bio: bio ?? undefined,
			location: location ?? undefined,
			pinnedRepos: pinnedRepos.length > 0 ? pinnedRepos : undefined,
			currentProjects: currentProjects.length > 0 ? currentProjects : undefined,
		};
	}

	if (pageType === "repo") {
		const repoInfo = extractRepoFromUrl(url);
		const description = extractRepoDescription(content);
		const stats = extractRepoStats(content);

		return {
			pageType,
			repoOwner: repoInfo?.owner,
			repoName: repoInfo?.repo,
			repoDescription: description || undefined,
			repoLanguage: stats.language,
			repoStars: stats.stars,
			repoForks: stats.forks,
		};
	}

	if (pageType === "issue" || pageType === "pr") {
		const repoInfo = extractRepoFromUrl(url);
		const issueNumber = extractIssueNumberFromUrl(url);

		// Try to extract issue title from content
		const titleMatch = content.match(/^#\s*(.+?)(?:\s*#\d+)?$/m);
		const issueTitle = titleMatch?.[1]?.trim();

		return {
			pageType,
			repoOwner: repoInfo?.owner,
			repoName: repoInfo?.repo,
			issueNumber: issueNumber || undefined,
			issueTitle: issueTitle || undefined,
		};
	}

	// For gist and org, just return page type
	return { pageType };
}
