/**
 * Git path utilities for handling escaped filenames.
 *
 * Git escapes non-ASCII UTF-8 bytes as octal sequences when core.quotepath=true (default).
 * This module provides utilities to decode these escaped paths back to proper UTF-8 strings.
 */

/**
 * Unescapes git's C-style quoted paths.
 *
 * Git escapes non-ASCII UTF-8 bytes as octal sequences when core.quotepath=true (default).
 * Example: 🧾 (U+1F9FE) = UTF-8 bytes [F0 9F A7 BE] = \360\237\247\276 in git output
 *
 * Also handles standard C escape sequences: \n, \t, \r, \\, \"
 *
 * @param gitPath - Path from git status output (after quote stripping)
 * @returns Properly decoded UTF-8 path
 *
 * @example
 * ```typescript
 * unescapeGitPath("\\360\\237\\247\\276 Invoice.md") // "🧾 Invoice.md"
 * unescapeGitPath("file\\twith\\ttabs.md") // "file\twith\ttabs.md"
 * ```
 */
export function unescapeGitPath(gitPath: string): string {
	const bytes: number[] = [];
	let i = 0;

	while (i < gitPath.length) {
		if (gitPath[i] === "\\" && i + 1 < gitPath.length) {
			const nextChar = gitPath[i + 1];

			// Check for octal escape \ooo (3 octal digits)
			if (i + 3 < gitPath.length) {
				const nextThree = gitPath.substring(i + 1, i + 4);
				if (/^[0-7]{3}$/.test(nextThree)) {
					bytes.push(Number.parseInt(nextThree, 8));
					i += 4;
					continue;
				}
			}

			// Check for single-char escapes
			switch (nextChar) {
				case "n":
					bytes.push(10);
					i += 2;
					continue;
				case "t":
					bytes.push(9);
					i += 2;
					continue;
				case "r":
					bytes.push(13);
					i += 2;
					continue;
				case "\\":
					bytes.push(92);
					i += 2;
					continue;
				case '"':
					bytes.push(34);
					i += 2;
					continue;
			}
		}

		// Regular ASCII character - add its char code
		bytes.push(gitPath.charCodeAt(i));
		i++;
	}

	// Decode UTF-8 bytes to string
	return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}
