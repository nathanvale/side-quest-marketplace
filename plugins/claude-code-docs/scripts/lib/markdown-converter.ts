import * as cheerio from 'cheerio'
import TurndownService from 'turndown'

// Type for DOM elements used in TurndownService callbacks
interface DOMElement {
  nodeName?: string
  nodeType?: number
  textContent?: string | null
  firstChild?: DOMElement | null
  childNodes?: DOMElement[]
  getAttribute?(name: string): string | null
  querySelectorAll?(selector: string): DOMElement[]
}

export class MarkdownConverter {
  private turndownService: TurndownService

  constructor() {
    // Initialize Turndown with proper configuration
    this.turndownService = new TurndownService({
      headingStyle: 'setext', // Use === and --- style for h1/h2
      codeBlockStyle: 'fenced', // Use ``` for code blocks
      fence: '```', // Fence character
      emDelimiter: '*', // Use * for emphasis
      strongDelimiter: '**', // Use ** for strong
      linkStyle: 'inlined', // Inline links [text](url)
      bulletListMarker: '-', // Use - for bullet lists
    })

    // Add custom rule for code blocks with language hints
    this.turndownService.addRule('fencedCodeBlock', {
      filter: (node, options) => {
        return (
          options.codeBlockStyle === 'fenced' &&
          node.nodeName === 'PRE' &&
          node.firstChild?.nodeName === 'CODE'
        )
      },
      replacement: (_content, node) => {
        const codeElement = node.firstChild as DOMElement
        const className = codeElement?.getAttribute?.('class') || ''
        const language = className.match(/language-(\w+)/)?.[1] || ''

        // Get the actual code content
        const code = (codeElement?.textContent || '').replace(/\n$/, '')

        return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`
      },
    })

    // Add custom rule for blockquotes to fix trailing space issue
    this.turndownService.addRule('blockquote', {
      filter: 'blockquote',
      replacement: (content) => {
        // Remove trailing newlines from content
        const trimmedContent = content.trim()
        // Split by newlines and prefix each line with >
        const lines = trimmedContent.split('\n')
        const quotedLines = lines.map((line) => {
          // If line is empty, just return ">"
          if (line.trim() === '') {
            return '>'
          }
          // Unescape dashes that turndown escaped (inside blockquotes, dashes don't need escaping)
          const unescapedLine = line.replace(/^(\s*)\\-\s/, '$1- ')
          // Otherwise return "> " + line
          return `> ${unescapedLine}`
        })
        return `\n\n${quotedLines.join('\n')}\n\n`
      },
    })

    // Add custom rule for nav.page-toc to convert links to plain text
    this.turndownService.addRule('pageTocLinks', {
      filter: (node) => {
        // Only apply to anchor tags inside nav.page-toc
        if (node.nodeName !== 'A') return false
        let parent = node.parentElement
        while (parent) {
          if (
            parent.nodeName === 'NAV' &&
            (parent.classList.contains('page-toc') ||
              parent.classList.contains('toc'))
          ) {
            return true
          }
          parent = parent.parentElement
        }
        return false
      },
      replacement: (content) => {
        // Return just the text content without link markup
        return content
      },
    })

    // Add custom rule for tables
    this.turndownService.addRule('table', {
      filter: 'table',
      replacement: (_content, node, _options) => {
        const table = node as DOMElement
        const rows: string[][] = []

        // Helper function to escape HTML entities in text
        const escapeHtml = (text: string): string => {
          return text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
        }

        // Extract all rows from thead and tbody
        const theadRows = table.querySelectorAll?.('thead tr') ?? []
        const tbodyRows = table.querySelectorAll?.('tbody tr') ?? []
        const allRows = [...theadRows, ...tbodyRows]

        // Build rows array - convert HTML in cells to markdown
        for (const row of allRows) {
          const cells: string[] = []
          const cellElements =
            (row as DOMElement).querySelectorAll?.('th, td') ?? []
          for (const cell of cellElements) {
            const cellElem = cell as DOMElement
            // Convert inline code elements to markdown backticks
            let cellContent = ''
            const childNodes = cellElem.childNodes ?? []
            for (const childNode of childNodes) {
              if (childNode.nodeName === 'CODE') {
                const codeText = escapeHtml(
                  (childNode.textContent || '').trim(),
                )
                cellContent += `\`${codeText}\``
              } else if (childNode.nodeType === 3) {
                // Text node
                cellContent += escapeHtml(childNode.textContent || '')
              } else if (
                childNode.nodeName === 'STRONG' ||
                childNode.nodeName === 'B'
              ) {
                const boldText = escapeHtml(
                  (childNode.textContent || '').trim(),
                )
                cellContent += `**${boldText}**`
              } else if (
                childNode.nodeName === 'EM' ||
                childNode.nodeName === 'I'
              ) {
                const italicText = escapeHtml(
                  (childNode.textContent || '').trim(),
                )
                cellContent += `*${italicText}*`
              } else {
                cellContent += escapeHtml(childNode.textContent || '')
              }
            }
            cells.push(cellContent.trim())
          }
          rows.push(cells)
        }

        if (rows.length === 0) {
          return ''
        }

        // Build markdown table
        const result: string[] = []

        // Header row
        const headerRow = rows[0]
        if (!headerRow) return ''
        result.push(`| ${headerRow.join(' | ')} |`)

        // Separator row
        const separators = headerRow.map(() => '---')
        result.push(`| ${separators.join(' | ')} |`)

        // Data rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (row) {
            result.push(`| ${row.join(' | ')} |`)
          }
        }

        return `\n\n${result.join('\n')}\n\n`
      },
    })
  }

  extractMainContent(html: string): string {
    // Handle empty or invalid input
    if (!html || typeof html !== 'string' || html.trim() === '') {
      return ''
    }

    try {
      const $ = cheerio.load(html)

      // Try to find main content in order of priority
      let content = $('main')
      if (content.length === 0) {
        content = $('article')
      }
      if (content.length === 0) {
        content = $('[id="content-area"]')
      }
      if (content.length === 0) {
        // Fallback to body, but still remove unwanted elements
        content = $('body')
      }

      // Remove unwanted elements from the extracted content (not entire document)
      content.find('script').remove()
      content.find('style').remove()
      // Remove nav/header/footer/aside that are NOT children of main content
      // Keep nav elements that are inside the main content (like TOC)
      content.find('nav').not('.page-toc, .toc, [role="navigation"]').remove()
      content.find('header').not('.article-header, .page-header').remove()
      content.find('footer').not('.article-footer').remove()
      content.find('aside').not('.article-aside').remove()

      // Get the HTML content
      const extracted = content.html()

      // Return empty string if no content found
      if (!extracted || extracted.trim() === '') {
        return ''
      }

      // Check if the extracted content is just escaped HTML (invalid HTML case)
      // If cheerio escaped the entire thing, it's probably invalid
      const trimmed = extracted.trim()
      if (trimmed.startsWith('&lt;') && trimmed.endsWith('&gt;')) {
        return ''
      }

      return trimmed
    } catch (_error) {
      // Return empty string for invalid HTML
      return ''
    }
  }

  convertToMarkdown(html: string): string {
    // Handle empty or whitespace-only content
    if (!html || typeof html !== 'string' || html.trim() === '') {
      return ''
    }

    try {
      const markdown = this.turndownService.turndown(html)
      return markdown.trim()
    } catch (_error) {
      return ''
    }
  }

  cleanupMarkdown(markdown: string): string {
    // Handle empty input
    if (!markdown || typeof markdown !== 'string') {
      return ''
    }

    let cleaned = markdown

    // Normalize line endings (CRLF → LF)
    cleaned = cleaned.replace(/\r\n/g, '\n')

    // Rewrite internal documentation links from /docs/en/foo to relative foo.md
    // Handles: [text](/docs/en/foo) → [text](foo.md)
    // Handles: [text](/docs/en/foo#anchor) → [text](foo.md#anchor)
    cleaned = cleaned.replace(
      /\]\(\/docs\/en\/([^)#]+)(#[^)]*)?\)/g,
      (_, slug, anchor) => `](${slug}.md${anchor || ''})`,
    )

    // Convert setext-style headers to ATX-style headers
    // h1: Text\n==== → # Text
    cleaned = cleaned.replace(/^(.+)\n=+[ \t]*$/gm, '# $1')
    // h2: Text\n---- → ## Text
    cleaned = cleaned.replace(/^(.+)\n-+[ \t]*$/gm, '## $1')

    // Remove HTML comments (including multi-line)
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

    // Remove script and style tags with their content
    cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')

    // Extract code blocks and inline code to preserve them completely
    const codeBlocks: string[] = []
    const CODE_BLOCK_PLACEHOLDER = '___CODE_BLOCK_PLACEHOLDER___'
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match)
      return `${CODE_BLOCK_PLACEHOLDER}${codeBlocks.length - 1}${CODE_BLOCK_PLACEHOLDER}`
    })

    const inlineCode: string[] = []
    const INLINE_CODE_PLACEHOLDER = '___INLINE_CODE_PLACEHOLDER___'
    cleaned = cleaned.replace(/`[^`\n]+`/g, (match) => {
      inlineCode.push(match)
      return `${INLINE_CODE_PLACEHOLDER}${inlineCode.length - 1}${INLINE_CODE_PLACEHOLDER}`
    })

    // Remove HTML tags
    cleaned = this.removeHtmlTags(cleaned)

    // Fix broken markdown syntax
    // Fix headers without space after # (but not when next char is also #)
    cleaned = cleaned.replace(/^(#{1,6})([^#\s])/gm, '$1 $2')

    // Fix broken links
    // Pattern 1: [text](url without closing ) → [text](url)
    // Use [ \t]* instead of \s* to avoid consuming newlines
    cleaned = cleaned.replace(
      /\[([^\]]+)\]\(([^)\s]+)[ \t]*$/gm,
      (match, text, url) => {
        // Check if url already has closing paren
        if (url.endsWith(')')) {
          return match
        }
        return `[${text}](${url})`
      },
    )

    // Pattern 2: [text(url without ] and ) → [text](url)
    // This handles cases like [Link without closing paren(https://example.com
    // Use [ \t]* instead of \s* to avoid consuming newlines
    cleaned = cleaned.replace(
      /\[([^[\]]+)\(([^)\s]+)[ \t]*$/gm,
      (_match, text, url) => {
        // Only fix if this looks like a broken link (no ] before ()
        return `[${text}](${url})`
      },
    )

    // Fix unclosed bold and italic
    // Process line by line to fix unmatched formatting
    cleaned = cleaned
      .split('\n')
      .map((line) => {
        // Skip placeholders and code blocks
        if (line.includes(CODE_BLOCK_PLACEHOLDER)) {
          return line
        }

        // Skip list items - must have space after the marker
        if (/^\s*[*+-]\s+/.test(line)) {
          return line
        }

        let result = line

        // Parse and fix bold/italic markers
        const parts: string[] = []
        let i = 0
        let boldOpen = false
        let italicOpen = false

        while (i < result.length) {
          const char = result[i]
          const nextChar = result[i + 1]

          // Check for **
          if (char === '*' && nextChar === '*') {
            parts.push('**')
            boldOpen = !boldOpen
            i += 2
            continue
          }
          // Check for single *
          if (char === '*') {
            parts.push('*')
            italicOpen = !italicOpen
            i++
            continue
          }
          if (char !== undefined) {
            parts.push(char)
          }
          i++
        }

        // Close any unclosed markers at end of line
        if (boldOpen) {
          parts.push('**')
        }
        if (italicOpen) {
          parts.push('*')
        }

        result = parts.join('')

        return result
      })
      .join('\n')

    // Fix list items without space after marker
    // Run this AFTER bold/italic fix to avoid treating *italic* as *list
    cleaned = cleaned.replace(/^(\s*)([-+])(\S)/gm, '$1$2 $3') // - or + lists
    // For * marker, we need to be more careful to not match italic/bold text
    cleaned = cleaned
      .split('\n')
      .map((line) => {
        // Check if line starts with * but no space
        const match = line.match(/^(\s*)(\*)(\S.*)$/)
        if (!match) {
          return line
        }
        const [, spaces = '', marker = '', rest = ''] = match
        // Don't fix if next char is also * (bold)
        if (rest.startsWith('*')) {
          return line
        }
        // Don't fix if line ends with * (italic)
        if (rest.endsWith('*') && !rest.endsWith('**')) {
          return line
        }
        // This is likely a list item, add space
        return `${spaces}${marker} ${rest}`
      })
      .join('\n')
    cleaned = cleaned.replace(/^(\s*)(\d+\.)(\S)/gm, '$1$2 $3')

    // Fix list items with extra spaces after marker
    cleaned = cleaned.replace(/^(\s*)([-*+])\s{2,}/gm, '$1$2 ')
    cleaned = cleaned.replace(/^(\s*)(\d+\.)\s{2,}/gm, '$1$2 ')

    // Trim trailing whitespace from each line (except placeholder lines)
    cleaned = cleaned
      .split('\n')
      .map((line) => {
        if (line.includes(CODE_BLOCK_PLACEHOLDER)) {
          return line
        }
        return line.trimEnd()
      })
      .join('\n')

    // Ensure proper spacing around headers - do this BEFORE removing excessive newlines
    // - Headers should have 1 blank line before (except first header)
    // - All headers normalize blank lines after them: if blank lines present, reduce to exactly 1
    const lines = cleaned.split('\n')
    const result: string[] = []
    let headerCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line === undefined) continue

      const trimmedLine = line.trim()

      // Check if this is a header line (ATX style with #)
      const isAtxHeader = /^#{1,6}\s/.test(trimmedLine)

      // For ATX headers, add blank line before if needed
      if (isAtxHeader) {
        headerCount++
        if (result.length > 0 && headerCount > 1) {
          // Add blank line before header (except first) if previous line is not blank
          const prevLine = result[result.length - 1]
          if (prevLine !== undefined && prevLine.trim() !== '') {
            result.push('')
          }
        }
      }

      result.push(line)

      // Handle blank lines after headers
      if (isAtxHeader && i < lines.length - 1) {
        const nextIdx = i + 1
        const nextLine = lines[nextIdx]

        // Check if next line is blank
        if (nextLine?.trim() === '') {
          // Skip any consecutive blank lines and normalize to exactly 1
          let skipCount = 0
          let j = nextIdx
          while (j < lines.length && lines[j]?.trim() === '') {
            skipCount++
            j++
          }

          // Normalize: skip all blanks and add exactly 1 back
          i += skipCount
          result.push('')
        }
        // If no blank line after header, don't add one
      }
    }

    cleaned = result.join('\n')

    // Remove excessive newlines (more than 2 consecutive → exactly 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

    // Restore code blocks
    cleaned = cleaned.replace(
      new RegExp(
        `${CODE_BLOCK_PLACEHOLDER}(\\d+)${CODE_BLOCK_PLACEHOLDER}`,
        'g',
      ),
      (_, index) => codeBlocks[Number.parseInt(index, 10)] ?? '',
    )

    // Restore inline code
    cleaned = cleaned.replace(
      new RegExp(
        `${INLINE_CODE_PLACEHOLDER}(\\d+)${INLINE_CODE_PLACEHOLDER}`,
        'g',
      ),
      (_, index) => inlineCode[Number.parseInt(index, 10)] ?? '',
    )

    // Final trim
    cleaned = cleaned.trim()

    return cleaned
  }

  private removeHtmlTags(text: string): string {
    // Remove HTML tags but preserve their content
    return text.replace(/<[^>]+>/g, '')
  }

  convert(html: string): string {
    // Full pipeline: extract → convert → cleanup
    const extracted = this.extractMainContent(html)
    if (!extracted) {
      return ''
    }

    const markdown = this.convertToMarkdown(extracted)
    if (!markdown) {
      return ''
    }

    return this.cleanupMarkdown(markdown)
  }
}
