import type { FetchOptions } from './types'

export class FetchManager {
  constructor(private options: FetchOptions) {}

  async fetchWithRetry(url: string): Promise<string> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const response = await fetch(url)

        if (!response.ok) {
          // Don't retry 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            throw new Error(
              `HTTP ${response.status} ${response.statusText} for ${url}`,
            )
          }

          // Retry 5xx errors (server errors)
          lastError = new Error(
            `HTTP ${response.status} ${response.statusText} for ${url}`,
          )

          if (attempt < this.options.maxRetries) {
            const delay = this.exponentialBackoff(attempt)
            await this.sleep(delay)
            continue
          }

          throw lastError
        }

        return await response.text()
      } catch (error) {
        lastError = error as Error

        // Don't retry if it's a client error
        if (lastError.message.includes('HTTP 4')) {
          throw lastError
        }

        // Retry on network errors
        if (attempt < this.options.maxRetries) {
          const delay = this.exponentialBackoff(attempt)
          await this.sleep(delay)
          continue
        }

        throw lastError
      }
    }

    throw lastError || new Error(`Failed to fetch ${url}`)
  }

  exponentialBackoff(attempt: number): number {
    const base = this.options.baseDelay * 2 ** attempt
    const jitter = Math.random() * 1000
    return Math.min(base + jitter, this.options.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
