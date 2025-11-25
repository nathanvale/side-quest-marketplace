import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { MarkdownConverter } from './markdown-converter'

export class DocumentProcessor {
  private markdownConverter: MarkdownConverter

  constructor(private outputDir: string) {
    this.markdownConverter = new MarkdownConverter()
  }

  urlToFilename(url: string): string {
    // Match Claude Code docs pattern: /docs/en/filename or /en/docs/claude-code/filename
    const match =
      url.match(/\/docs\/en\/([^/]+)/) ||
      url.match(/\/en\/docs\/claude-code\/([^/]+)/)
    if (!match?.[1]) return 'unknown.md'

    const filename = match[1]
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/\//g, '_') // Convert slashes to underscores

    return `${filename}.md`
  }

  isValidMarkdown(content: string): boolean {
    // Check for markdown indicators
    const indicators = [
      content.includes('# '), // Headers
      content.includes('## '),
      content.includes('```'), // Code blocks
      content.includes('- '), // Lists
      content.includes('* '),
      content.includes('['), // Links
    ]

    // Should have at least 2 markdown indicators and be > 10 chars
    const count = indicators.filter((x) => x).length
    return count >= 2 && content.length > 10
  }

  calculateSha256(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  convertHtmlToMarkdown(html: string): string {
    return this.markdownConverter.convert(html)
  }

  async saveDocument(
    url: string,
    content: string,
    filename: string,
  ): Promise<void> {
    const fullPath = resolve(this.outputDir, filename)

    // Ensure path is within output directory (prevent path traversal)
    const rel = relative(this.outputDir, fullPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(
        `Invalid filename: path traversal detected for ${filename}`,
      )
    }

    // Safe to write
    await writeFile(fullPath, content, 'utf-8')
  }
}
