/** Branches that must never receive direct commits from hooks/agents. */
function parseProtectedBranchesEnv(): string[] {
	const raw = process.env.CLAUDE_PROTECTED_BRANCHES
	if (!raw) return []
	return raw
		.split(',')
		.map((b) => b.trim())
		.filter(Boolean)
}

const defaults = ['main', 'master']
const configured = parseProtectedBranchesEnv()
export const PROTECTED_BRANCHES: readonly string[] =
	configured.length > 0 ? configured : defaults
