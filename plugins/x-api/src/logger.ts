/**
 * X-API plugin logger.
 *
 * Single "mcp" subsystem — keeps observability lean (tsc-runner pattern).
 * Output: ~/.claude/logs/x-api.jsonl (auto-rotated by core)
 */

import { createPluginLogger } from "@sidequest/core/logging";

const { initLogger, getSubsystemLogger, createCorrelationId } =
	createPluginLogger({
		name: "x-api",
		subsystems: ["mcp"],
	});

const logger = getSubsystemLogger("mcp");

export { createCorrelationId, initLogger, logger };
