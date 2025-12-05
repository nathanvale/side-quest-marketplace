import { readTextFile, sha256, writeTextFile } from "@sidequest/core/fs";
import type { Manifest, ManifestEntry } from "./types";

export class ManifestManager {
	constructor(private manifestPath: string) {}

	async loadManifest(): Promise<Manifest> {
		try {
			const content = await readTextFile(this.manifestPath);
			return JSON.parse(content);
		} catch {
			// File doesn't exist or is corrupted, return new manifest
			return this.createEmptyManifest();
		}
	}

	async saveManifest(manifest: Manifest): Promise<void> {
		const content = JSON.stringify(manifest, null, 2);
		await writeTextFile(this.manifestPath, content);
	}

	needsUpdate(url: string, content: string, manifest: Manifest): boolean {
		const existing = manifest.files.find((f) => f.url === url);
		if (!existing) return true; // New file

		const newHash = this.calculateSha256(content);
		return existing.sha256 !== newHash; // Content changed
	}

	updateEntry(manifest: Manifest, entry: ManifestEntry): void {
		const existingIndex = manifest.files.findIndex((f) => f.url === entry.url);

		if (existingIndex >= 0) {
			// Update existing entry
			manifest.files[existingIndex] = entry;
		} else {
			// Add new entry
			manifest.files.push(entry);
		}
	}

	calculateSha256(content: string): string {
		return sha256(content);
	}

	private createEmptyManifest(): Manifest {
		return {
			metadata: {
				base_url: "https://code.claude.com/docs/en",
				last_updated: new Date().toISOString(),
				version: "1.0.0",
			},
			files: [],
		};
	}
}
