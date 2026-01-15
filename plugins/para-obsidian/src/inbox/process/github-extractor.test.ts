/**
 * Tests for deterministic GitHub page extractor.
 *
 * @module inbox/process/github-extractor.test
 */
import { describe, expect, test } from "bun:test";
import {
	extractBio,
	extractCurrentProjects,
	extractDisplayName,
	extractGitHubDetails,
	extractIssueNumberFromUrl,
	extractLocation,
	extractPinnedRepos,
	extractRepoDescription,
	extractRepoFromUrl,
	extractRepoStats,
	extractUsernameFromUrl,
	getGitHubPageType,
	isGitHubUrl,
} from "./github-extractor.js";

describe("isGitHubUrl", () => {
	test("returns true for GitHub URLs", () => {
		expect(isGitHubUrl("https://github.com/steipete")).toBe(true);
		expect(isGitHubUrl("https://www.github.com/facebook/react")).toBe(true);
		expect(isGitHubUrl("http://github.com/user/repo")).toBe(true);
	});

	test("returns false for non-GitHub URLs", () => {
		expect(isGitHubUrl("https://gitlab.com/user/repo")).toBe(false);
		expect(isGitHubUrl("https://example.com")).toBe(false);
		expect(isGitHubUrl("https://google.com/github")).toBe(false);
	});
});

describe("getGitHubPageType", () => {
	test("identifies profile pages", () => {
		expect(getGitHubPageType("https://github.com/steipete")).toBe("profile");
		expect(getGitHubPageType("https://github.com/nathanvale")).toBe("profile");
	});

	test("identifies repository pages", () => {
		expect(getGitHubPageType("https://github.com/facebook/react")).toBe("repo");
		expect(getGitHubPageType("https://github.com/owner/repo/tree/main")).toBe(
			"repo",
		);
		expect(
			getGitHubPageType("https://github.com/owner/repo/blob/main/README.md"),
		).toBe("repo");
	});

	test("identifies issue pages", () => {
		expect(getGitHubPageType("https://github.com/owner/repo/issues/123")).toBe(
			"issue",
		);
		expect(getGitHubPageType("https://github.com/owner/repo/issue/456")).toBe(
			"issue",
		);
	});

	test("identifies PR pages", () => {
		expect(getGitHubPageType("https://github.com/owner/repo/pull/123")).toBe(
			"pr",
		);
		expect(getGitHubPageType("https://github.com/owner/repo/pulls")).toBe("pr");
	});

	test("identifies gist pages", () => {
		expect(getGitHubPageType("https://github.com/gist/abc123")).toBe("gist");
	});

	test("identifies org pages", () => {
		expect(getGitHubPageType("https://github.com/orgs/myorg")).toBe("org");
	});

	test("returns null for non-GitHub URLs", () => {
		expect(getGitHubPageType("https://gitlab.com/user")).toBeNull();
		expect(getGitHubPageType("https://example.com")).toBeNull();
	});
});

describe("extractUsernameFromUrl", () => {
	test("extracts username from profile URL", () => {
		expect(extractUsernameFromUrl("https://github.com/steipete")).toBe(
			"steipete",
		);
		expect(extractUsernameFromUrl("https://github.com/nathanvale")).toBe(
			"nathanvale",
		);
	});

	test("extracts username from repo URL", () => {
		expect(extractUsernameFromUrl("https://github.com/facebook/react")).toBe(
			"facebook",
		);
	});

	test("returns null for invalid URLs", () => {
		expect(extractUsernameFromUrl("https://gitlab.com/user")).toBeNull();
	});
});

describe("extractRepoFromUrl", () => {
	test("extracts owner and repo from URL", () => {
		expect(extractRepoFromUrl("https://github.com/facebook/react")).toEqual({
			owner: "facebook",
			repo: "react",
		});
		expect(
			extractRepoFromUrl("https://github.com/owner/repo/tree/main"),
		).toEqual({
			owner: "owner",
			repo: "repo",
		});
	});

	test("returns null for profile URLs", () => {
		expect(extractRepoFromUrl("https://github.com/steipete")).toBeNull();
	});
});

describe("extractIssueNumberFromUrl", () => {
	test("extracts issue number", () => {
		expect(
			extractIssueNumberFromUrl("https://github.com/owner/repo/issues/123"),
		).toBe(123);
		expect(
			extractIssueNumberFromUrl("https://github.com/owner/repo/pull/456"),
		).toBe(456);
	});

	test("returns null for non-issue URLs", () => {
		expect(
			extractIssueNumberFromUrl("https://github.com/owner/repo"),
		).toBeNull();
	});
});

describe("extractDisplayName", () => {
	test("extracts display name from profile header", () => {
		const content = `
![Avatar](https://avatars.githubusercontent.com/u/123)

## Peter Steinberger steipete · he/they

Building PSPDFKit
`;
		expect(extractDisplayName(content)).toBe("Peter Steinberger");
	});

	test("returns null when no display name found", () => {
		expect(extractDisplayName("No profile info here")).toBeNull();
	});
});

describe("extractBio", () => {
	test("extracts bio after pronouns", () => {
		const content = `
## Name username

he/they

Building amazing software and shipping products

Some other content
`;
		expect(extractBio(content)).toBe(
			"Building amazing software and shipping products",
		);
	});

	test("extracts bio from blockquote", () => {
		const content = `
Some content

> This is my bio tagline

More content
`;
		expect(extractBio(content)).toBe("This is my bio tagline");
	});

	test("returns null when no bio found", () => {
		expect(extractBio("No bio here")).toBeNull();
	});
});

describe("extractLocation", () => {
	test("extracts location from emoji", () => {
		const content = "📍 **Vienna, Austria** | Building";
		expect(extractLocation(content)).toBe("Vienna, Austria");
	});

	test("extracts location from text pattern", () => {
		const content = "Location: San Francisco, CA";
		expect(extractLocation(content)).toBe("San Francisco, CA");
	});

	test("returns null when no location found", () => {
		expect(extractLocation("Just some random content")).toBeNull();
	});
});

describe("extractPinnedRepos", () => {
	test("extracts pinned repos from profile", () => {
		const content = `
## Pinned

1. [awesome-project](https://github.com/user/awesome-project) Public
	A really cool project
	TypeScript [1.2k]

2. [another-repo](https://github.com/user/another-repo) Public
	Description here
	Python [500]
`;
		const repos = extractPinnedRepos(content);
		expect(repos).toHaveLength(2);
		expect(repos[0]?.name).toBe("awesome-project");
		expect(repos[0]?.description).toBe("A really cool project");
		expect(repos[0]?.stars).toBe(1200);
	});

	test("returns empty array when no pinned repos found", () => {
		expect(extractPinnedRepos("No pinned repos")).toEqual([]);
	});
});

describe("extractCurrentProjects", () => {
	test("extracts current projects list", () => {
		const content = `
## Current Projects

- 🚀 **[Project A](https://example.com/a)** - Building something cool
- 📱 **[Project B](https://example.com/b)** - Mobile app development
`;
		const projects = extractCurrentProjects(content);
		expect(projects).toHaveLength(2);
		expect(projects[0]).toBe("Project A: Building something cool");
		expect(projects[1]).toBe("Project B: Mobile app development");
	});

	test("returns empty array when no projects found", () => {
		expect(extractCurrentProjects("No projects here")).toEqual([]);
	});
});

describe("extractRepoDescription", () => {
	test("extracts description from About section", () => {
		const content = `
About

A JavaScript library for building user interfaces

Some other content
`;
		expect(extractRepoDescription(content)).toBe(
			"A JavaScript library for building user interfaces",
		);
	});

	test("returns null when no description found", () => {
		expect(extractRepoDescription("No description")).toBeNull();
	});
});

describe("extractRepoStats", () => {
	test("extracts star count", () => {
		const content = "⭐ 200k stars";
		expect(extractRepoStats(content).stars).toBe(200000);
	});

	test("extracts fork count", () => {
		const content = "🍴 40k forks";
		expect(extractRepoStats(content).forks).toBe(40000);
	});

	test("extracts programming language", () => {
		const content = "TypeScript 85%";
		expect(extractRepoStats(content).language).toBe("TypeScript");
	});

	test("handles multiple stats", () => {
		const content = "1.5k stars 500 forks TypeScript";
		const stats = extractRepoStats(content);
		expect(stats.stars).toBe(1500);
		expect(stats.forks).toBe(500);
		expect(stats.language).toBe("TypeScript");
	});
});

describe("extractGitHubDetails", () => {
	test("extracts profile details", () => {
		const url = "https://github.com/steipete";
		const content = `
![Avatar](https://avatars.githubusercontent.com/u/123)

## Peter Steinberger steipete · he/they

Building PSPDFKit

📍 **Vienna, Austria**

## Pinned

1. [pspdfkit](https://github.com/steipete/pspdfkit) Public
	PDF SDK
	Swift [100]
`;
		const details = extractGitHubDetails(url, content);

		expect(details).not.toBeNull();
		expect(details?.pageType).toBe("profile");
		expect(details?.username).toBe("steipete");
		expect(details?.displayName).toBe("Peter Steinberger");
		expect(details?.location).toBe("Vienna, Austria");
	});

	test("extracts repo details", () => {
		const url = "https://github.com/facebook/react";
		const content = `
About

A JavaScript library for building user interfaces

200k stars 40k forks TypeScript
`;
		const details = extractGitHubDetails(url, content);

		expect(details).not.toBeNull();
		expect(details?.pageType).toBe("repo");
		expect(details?.repoOwner).toBe("facebook");
		expect(details?.repoName).toBe("react");
		expect(details?.repoDescription).toBe(
			"A JavaScript library for building user interfaces",
		);
		expect(details?.repoStars).toBe(200000);
	});

	test("extracts issue details", () => {
		const url = "https://github.com/facebook/react/issues/123";
		const content = `
# Bug in useState hook #123

Some issue description
`;
		const details = extractGitHubDetails(url, content);

		expect(details).not.toBeNull();
		expect(details?.pageType).toBe("issue");
		expect(details?.repoOwner).toBe("facebook");
		expect(details?.repoName).toBe("react");
		expect(details?.issueNumber).toBe(123);
		expect(details?.issueTitle).toBe("Bug in useState hook");
	});

	test("returns null for non-GitHub URLs", () => {
		expect(
			extractGitHubDetails("https://gitlab.com/user", "content"),
		).toBeNull();
	});
});
