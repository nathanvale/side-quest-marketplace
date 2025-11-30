/**
 * Plugin validation utilities for the SideQuest marketplace.
 *
 * This module provides validators for different aspects of Claude Code plugins:
 * - agents-md: Agent markdown file validation with YAML frontmatter
 * - bootstrap-hook: SessionStart bootstrap hook validation
 * - commands-md: Command markdown files structure and frontmatter validation
 * - hooks.json structure and content validation
 * - marketplace.json structure and plugin registry validation
 * - .mcp.json structure and server configuration validation
 * - MCP tool naming convention validation
 * - plugin.json structure and metadata validation
 * - plugin-structure: folder structure and organization validation
 * - SKILL.md frontmatter and required fields validation
 *
 * @module validators
 */

export { validateAgentsMd } from "./agents-md.ts";
export { validateBootstrapHook } from "./bootstrap-hook.ts";
export { validateCommandsMd } from "./commands-md.ts";
export { validateHooksJson } from "./hooks-json.ts";
export { validateMarketplaceJson } from "./marketplace-json.ts";
export { validateMcpJson } from "./mcp-json.ts";
export { validateMcpToolNaming } from "./mcp-tool-naming.ts";
export { validatePluginJson } from "./plugin-json.ts";
export { validatePluginStructure } from "./plugin-structure.ts";
export { validateSkillMd } from "./skill-md.ts";
