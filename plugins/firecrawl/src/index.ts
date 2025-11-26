/**
 * Firecrawl Plugin
 *
 * Firecrawl plugin for Claude Code
 */

export interface FirecrawlResult {
  success: boolean
  message: string
}

/**
 * Sample function demonstrating plugin functionality.
 * @param input - Input to process
 * @returns Result object with success status and message
 */
export function processFirecrawl(input: string): FirecrawlResult {
  return {
    success: true,
    message: `Processed: ${input}`,
  }
}
