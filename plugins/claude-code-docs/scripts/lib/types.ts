export interface Manifest {
	metadata: ManifestMetadata;
	files: ManifestEntry[];
}

export interface ManifestMetadata {
	base_url: string;
	last_updated: string; // ISO 8601
	version: string;
}

export interface ManifestEntry {
	url: string;
	filename: string;
	sha256: string;
	fetched_at: string; // ISO 8601
}

export interface FetchOptions {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
	rateLimit: number;
}

export interface FetcherOptions {
	sitemapUrl?: string;
	fetchOptions?: FetchOptions;
	skipValidation?: boolean;
}

export interface FetchResult {
	fetched: number;
	skipped: number;
	failed: number;
	total: number;
	duration: number;
	errors: FetchError[];
}

export interface FetchError {
	url: string;
	error: string;
}

export interface SitemapXml {
	urlset: {
		url: Array<{ loc: string }>;
	};
}
