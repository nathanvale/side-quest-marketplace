#!/usr/bin/env bun
/**
 * Setup script for bun-typescript-starter template.
 *
 * Supports both CLI arguments and interactive mode:
 *
 *   # Interactive mode (prompts for all values)
 *   bun run setup
 *
 *   # CLI mode (no prompts, all flags required)
 *   bun run setup --name @scope/my-lib --description "My library" --author "Name"
 *
 *   # Mixed mode (prompts for missing values)
 *   bun run setup --name @scope/my-lib
 *
 * CLI Flags:
 *   --name, -n        Package name (e.g., @yourscope/my-lib or my-lib)
 *   --repo, -r        Repository name (defaults to package name without scope)
 *   --user, -u        GitHub username/org (defaults to gh CLI user)
 *   --description, -d Project description
 *   --author, -a      Author name
 *   --yes, -y         Skip confirmation prompts (auto-yes)
 *   --no-github       Skip GitHub repo creation/configuration
 *
 * This script:
 * 1. Prompts for project details (or uses CLI args)
 * 2. Replaces placeholders in config files
 * 3. Installs dependencies
 * 4. Creates initial commit
 * 5. Optionally creates GitHub repo with branch protection
 * 6. Prints next steps
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'

// Parse CLI arguments
const { values: args } = parseArgs({
	options: {
		name: { type: 'string', short: 'n' },
		repo: { type: 'string', short: 'r' },
		user: { type: 'string', short: 'u' },
		description: { type: 'string', short: 'd' },
		author: { type: 'string', short: 'a' },
		yes: { type: 'boolean', short: 'y', default: false },
		'no-github': { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false },
	},
	strict: true,
	allowPositionals: false,
})

if (args.help) {
	console.log(`
Usage: bun run setup [options]

Options:
  -n, --name <name>         Package name (e.g., @yourscope/my-lib)
  -r, --repo <name>         Repository name (defaults to package name)
  -u, --user <name>         GitHub username/org
  -d, --description <text>  Project description
  -a, --author <name>       Author name
  -y, --yes                 Skip confirmation prompts
  --no-github               Skip GitHub repo creation
  -h, --help                Show this help message

Examples:
  # Interactive mode
  bun run setup

  # Full CLI mode (no prompts)
  bun run setup -n @nathanvale/my-lib -d "My library" -a "Nathan Vale" -y

  # Partial CLI mode (prompts for missing values)
  bun run setup --name my-lib
`)
	process.exit(0)
}

/** Check if GitHub CLI is installed and authenticated */
function hasGitHubCLI(): boolean {
	const result = Bun.spawnSync(['gh', 'auth', 'status'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return result.exitCode === 0
}

/** Get GitHub username from gh CLI */
function getGitHubUser(): string {
	try {
		const result = Bun.spawnSync(['gh', 'api', 'user', '--jq', '.login'], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		if (result.exitCode === 0) {
			return new TextDecoder().decode(result.stdout).trim()
		}
	} catch {
		// Ignore
	}
	// Fallback to git config
	try {
		const result = Bun.spawnSync(['git', 'config', 'user.name'], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		return new TextDecoder().decode(result.stdout).trim()
	} catch {
		return ''
	}
}

/** Run a gh CLI command and return success status */
function runGh(ghArgs: string[], silent = false): boolean {
	const result = Bun.spawnSync(['gh', ...ghArgs], {
		stdout: silent ? 'pipe' : 'inherit',
		stderr: silent ? 'pipe' : 'inherit',
	})
	return result.exitCode === 0
}

/** Configure GitHub repository settings */
async function configureGitHub(
	githubUser: string,
	repoName: string,
): Promise<boolean> {
	const repo = `${githubUser}/${repoName}`
	console.log('\n🔧 Configuring GitHub repository...\n')

	// 1. Enable workflow permissions to create PRs
	console.log('  Enabling workflow permissions...')
	runGh(
		[
			'api',
			`repos/${repo}/actions/permissions/workflow`,
			'--method',
			'PUT',
			'-f',
			'default_workflow_permissions=write',
			'-F',
			'can_approve_pull_request_reviews=true',
		],
		true,
	)

	// 2. Configure repo settings (squash merge only, delete branch on merge, auto-merge)
	console.log('  Setting merge options (squash only, auto-delete branches)...')
	const repoSettings = runGh(
		[
			'api',
			`repos/${repo}`,
			'--method',
			'PATCH',
			'-f',
			'allow_squash_merge=true',
			'-f',
			'allow_merge_commit=false',
			'-f',
			'allow_rebase_merge=false',
			'-f',
			'delete_branch_on_merge=true',
			'-f',
			'allow_auto_merge=true',
		],
		true,
	)
	if (!repoSettings) {
		console.log('  ⚠️  Could not configure repo settings')
	}

	// Branch protection is deferred to `bun run setup:protect` so it doesn't
	// block subsequent pushes during initial setup (see GitHub issue #44).

	console.log('  ✅ GitHub repository configured!')
	console.log(
		'  💡 Run `bun run setup:protect` after your initial commits to enable branch protection.',
	)
	return true
}

// Readline interface for interactive prompts
let rl: ReturnType<typeof createInterface> | null = null

function getReadline(): ReturnType<typeof createInterface> {
	if (!rl) {
		rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		})
	}
	return rl
}

function closeReadline(): void {
	if (rl) {
		rl.close()
		rl = null
	}
}

/** Check if running in interactive mode (TTY available) */
const isInteractive = process.stdin.isTTY ?? false

/** Prompt for input if not provided via CLI */
async function prompt(
	message: string,
	defaultValue?: string,
	cliValue?: string,
): Promise<string> {
	// If CLI value provided, use it
	if (cliValue !== undefined) {
		return cliValue
	}

	// If not interactive (no TTY), use default value
	if (!isInteractive) {
		if (defaultValue === undefined) {
			console.error(
				`Error: --${(message.split(' ')[0] ?? '').toLowerCase()} is required in non-interactive mode`,
			)
			process.exit(1)
		}
		return defaultValue
	}

	// Otherwise prompt interactively
	const displayPrompt = defaultValue
		? `${message} [${defaultValue}]: `
		: `${message}: `

	return new Promise((resolve) => {
		getReadline().question(displayPrompt, (answer) => {
			resolve(answer.trim() || defaultValue || '')
		})
	})
}

/** Prompt for yes/no confirmation */
async function confirm(message: string, defaultYes = true): Promise<boolean> {
	if (args.yes) {
		return true
	}

	const hint = defaultYes ? '(Y/n)' : '(y/N)'
	const answer = await prompt(`${message} ${hint}`, defaultYes ? 'y' : 'n')
	return answer.toLowerCase() === 'y'
}

function replaceInFile(
	filePath: string,
	replacements: Record<string, string>,
): void {
	if (!existsSync(filePath)) {
		console.log(`  Skipping ${filePath} (not found)`)
		return
	}

	let content = readFileSync(filePath, 'utf-8')
	for (const [placeholder, value] of Object.entries(replacements)) {
		content = content.replaceAll(placeholder, value)
	}
	writeFileSync(filePath, content)
	console.log(`  Updated ${filePath}`)
}

async function run() {
	console.log('\n🚀 bun-typescript-starter Setup\n')

	// Check if already configured
	const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
	if (!packageJson.name.includes('{{')) {
		console.log('⚠️  Project appears to already be configured.')
		if (!(await confirm('Continue anyway?', false))) {
			console.log('Setup cancelled.')
			closeReadline()
			process.exit(0)
		}
	}

	// Gather information (CLI args or interactive prompts)
	const detectedUser = getGitHubUser()

	console.log('📝 Project Details\n')

	const packageName = await prompt(
		'Package name (e.g., @yourscope/my-lib or my-lib)',
		'my-lib',
		args.name,
	)

	const defaultRepoName = packageName.startsWith('@')
		? packageName.split('/')[1] || 'my-lib'
		: packageName

	const repoName = await prompt('Repository name', defaultRepoName, args.repo)

	const githubUser = await prompt(
		'GitHub username/org',
		detectedUser,
		args.user,
	)

	const description = await prompt(
		'Project description',
		'A TypeScript library',
		args.description,
	)

	const author = await prompt('Author name', detectedUser, args.author)

	// Show summary and confirm
	console.log('\n📋 Configuration Summary:\n')
	console.log(`  Package name: ${packageName}`)
	console.log(`  Repository:   ${githubUser}/${repoName}`)
	console.log(`  Description:  ${description}`)
	console.log(`  Author:       ${author}`)

	if (!(await confirm('\nProceed with setup?', true))) {
		console.log('Setup cancelled.')
		closeReadline()
		process.exit(0)
	}

	// Replace placeholders
	console.log('\n🔧 Configuring files...\n')

	const replacements: Record<string, string> = {
		'{{PACKAGE_NAME}}': packageName,
		'{{REPO_NAME}}': repoName,
		'{{GITHUB_USER}}': githubUser,
		'{{DESCRIPTION}}': description,
		'{{AUTHOR}}': author,
	}

	replaceInFile('package.json', replacements)
	replaceInFile(join('.changeset', 'config.json'), replacements)

	// Remove this setup script (one-time use)
	// NOTE: Must happen BEFORE bun install so the lockfile reflects the final
	// package.json (without the "setup" script). Otherwise CI's --frozen-lockfile
	// will detect a mismatch and fail.
	console.log('\n🧹 Removing setup script (one-time use)...')
	try {
		unlinkSync('scripts/setup.ts')
		// Update package.json to remove setup script
		const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
		delete pkg.scripts.setup
		writeFileSync('package.json', `${JSON.stringify(pkg, null, '\t')}\n`)
	} catch {
		// Ignore if can't delete
	}

	// Install dependencies (after all package.json modifications are done)
	console.log('\n📦 Installing dependencies...\n')
	const installResult = Bun.spawnSync(['bun', 'install'], {
		stdout: 'inherit',
		stderr: 'inherit',
	})

	if (installResult.exitCode !== 0) {
		console.error('❌ Failed to install dependencies')
		closeReadline()
		process.exit(1)
	}

	// Initialize git if needed
	console.log('\n🔧 Setting up git...\n')
	if (!existsSync('.git')) {
		Bun.spawnSync(['git', 'init'], { stdout: 'inherit' })
	}

	// Create initial commit
	if (await confirm('\nCreate initial commit?', true)) {
		Bun.spawnSync(['git', 'add', '.'], { stdout: 'inherit' })
		Bun.spawnSync(['git', 'commit', '-m', 'chore: initial project setup'], {
			stdout: 'inherit',
			env: { ...process.env, HUSKY: '0' },
		})
		console.log('  Created initial commit')
	}

	// GitHub setup (optional - requires gh CLI)
	let githubConfigured = false
	const skipGitHub = args['no-github']

	if (!skipGitHub && hasGitHubCLI()) {
		if (await confirm('\nCreate GitHub repo and configure settings?', true)) {
			console.log('\n🌐 Setting up GitHub repository...\n')

			// Check if repo already exists
			const repoExists = Bun.spawnSync(
				['gh', 'repo', 'view', `${githubUser}/${repoName}`],
				{ stdout: 'pipe', stderr: 'pipe' },
			)

			if (repoExists.exitCode !== 0) {
				// Create the repo
				console.log(`  Creating repository ${githubUser}/${repoName}...`)

				// Remove existing origin if present (template clones have origin set)
				Bun.spawnSync(['git', 'remote', 'remove', 'origin'], {
					stdout: 'pipe',
					stderr: 'pipe',
				})

				const createResult = Bun.spawnSync(
					[
						'gh',
						'repo',
						'create',
						`${githubUser}/${repoName}`,
						'--public',
						'--source=.',
						'--push',
						'--description',
						description,
					],
					{
						stdout: 'inherit',
						stderr: 'inherit',
						env: { ...process.env, ALLOW_PUSH_PROTECTED: '1' },
					},
				)

				if (createResult.exitCode !== 0) {
					console.log('  ⚠️  Could not create GitHub repository')
					console.log('     You can create it manually and push later.')
				} else {
					console.log('  ✅ Repository created and code pushed!')
					githubConfigured = await configureGitHub(githubUser, repoName)
				}
			} else {
				// Repo exists, just set remote and push
				console.log('  Repository already exists, pushing code...')

				// Update origin to point to the correct repo
				Bun.spawnSync(['git', 'remote', 'remove', 'origin'], {
					stdout: 'pipe',
					stderr: 'pipe',
				})
				Bun.spawnSync([
					'git',
					'remote',
					'add',
					'origin',
					`git@github.com:${githubUser}/${repoName}.git`,
				])

				const pushResult = Bun.spawnSync(
					['git', 'push', '-u', 'origin', 'main', '--force'],
					{
						stdout: 'inherit',
						stderr: 'inherit',
						env: { ...process.env, ALLOW_PUSH_PROTECTED: '1' },
					},
				)

				if (pushResult.exitCode === 0) {
					console.log('  ✅ Code pushed!')
					githubConfigured = await configureGitHub(githubUser, repoName)
				} else {
					console.log('  ⚠️  Could not push to GitHub')
				}
			}
		}
	} else if (!skipGitHub) {
		console.log(
			'\n💡 Tip: Install GitHub CLI (gh) to auto-configure repo settings',
		)
		console.log('   brew install gh && gh auth login')
	}

	// Print next steps
	console.log('\n✅ Setup complete!\n')

	const steps: string[] = []
	let stepNum = 1

	// Only show push instructions if GitHub wasn't configured
	if (!githubConfigured) {
		steps.push(`  ${stepNum}. Push to GitHub:`)
		steps.push(
			`     git remote add origin git@github.com:${githubUser}/${repoName}.git`,
		)
		steps.push('     git push -u origin main\n')
		stepNum++

		steps.push(`  ${stepNum}. Configure repo settings:`)
		steps.push(`     https://github.com/${githubUser}/${repoName}/settings`)
		steps.push('     - Allow squash merging only')
		steps.push('     - Enable "Automatically delete head branches"')
		steps.push('     - Enable "Allow auto-merge"\n')
		stepNum++

		steps.push(
			`  ${stepNum}. Enable workflow permissions (required for Changesets version PRs):`,
		)
		steps.push(
			`     https://github.com/${githubUser}/${repoName}/settings/actions`,
		)
		steps.push(
			'     - Under "Workflow permissions", select "Read and write permissions"',
		)
		steps.push(
			'     - Check "Allow GitHub Actions to create and approve pull requests"\n',
		)
		stepNum++
	}

	// Branch protection is always a separate step now
	steps.push(
		`  ${stepNum}. Enable branch protection (after all initial commits):`,
	)
	steps.push('     bun run setup:protect\n')
	stepNum++

	// NPM_TOKEN must be configured manually per-repo
	steps.push(`  ${stepNum}. For npm publishing (first time):`)
	steps.push('     # Create a granular access token at:')
	steps.push(
		`     #   https://www.npmjs.com/settings/${githubUser}/tokens/granular-access-tokens/new`,
	)
	steps.push(
		'     #   Scope to your package/org, Read+Write, check "Bypass 2FA"',
	)
	steps.push('')
	steps.push('     # Then set the secret (paste token when prompted):')
	steps.push(`     gh secret set NPM_TOKEN --repo ${githubUser}/${repoName}`)
	steps.push('')
	steps.push(
		'     # For scoped packages (@org/name), do the first publish locally:',
	)
	steps.push('     npm publish --access public --no-provenance')
	steps.push(
		'     # --no-provenance required locally (only works in GitHub Actions)',
	)
	steps.push('     # CI can handle subsequent publishes via Changesets.')
	steps.push('')
	steps.push(
		'     # After first publish, configure OIDC trusted publishing at:',
	)
	steps.push(`     #   https://www.npmjs.com/package/${packageName}/access`)
	steps.push(
		'     #   → Trusted Publisher → GitHub Actions → set repo + workflow',
	)
	steps.push('     #   Then remove NPM_TOKEN secret (OIDC handles auth)\n')
	stepNum++

	steps.push(`  ${stepNum}. Start coding:`)
	steps.push('     bun dev          # Watch mode')
	steps.push('     bun test         # Run tests')
	steps.push('     bun run build    # Build for production\n')

	console.log('📋 Next steps:\n')
	console.log(steps.join('\n'))

	closeReadline()
}

run().catch((error) => {
	console.error('Setup failed:', error)
	closeReadline()
	process.exit(1)
})
