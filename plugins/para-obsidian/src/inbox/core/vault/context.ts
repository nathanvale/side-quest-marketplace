/**
 * Vault context utilities for inbox processing.
 *
 * Provides functions to extract area and project names from the vault
 * for use in LLM classification prompts.
 *
 * @module inbox/core/vault/context
 */

import { basename, join } from "node:path";
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
