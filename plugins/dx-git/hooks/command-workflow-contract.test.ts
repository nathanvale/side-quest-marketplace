import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dir, '../../..')

function readRepoFile(relPath: string): string {
	return readFileSync(path.join(repoRoot, relPath), 'utf8')
}

function getSection(content: string, heading: string): string {
	const marker = `## ${heading}`
	const start = content.indexOf(marker)
	expect(start).toBeGreaterThan(-1)

	const rest = content.slice(start + marker.length)
	const nextHeading = rest.search(/\n##\s+/)
	if (nextHeading === -1) {
		return rest
	}

	return rest.slice(0, nextHeading)
}

function getAllowedTools(content: string): string {
	const match = content.match(/^allowed-tools:\s*(.+)$/m)
	expect(match).toBeTruthy()
	return match?.[1] ?? ''
}

test('commit-push-pr frontmatter allows workflow fallback commands', () => {
	const command = readRepoFile('plugins/dx-git/commands/commit-push-pr.md')
	const allowedTools = getAllowedTools(command)

	expect(allowedTools).toContain('Bash(git config --get:*)')
	expect(allowedTools).toContain('Bash(bun run validate:*)')
})

test('Commit-Push-PR workflow checks auth before PR lookup', () => {
	const workflows = readRepoFile('plugins/dx-git/skills/workflow/references/workflows.md')
	const section = getSection(workflows, 'Commit-Push-PR')

	const authIndex = section.indexOf('gh auth status')
	const prLookupIndex = section.indexOf('gh pr list --head')

	expect(authIndex).toBeGreaterThan(-1)
	expect(prLookupIndex).toBeGreaterThan(-1)
	expect(authIndex).toBeLessThan(prLookupIndex)
	expect(section).not.toContain('| sed ')
})

test('Clean-Gone workflow uses NUL-delimited for-each-ref format', () => {
	const workflows = readRepoFile('plugins/dx-git/skills/workflow/references/workflows.md')
	const section = getSection(workflows, 'Clean-Gone')

	expect(section).toContain('%(refname:short)%00%(objectname:short)%00')
	expect(section).toContain('Use NUL (`%00`) as field delimiter')
	expect(section).not.toContain('%(refname:short)|%(objectname:short)|')
	expect(section).not.toContain('| sed ')
})
