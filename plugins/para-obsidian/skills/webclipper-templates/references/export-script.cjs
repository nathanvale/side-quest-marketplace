/**
 * Web Clipper Template Export Script (v8)
 *
 * Exports templates from the combined source JSON to individual JSON files
 * that can be imported into Obsidian Web Clipper.
 *
 * Key fixes applied:
 * 1. Converts Dataview syntax (`= this.field`) to Web Clipper syntax ({{variable}})
 * 2. Removes `#` before template variables (e.g., `}} #{{` → `}} {{`)
 * 3. Adds `|trim` to all `|safe_name` patterns in noteNameFormat
 * 4. Converts URL replace filters to regex syntax (avoids colon parsing issues)
 *
 * Usage:
 *   node /tmp/fix-templates-v8.js
 *
 * Or copy this file and run:
 *   rm -rf ~/Downloads/webclipper-templates && \
 *   mkdir ~/Downloads/webclipper-templates && \
 *   node export-script.js
 */

const fs = require("fs");
const path = require("path");

// Configuration - update these paths as needed
// SOURCE_FILE should point to your combined templates JSON
const SOURCE_FILE = process.env.PARA_VAULT
	? process.env.PARA_VAULT +
		"/Templates/Clippings/web-clipper-all-templates.json"
	: "/Users/nathanvale/code/my-second-brain/Templates/Clippings/web-clipper-all-templates.json";
const OUTPUT_DIR = process.env.HOME + "/Downloads/webclipper-templates";

// Read source file
const source = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8"));

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Convert URL replace filters to regex syntax.
 *
 * PROBLEM: |replace:"https://schema.org/":"" breaks because `:` is a separator
 * SOLUTION: Use regex syntax |replace:"/https:\/\/schema\.org\//":""
 *
 * In JSON, forward slashes and dots need escaping in regex patterns.
 */
function fixReplaceFilters(str) {
	return str.replace(
		/\|replace:"(https?):\/\/([^"]+)":/g,
		(_match, protocol, rest) => {
			// Escape forward slashes and dots for regex
			const escaped = rest.replace(/\//g, "\\/").replace(/\./g, "\\.");
			return `|replace:"/${protocol}:\\/\\/${escaped}/":`;
		},
	);
}

// Process each template
for (const template of source.templates) {
	let content = template.noteContentFormat || "";

	// Build property map for Dataview conversion
	const propMap = {};
	for (const prop of template.properties) {
		propMap[prop.name] = prop.value;
	}

	// Replace Dataview syntax with Web Clipper syntax
	// `= this.file.name` → {{title}}
	content = content.replace(/`= this\.file\.name`/g, "{{title}}");

	// `= this.fieldName` → property value from map
	content = content.replace(/`= this\.(\w+)`/g, (_match, fieldName) => {
		if (propMap[fieldName] !== undefined) {
			return propMap[fieldName];
		}
		return "";
	});

	// Fix Book template: remove the # before series position
	// "}} #{{" → "}} {{"
	content = content.replace(/\}\} #\{\{/g, "}} {{");

	// Convert URL replace filters to regex syntax
	content = fixReplaceFilters(content);

	// Fix properties - convert URL replace filters to regex
	const fixedProps = template.properties.map((p) => {
		const value = fixReplaceFilters(p.value);
		return {
			name: p.name,
			value: value,
			type: p.type,
		};
	});

	// Fix noteNameFormat - ensure all variables end with |trim
	// |safe_name}} → |safe_name|trim}}
	let noteNameFormat = template.noteNameFormat;
	noteNameFormat = noteNameFormat.replace(
		/\|safe_name\}\}/g,
		"|safe_name|trim}}",
	);

	// Build clean template object
	const clean = {
		schemaVersion: "0.1.0",
		name: template.name,
		behavior: template.behavior || "create",
		noteNameFormat: noteNameFormat,
		path: template.path,
		noteContentFormat: content,
		properties: fixedProps,
		triggers: template.triggers || [],
	};

	// Generate filename from template name
	// "Product / Gift Idea" → "product-gift-idea.json"
	const filename =
		template.name
			.toLowerCase()
			.replace(/\s*\/\s*/g, "-")
			.replace(/\s+/g, "-") + ".json";

	// Write template file
	fs.writeFileSync(
		path.join(OUTPUT_DIR, filename),
		JSON.stringify(clean, null, 2),
	);

	console.log("Exported: " + filename);
}

console.log("\nDone! Templates exported to: " + OUTPUT_DIR);
console.log("\nNext steps:");
console.log("1. Open Obsidian Web Clipper settings");
console.log("2. Go to Templates section");
console.log("3. Click Import");
console.log("4. Select files from " + OUTPUT_DIR);
