#!/usr/bin/env node

/**
 * Bash History MCP Server
 *
 * Provides search and retrieval of bash command history using atuin.
 * Displays exit codes, timestamps, and command text.
 */

import { tool, startServer, z } from "mcpez";
import { execSync } from "child_process";

/**
 * Execute atuin search command and parse results
 */
function searchHistory(query, limit = 10, includeFailed = false) {
  try {
    const includeFailedFlag = includeFailed ? "" : "--exclude-exit 1-255";
    const cmd = `atuin search --limit ${limit} --search-mode fuzzy --filter-mode global --format "{time}\\t{exit}\\t{command}" ${includeFailedFlag} "${query}"`;

    const output = execSync(cmd, { encoding: "utf8" });

    if (!output.trim()) {
      return {
        count: 0,
        commands: [],
        message: `No commands found matching: ${query}`,
      };
    }

    const lines = output.trim().split("\n");
    const commands = lines.map((line) => {
      const [time, exit_code, ...commandParts] = line.split("\t");
      return {
        time,
        exit_code: parseInt(exit_code, 10),
        command: commandParts.join("\t"),
      };
    });

    return {
      count: commands.length,
      commands,
    };
  } catch (error) {
    // If atuin fails, fall back to zsh history
    try {
      const fallbackCmd = `fc -l -${limit} | grep -i "${query}" | awk '{$1=""; print $0}' | sed 's/^ //'`;
      const output = execSync(fallbackCmd, { encoding: "utf8", shell: "/bin/zsh" });

      const lines = output
        .trim()
        .split("\n")
        .filter((l) => l);
      const commands = lines.map((command) => ({
        time: "N/A",
        exit_code: "N/A",
        command: command.trim(),
      }));

      return {
        count: commands.length,
        commands,
        source: "zsh_history_fallback",
      };
    } catch (fallbackError) {
      throw new Error(`Failed to search history: ${error.message}`);
    }
  }
}

/**
 * Get recent command history
 */
function getRecentHistory(limit = 10, includeFailed = false) {
  return searchHistory("", limit * 2, includeFailed);
}

/**
 * Format search results for display
 */
function formatResults(results) {
  if (results.count === 0) {
    return results.message;
  }

  let output = `Found ${results.count} command${results.count === 1 ? "" : "s"}:\n\n`;

  results.commands.forEach((cmd, idx) => {
    const exitIcon = cmd.exit_code === 0 ? "✅" : cmd.exit_code === "N/A" ? "❓" : "❌";
    const exitDisplay = cmd.exit_code === "N/A" ? "N/A" : `${cmd.exit_code}`;

    output += `${idx + 1}. ${exitIcon} Exit: ${exitDisplay} | Time: ${cmd.time}\n`;
    output += `   ${cmd.command}\n\n`;
  });

  if (results.source === "zsh_history_fallback") {
    output += "\n⚠️  Using zsh history fallback (atuin unavailable)\n";
  }

  return output.trim();
}

// Register tools using Zod schemas (mcpez bundles Zod v3)
tool(
  "search_history",
  {
    description:
      "Search command history using atuin. Returns matching commands with timestamps, exit codes, and full command text.",
    inputSchema: {
      query: z.string().describe("Search query to find matching commands"),
      limit: z.number().default(10).describe("Maximum number of results to return (default: 10)"),
      include_failed: z
        .boolean()
        .default(false)
        .describe("Include commands that failed (non-zero exit code). Default: false"),
    },
  },
  async ({ query, limit = 10, include_failed = false }) => {
    const results = searchHistory(query, limit, include_failed);
    return { content: [{ type: "text", text: formatResults(results) }] };
  }
);

tool(
  "get_recent_history",
  {
    description: "Get recent command history from atuin with timestamps and exit codes.",
    inputSchema: {
      limit: z.number().default(10).describe("Number of recent commands to retrieve (default: 10)"),
      include_failed: z
        .boolean()
        .default(false)
        .describe("Include commands that failed (non-zero exit code). Default: false"),
    },
  },
  async ({ limit = 10, include_failed = false }) => {
    const results = getRecentHistory(limit, include_failed);
    return { content: [{ type: "text", text: formatResults(results) }] };
  }
);

// Start the MCP server
startServer("bash-history", { version: "1.0.0" });
