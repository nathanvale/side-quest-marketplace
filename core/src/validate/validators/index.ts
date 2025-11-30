/**
 * Plugin validation utilities for the SideQuest marketplace.
 *
 * This module provides validators for different aspects of Claude Code plugins:
 * - bootstrap-hook: SessionStart bootstrap hook validation
 * - hooks.json structure and content validation
 * - .mcp.json structure and server configuration validation
 * - MCP tool naming convention validation
 * - plugin-structure: folder structure and organization validation
 * - SKILL.md frontmatter and required fields validation
 *
 * @module validators
 */

export { validateBootstrapHook } from "./bootstrap-hook.ts";
export { validateHooksJson } from "./hooks-json.ts";
export { validateMcpJson } from "./mcp-json.ts";
export { validateMcpToolNaming } from "./mcp-tool-naming.ts";
export { validatePluginStructure } from "./plugin-structure.ts";
export { validateSkillMd } from "./skill-md.ts";
