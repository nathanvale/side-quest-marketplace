/**
 * Obsidian utilities module.
 *
 * Provides utilities for working with Obsidian vault features:
 * - Wikilink parsing and manipulation
 * - Frontmatter parsing and serialization
 * - Title formatting and prefix application
 *
 * @module obsidian
 */

export {
	type FrontmatterParseResult,
	parseFrontmatter,
	serializeFrontmatter,
} from "./frontmatter";
export { applyTitlePrefix } from "./title-formatting";
export { stripWikilinks, stripWikilinksOrValue } from "./wikilinks";
