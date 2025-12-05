/**
 * Implementation type for the plugin.
 * - markdown: Commands/skills are just prompts, no code (stub scripts)
 * - typescript: Includes CLI tools, utilities, or testable logic (full scripts)
 */
export type ImplementationType = "markdown" | "typescript";

/**
 * Configuration for generating a new plugin.
 */
export interface PluginConfig {
	/** Plugin name in kebab-case */
	name: string;
	/** Brief description of the plugin */
	description: string;
	/** Author information */
	author: {
		name: string;
		email?: string;
	};
	/** Implementation type: markdown-only or typescript */
	implementationType: ImplementationType;
	/** Which components to include */
	components: {
		/** Include commands/ directory with sample command */
		commands: boolean;
		/** Include mcp/ with full MCP setup */
		mcpServer: boolean;
		/** Include hooks/ with hooks.json */
		hooks: boolean;
		/** Include skills/ with SKILL.md */
		skills: boolean;
	};
}

/**
 * Result of plugin generation.
 */
export interface GenerationResult {
	success: boolean;
	pluginPath: string;
	filesCreated: string[];
	errors?: string[];
}

/**
 * Template context for generating files.
 */
export interface TemplateContext {
	name: string;
	description: string;
	authorName: string;
	authorEmail?: string;
	/** Name in PascalCase for class names */
	pascalName: string;
	/** Name with underscores for identifiers */
	snakeName: string;
}
