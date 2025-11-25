import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ManifestEntry } from './types'

export class IndexGenerator {
  constructor(private outputDir: string) {}

  formatTitle(filename: string): string {
    return filename
      .replace(/\.md$/, '')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  async createIndex(files: ManifestEntry[]): Promise<void> {
    const sortedFiles = [...files].sort((a, b) =>
      a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()),
    )

    const lines = [
      '# Claude Code Documentation Index',
      '',
      'This directory contains English documentation for Claude Code pulled from https://code.claude.com/docs/en',
      '',
      '## Documentation Files',
      '',
    ]

    for (const file of sortedFiles) {
      const title = this.formatTitle(file.filename)
      lines.push(`- [${title}](${file.filename})`)
    }

    const content = `${lines.join('\n')}\n`
    const indexPath = join(this.outputDir, 'INDEX.md')
    await writeFile(indexPath, content, 'utf-8')
  }
}
