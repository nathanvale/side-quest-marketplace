/**
 * Kit Plugin Validators
 *
 * Input validation and security utilities for safe Kit CLI operations.
 */

import { existsSync, statSync } from "node:fs";
import { normalizePath } from "@sidequest/core/fs";
import {
	validateGlob,
	validateInteger,
	validateRegex,
} from "@sidequest/core/validation";
import { getDefaultKitPath } from "./types.js";

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Result of path validation.
 */
export interface PathValidationResult {
	/** Whether the path is valid */
	valid: boolean;
	/** Normalized absolute path (only if valid) */
	path?: string;
	/** Error message (only if invalid) */
	error?: string;
}

/**
 * Validate a path for Kit operations.
 *
 * Checks:
 * - Path exists
 * - Path is a directory (for search operations)
 * - No path traversal attacks (.. sequences escaping base)
 *
 * @param inputPath - Path to validate
 * @param options - Validation options
 * @returns Validation result with normalized path or error
 */
export function validatePath(
	inputPath: string,
	options: {
		/** Base directory to restrict access within (optional) */
		basePath?: string;
		/** Whether the path must be a directory (default: true) */
		mustBeDirectory?: boolean;
		/** Whether the path must exist (default: true) */
		mustExist?: boolean;
	} = {},
): PathValidationResult {
	const { basePath, mustBeDirectory = true, mustExist = true } = options;

	// Empty path check
	if (!inputPath || inputPath.trim() === "") {
		return { valid: false, error: "Path cannot be empty" };
	}

	// Normalize the path
	const normalizedPath = normalizePath(inputPath, basePath);

	// Path traversal check - if basePath is specified, ensure we stay within it
	if (basePath) {
		const normalizedBase = normalizePath(basePath);
		if (!normalizedPath.startsWith(normalizedBase)) {
			return {
				valid: false,
				error: "Path traversal detected: path escapes base directory",
			};
		}
	}

	// Existence check
	if (mustExist && !existsSync(normalizedPath)) {
		return { valid: false, error: `Path does not exist: ${normalizedPath}` };
	}

	// Directory check
	if (mustExist && mustBeDirectory) {
		try {
			const stats = statSync(normalizedPath);
			if (!stats.isDirectory()) {
				return {
					valid: false,
					error: `Path is not a directory: ${normalizedPath}`,
				};
			}
		} catch {
			return { valid: false, error: `Cannot access path: ${normalizedPath}` };
		}
	}

	return { valid: true, path: normalizedPath };
}

// ============================================================================
// Glob Validation - Now imported from @sidequest/core/validation
// ============================================================================

// ============================================================================
// Regex Validation - Now imported from @sidequest/core/validation
// ============================================================================

// ============================================================================
// Integer Validation
// ============================================================================

/**
 * Validate a number is a positive integer within bounds.
 * @deprecated Use validateInteger from @sidequest/core/validation instead
 * @param value - Value to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validatePositiveInt(
	value: unknown,
	options: {
		/** Field name for error messages */
		name: string;
		/** Minimum allowed value (default: 1) */
		min?: number;
		/** Maximum allowed value (default: 10000) */
		max?: number;
		/** Default value if undefined */
		defaultValue?: number;
	},
): { valid: boolean; value?: number; error?: string } {
	// Delegate to core validateInteger with backward-compatible defaults
	return validateInteger(value, {
		name: options.name,
		min: options.min ?? 1,
		max: options.max ?? 10000,
		defaultValue: options.defaultValue,
	});
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Validate all inputs for a grep search operation.
 * @param inputs - Grep inputs to validate
 * @returns Combined validation result
 */
export function validateGrepInputs(inputs: {
	pattern: string;
	path?: string;
	include?: string;
	exclude?: string;
	maxResults?: number;
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		pattern: string;
		path: string;
		include?: string;
		exclude?: string;
		maxResults: number;
	};
} {
	const errors: string[] = [];

	// Validate pattern - core returns ValidationResult<RegExp>
	const patternResult = validateRegex(inputs.pattern);
	if (!patternResult.valid) {
		errors.push(patternResult.error!);
	}

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate include glob (optional)
	let validatedInclude: string | undefined;
	if (inputs.include) {
		const includeResult = validateGlob(inputs.include);
		if (!includeResult.valid) {
			errors.push(`Include pattern: ${includeResult.error}`);
		} else {
			validatedInclude = includeResult.value;
		}
	}

	// Validate exclude glob (optional)
	let validatedExclude: string | undefined;
	if (inputs.exclude) {
		const excludeResult = validateGlob(inputs.exclude);
		if (!excludeResult.valid) {
			errors.push(`Exclude pattern: ${excludeResult.error}`);
		} else {
			validatedExclude = excludeResult.value;
		}
	}

	// Validate maxResults
	const maxResultsResult = validatePositiveInt(inputs.maxResults, {
		name: "maxResults",
		min: 1,
		max: 1000,
		defaultValue: 100,
	});
	if (!maxResultsResult.valid) {
		errors.push(maxResultsResult.error!);
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			pattern: patternResult.value!.source, // Extract source from compiled RegExp
			path: pathResult.path!,
			include: validatedInclude,
			exclude: validatedExclude,
			maxResults: maxResultsResult.value!,
		},
	};
}

/**
 * Validate all inputs for a semantic search operation.
 * @param inputs - Semantic search inputs to validate
 * @returns Combined validation result
 */
export function validateSemanticInputs(inputs: {
	query: string;
	path?: string;
	topK?: number;
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		query: string;
		path: string;
		topK: number;
	};
} {
	const errors: string[] = [];

	// Validate query (not a regex, just non-empty)
	if (!inputs.query || inputs.query.trim() === "") {
		errors.push("Query cannot be empty");
	}

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate topK
	const topKResult = validatePositiveInt(inputs.topK, {
		name: "topK",
		min: 1,
		max: 50,
		defaultValue: 5,
	});
	if (!topKResult.valid) {
		errors.push(topKResult.error!);
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			query: inputs.query.trim(),
			path: pathResult.path!,
			topK: topKResult.value!,
		},
	};
}

/**
 * Validate all inputs for a symbols extraction operation.
 * @param inputs - Symbols inputs to validate
 * @returns Combined validation result
 */
export function validateSymbolsInputs(inputs: {
	path?: string;
	pattern?: string;
	symbolType?: string;
	file?: string;
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		path: string;
		pattern?: string;
		symbolType?: string;
		file?: string;
	};
} {
	const errors: string[] = [];

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate file (specific file to extract symbols from)
	let validatedFile: string | undefined;
	if (inputs.file) {
		// File path is relative to repo, just sanitize
		const trimmed = inputs.file.trim();
		if (trimmed.includes("..")) {
			errors.push("File path cannot contain path traversal sequences");
		} else {
			validatedFile = trimmed;
		}
	}

	// Validate file pattern (optional glob)
	let validatedPattern: string | undefined;
	if (inputs.pattern) {
		const patternResult = validateGlob(inputs.pattern);
		if (!patternResult.valid) {
			errors.push(`File pattern: ${patternResult.error}`);
		} else {
			validatedPattern = patternResult.value;
		}
	}

	// Validate symbol type (optional, just sanitize)
	let validatedSymbolType: string | undefined;
	if (inputs.symbolType) {
		const sanitized = inputs.symbolType.trim().toLowerCase();
		const validTypes = [
			"function",
			"class",
			"variable",
			"type",
			"interface",
			"method",
			"property",
			"constant",
		];
		if (sanitized && !validTypes.includes(sanitized)) {
			errors.push(
				`Invalid symbol type: ${inputs.symbolType}. Valid types: ${validTypes.join(", ")}`,
			);
		} else {
			validatedSymbolType = sanitized || undefined;
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			path: pathResult.path!,
			pattern: validatedPattern,
			symbolType: validatedSymbolType,
			file: validatedFile,
		},
	};
}

/**
 * Validate all inputs for a file tree operation.
 * @param inputs - File tree inputs to validate
 * @returns Combined validation result
 */
export function validateFileTreeInputs(inputs: {
	path?: string;
	subpath?: string;
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		path: string;
		subpath?: string;
	};
} {
	const errors: string[] = [];

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate subpath (relative path within repo)
	let validatedSubpath: string | undefined;
	if (inputs.subpath) {
		const trimmed = inputs.subpath.trim();
		if (trimmed.includes("..")) {
			errors.push("Subpath cannot contain path traversal sequences");
		} else {
			validatedSubpath = trimmed;
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			path: pathResult.path!,
			subpath: validatedSubpath,
		},
	};
}

/**
 * Validate all inputs for a file content operation.
 * @param inputs - File content inputs to validate
 * @returns Combined validation result
 */
export function validateFileContentInputs(inputs: {
	path?: string;
	filePaths: string[];
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		path: string;
		filePaths: string[];
	};
} {
	const errors: string[] = [];

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate file paths
	if (!inputs.filePaths || inputs.filePaths.length === 0) {
		errors.push("At least one file path is required");
	} else {
		const validatedPaths: string[] = [];
		for (const filePath of inputs.filePaths) {
			const trimmed = filePath.trim();
			if (!trimmed) {
				errors.push("File paths cannot be empty");
			} else if (trimmed.includes("..")) {
				errors.push(
					`File path "${trimmed}" cannot contain path traversal sequences`,
				);
			} else {
				validatedPaths.push(trimmed);
			}
		}

		// Check for reasonable limit
		if (validatedPaths.length > 20) {
			errors.push("Cannot request more than 20 files at once");
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			path: pathResult.path!,
			filePaths: inputs.filePaths.map((p) => p.trim()),
		},
	};
}

/**
 * Validate all inputs for a symbol usages operation.
 * @param inputs - Usages inputs to validate
 * @returns Combined validation result
 */
export function validateUsagesInputs(inputs: {
	path?: string;
	symbolName: string;
	symbolType?: string;
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		path: string;
		symbolName: string;
		symbolType?: string;
	};
} {
	const errors: string[] = [];

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate symbol name
	if (!inputs.symbolName || inputs.symbolName.trim() === "") {
		errors.push("Symbol name is required");
	}

	// Validate symbol type (optional)
	let validatedSymbolType: string | undefined;
	if (inputs.symbolType) {
		const sanitized = inputs.symbolType.trim().toLowerCase();
		const validTypes = [
			"function",
			"class",
			"variable",
			"type",
			"interface",
			"method",
			"property",
			"constant",
		];
		if (sanitized && !validTypes.includes(sanitized)) {
			errors.push(
				`Invalid symbol type: ${inputs.symbolType}. Valid types: ${validTypes.join(", ")}`,
			);
		} else {
			validatedSymbolType = sanitized || undefined;
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			path: pathResult.path!,
			symbolName: inputs.symbolName.trim(),
			symbolType: validatedSymbolType,
		},
	};
}

/**
 * Validate all inputs for an AST search operation.
 * @param inputs - AST search inputs to validate
 * @returns Combined validation result
 */
export function validateAstSearchInputs(inputs: {
	pattern: string;
	mode?: string;
	filePattern?: string;
	path?: string;
	maxResults?: number;
}): {
	valid: boolean;
	errors: string[];
	validated?: {
		pattern: string;
		mode: "simple" | "pattern";
		filePattern?: string;
		path: string;
		maxResults: number;
	};
} {
	const errors: string[] = [];

	// Validate pattern
	if (!inputs.pattern || inputs.pattern.trim() === "") {
		errors.push("Pattern cannot be empty");
	}

	// Validate mode
	const validModes = ["simple", "pattern"];
	const mode = (inputs.mode || "simple").toLowerCase();
	if (!validModes.includes(mode)) {
		errors.push(
			`Invalid mode: ${inputs.mode}. Valid modes: ${validModes.join(", ")}`,
		);
	}

	// Validate pattern mode JSON if mode is 'pattern'
	if (mode === "pattern" && inputs.pattern) {
		try {
			JSON.parse(inputs.pattern);
		} catch {
			// Allow non-JSON patterns - they'll be treated as textMatch
		}
	}

	// Validate file pattern (optional glob)
	let validatedFilePattern: string | undefined;
	if (inputs.filePattern) {
		const patternResult = validateGlob(inputs.filePattern);
		if (!patternResult.valid) {
			errors.push(`File pattern: ${patternResult.error}`);
		} else {
			validatedFilePattern = patternResult.value;
		}
	}

	// Validate path
	const pathResult = validatePath(inputs.path || getDefaultKitPath());
	if (!pathResult.valid) {
		errors.push(pathResult.error!);
	}

	// Validate maxResults
	const maxResultsResult = validatePositiveInt(inputs.maxResults, {
		name: "maxResults",
		min: 1,
		max: 500,
		defaultValue: 100,
	});
	if (!maxResultsResult.valid) {
		errors.push(maxResultsResult.error!);
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	return {
		valid: true,
		errors: [],
		validated: {
			pattern: inputs.pattern.trim(),
			mode: mode as "simple" | "pattern",
			filePattern: validatedFilePattern,
			path: pathResult.path!,
			maxResults: maxResultsResult.value!,
		},
	};
}
