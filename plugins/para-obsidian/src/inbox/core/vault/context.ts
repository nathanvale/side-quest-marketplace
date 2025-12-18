/**
 * Vault context utilities for inbox processing.
 *
 * Provides functions to extract area and project names from the vault
 * for use in LLM classification prompts.
 *
 * @module inbox/core/vault/context
 */

import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";
import { globFilesSync } from "@sidequest/core/glob";
import { DEFAULT_PARA_FOLDERS } from "../../../config/defaults";

/**
 * Vault context for LLM classification.
 */
export interface VaultContext {
	/** List of area names in the vault */
	readonly areas: string[];
	/** List of project names in the vault */
	readonly projects: string[];
}

/**
 * Get list of areas from vault (recursive scan for all .md files).
 *
 * Uses config.paraFolders to determine the areas folder path.
 * Falls back to DEFAULT_PARA_FOLDERS if not configured.
 *
 * @param vaultPath - Absolute path to vault root
 * @param paraFolders - PARA folder mappings from config (optional)
 * @returns Array of area names (without .md extension)
 *
 * @example
 * // With config: "02 Areas/Psychotherapy/Psychotherapy.md" -> "Psychotherapy"
 */
export function getVaultAreas(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): string[] {
	const folders = paraFolders ?? DEFAULT_PARA_FOLDERS;
	const areasFolder = folders.areas ?? DEFAULT_PARA_FOLDERS.areas ?? "02 Areas";
	const areasPath = join(vaultPath, areasFolder);
	try {
		const files = globFilesSync("**/*.md", { cwd: areasPath, absolute: false });
		const areas = files.map((file) => basename(file, ".md"));
		return [...new Set(areas)]; // Dedupe in case of same-named notes
	} catch {
		return [];
	}
}

/**
 * Get list of projects from vault (recursive scan for all .md files).
 *
 * Uses config.paraFolders to determine the projects folder path.
 * Falls back to DEFAULT_PARA_FOLDERS if not configured.
 *
 * @param vaultPath - Absolute path to vault root
 * @param paraFolders - PARA folder mappings from config (optional)
 * @returns Array of project names (without .md extension)
 *
 * @example
 * // With config: "01 Projects/Work/Build Garden Shed.md" -> "Build Garden Shed"
 */
export function getVaultProjects(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): string[] {
	const folders = paraFolders ?? DEFAULT_PARA_FOLDERS;
	const projectsFolder =
		folders.projects ?? DEFAULT_PARA_FOLDERS.projects ?? "01 Projects";
	const projectsPath = join(vaultPath, projectsFolder);
	try {
		const files = globFilesSync("**/*.md", {
			cwd: projectsPath,
			absolute: false,
		});
		const projects = files.map((file) => basename(file, ".md"));
		return [...new Set(projects)]; // Dedupe in case of same-named notes
	} catch {
		return [];
	}
}

/**
 * Build vault context for LLM classification.
 *
 * @param vaultPath - Absolute path to vault root
 * @param paraFolders - PARA folder mappings from config (optional)
 * @returns Vault context with areas and projects
 */
export function buildVaultContext(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): VaultContext {
	return {
		areas: getVaultAreas(vaultPath, paraFolders),
		projects: getVaultProjects(vaultPath, paraFolders),
	};
}

/**
 * Build case-insensitive map of area names to full PARA paths.
 * Keys are lowercased for case-insensitive lookup.
 * Handles duplicates by removing them (require full path disambiguation).
 *
 * @param vaultPath - Path to the vault root
 * @param paraFolders - PARA folder configuration
 * @returns Map of lowercase area name → full path (e.g., "health" → "02 Areas/Health")
 *
 * @example
 * const map = getAreaPathMap("/vault", { areas: "02 Areas" });
 * map.get("health");  // "02 Areas/Health"
 * map.get("HEALTH");  // undefined (must lowercase first)
 */
export function getAreaPathMap(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): Map<string, string> {
	const areasFolder = paraFolders?.areas ?? "02 Areas";
	const areasPath = join(vaultPath, areasFolder);

	if (!pathExistsSync(areasPath)) {
		return new Map();
	}

	const entries = readdirSync(areasPath, { withFileTypes: true });
	const map = new Map<string, string>();
	const duplicates = new Set<string>();

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const key = entry.name.toLowerCase();
			if (map.has(key)) {
				duplicates.add(key);
			}
			map.set(key, `${areasFolder}/${entry.name}`);
		}
	}

	// Remove duplicates - require full path for ambiguous names
	for (const dup of duplicates) {
		map.delete(dup);
	}

	return map;
}

/**
 * Build case-insensitive map of project names to full PARA paths.
 * Keys are lowercased for case-insensitive lookup.
 * Handles duplicates by removing them (require full path disambiguation).
 *
 * @param vaultPath - Path to the vault root
 * @param paraFolders - PARA folder configuration
 * @returns Map of lowercase project name → full path (e.g., "tax 2024" → "01 Projects/Tax 2024")
 *
 * @example
 * const map = getProjectPathMap("/vault", { projects: "01 Projects" });
 * map.get("tax 2024");  // "01 Projects/Tax 2024"
 * map.get("TAX 2024");  // undefined (must lowercase first)
 */
export function getProjectPathMap(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): Map<string, string> {
	const projectsFolder = paraFolders?.projects ?? "01 Projects";
	const projectsPath = join(vaultPath, projectsFolder);

	if (!pathExistsSync(projectsPath)) {
		return new Map();
	}

	const entries = readdirSync(projectsPath, { withFileTypes: true });
	const map = new Map<string, string>();
	const duplicates = new Set<string>();

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const key = entry.name.toLowerCase();
			if (map.has(key)) {
				duplicates.add(key);
			}
			map.set(key, `${projectsFolder}/${entry.name}`);
		}
	}

	// Remove duplicates - require full path for ambiguous names
	for (const dup of duplicates) {
		map.delete(dup);
	}

	return map;
}
