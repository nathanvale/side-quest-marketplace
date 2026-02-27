#!/usr/bin/env node
// Extract coverage metrics from an lcov.info file.
// Usage:
//   node .github/scripts/coverage-metrics.mjs [mode] [lcovPath]
// Modes:
//   outputs  -> print key=value lines for GITHUB_OUTPUT
//   summary  -> print markdown summary table for STEP SUMMARY

import fs from 'node:fs'

const mode = (process.argv[2] || 'outputs').toLowerCase()
const lcovPath = process.argv[3] || 'test-results/coverage/lcov.info'

function parseLcov(lcov) {
	const total = {
		lines: { found: 0, hit: 0 },
		branches: { found: 0, hit: 0 },
		functions: { found: 0, hit: 0 },
	}
	const records = lcov.split('end_of_record')
	for (const rec of records) {
		if (!/SF:/.test(rec)) continue
		const lf = rec.match(/LF:(\d+)/)
		const lh = rec.match(/LH:(\d+)/)
		const brf = rec.match(/BRF:(\d+)/)
		const brh = rec.match(/BRH:(\d+)/)
		const fnf = rec.match(/FNF:(\d+)/)
		const fnh = rec.match(/FNH:(\d+)/)
		if (lf) total.lines.found += +lf[1]
		if (lh) total.lines.hit += +lh[1]
		if (brf) total.branches.found += +brf[1]
		if (brh) total.branches.hit += +brh[1]
		if (fnf) total.functions.found += +fnf[1]
		if (fnh) total.functions.hit += +fnh[1]
	}
	return total
}

function pct(hit, found) {
	return found ? ((hit / found) * 100).toFixed(2) : '0.00'
}

let total
try {
	const data = fs.readFileSync(lcovPath, 'utf8')
	total = parseLcov(data)
} catch {
	total = {
		lines: { found: 0, hit: 0 },
		branches: { found: 0, hit: 0 },
		functions: { found: 0, hit: 0 },
	}
}

const linePct = pct(total.lines.hit, total.lines.found)
const branchPct = pct(total.branches.hit, total.branches.found)
const funcPct = pct(total.functions.hit, total.functions.found)

if (mode === 'summary') {
	const summary = `## Coverage Summary\n\n| Metric | % | Covered / Total |\n|---|---|---|\n| Lines | ${linePct} | ${total.lines.hit} / ${total.lines.found} |\n| Branches | ${branchPct} | ${total.branches.hit} / ${total.branches.found} |\n| Functions | ${funcPct} | ${total.functions.hit} / ${total.functions.found} |\n`
	process.stdout.write(summary)
} else {
	process.stdout.write(`coverage_lines=${linePct}\n`)
	process.stdout.write(`coverage_branches=${branchPct}\n`)
	process.stdout.write(`coverage_functions=${funcPct}\n`)
}
