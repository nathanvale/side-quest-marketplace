import { join } from "node:path";
import { DocumentProcessor } from "./lib/document-processor";
import { FetchManager } from "./lib/fetch-manager";
import { IndexGenerator } from "./lib/index-generator";
import { ManifestManager } from "./lib/manifest-manager";
import { SitemapParser } from "./lib/sitemap-parser";
import type {
	FetchError,
	FetcherOptions,
	FetchResult,
	ManifestEntry,
} from "./lib/types";

const DEFAULT_OPTIONS = {
	sitemapUrl: "https://code.claude.com/docs/sitemap.xml",
	fetchOptions: {
		maxRetries: 3,
		baseDelay: 1000,
		maxDelay: 10000,
		rateLimit: 200,
	},
	skipValidation: false,
};

export class ClaudeDocsFetcher {
	private options: Required<FetcherOptions>;
	private manifestManager: ManifestManager;
	private fetchManager: FetchManager;
	private docProcessor: DocumentProcessor;
	private indexGenerator: IndexGenerator;
	private sitemapParser: SitemapParser;

	constructor(outputDir: string, options: FetcherOptions = {}) {
		this.options = {
			sitemapUrl: options.sitemapUrl || DEFAULT_OPTIONS.sitemapUrl,
			fetchOptions: {
				...DEFAULT_OPTIONS.fetchOptions,
				...options.fetchOptions,
			},
			skipValidation: options.skipValidation ?? DEFAULT_OPTIONS.skipValidation,
		};

		const manifestPath = join(outputDir, "manifest.json");
		this.manifestManager = new ManifestManager(manifestPath);
		this.fetchManager = new FetchManager(this.options.fetchOptions);
		this.docProcessor = new DocumentProcessor(outputDir);
		this.indexGenerator = new IndexGenerator(outputDir);
		this.sitemapParser = new SitemapParser(this.options.sitemapUrl);
	}

	async fetch(): Promise<FetchResult> {
		const startTime = Date.now();
		const errors: FetchError[] = [];
		let fetched = 0;
		let skipped = 0;
		let failed = 0;

		try {
			// Load existing manifest
			const manifest = await this.manifestManager.loadManifest();

			// Parse sitemap and get URLs
			const urls = await this.sitemapParser.parseSitemap();
			const total = urls.length;

			// Process each URL
			for (const url of urls) {
				try {
					// Fetch HTML content
					const htmlContent = await this.fetchManager.fetchWithRetry(url);

					// Convert HTML to Markdown
					const markdownContent =
						this.docProcessor.convertHtmlToMarkdown(htmlContent);

					// Validate markdown (unless skipValidation is true)
					if (!this.options.skipValidation) {
						if (!this.docProcessor.isValidMarkdown(markdownContent)) {
							errors.push({
								url,
								error: "Invalid markdown content",
							});
							failed++;
							continue;
						}
					}

					// Check if update is needed
					if (
						!this.manifestManager.needsUpdate(url, markdownContent, manifest)
					) {
						skipped++;
						continue;
					}

					// Save document
					const filename = this.docProcessor.urlToFilename(url);
					await this.docProcessor.saveDocument(url, markdownContent, filename);

					// Update manifest entry
					const entry: ManifestEntry = {
						url,
						filename,
						sha256: this.docProcessor.calculateSha256(markdownContent),
						fetched_at: new Date().toISOString(),
					};
					this.manifestManager.updateEntry(manifest, entry);

					fetched++;

					// Rate limit between requests
					await this.sleep(this.options.fetchOptions.rateLimit);
				} catch (error) {
					errors.push({
						url,
						error: (error as Error).message,
					});
					failed++;
				}
			}

			// Update manifest metadata
			manifest.metadata.last_updated = new Date().toISOString();

			// Save manifest
			await this.manifestManager.saveManifest(manifest);

			// Generate INDEX
			await this.indexGenerator.createIndex(manifest.files);

			const duration = Date.now() - startTime;

			return {
				fetched,
				skipped,
				failed,
				total,
				duration,
				errors,
			};
		} catch (error) {
			// Fatal error (e.g., sitemap fetch failed)
			throw new Error(`Fatal error during fetch: ${(error as Error).message}`);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
