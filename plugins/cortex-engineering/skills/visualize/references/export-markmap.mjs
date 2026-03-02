/**
 * export-markmap.mjs
 *
 * Extracts SVG and PDF from a markmap-generated HTML file using Puppeteer.
 * Injects a CSS theme file into the HTML before rendering so markmap
 * calculates node sizes with the themed font metrics.
 *
 * Usage:
 *   node export-markmap.mjs <input.html> [output-base] [--css theme.css]
 *
 * Produces:

 *   <output-base>.svg  -- standalone SVG extracted from the DOM
 *   <output-base>.pdf  -- print-ready PDF (A4 landscape)
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

// Parse args
const args = process.argv.slice(2)
let htmlPath
let outBase = 'mindmap'
let cssPath

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--css' && args[i + 1]) {
		cssPath = args[++i]
	} else if (!htmlPath) {
		htmlPath = args[i]
	} else {
		outBase = args[i]
	}
}

if (!htmlPath) {
	console.error(
		'Usage: node export-markmap.mjs <input.html> [output-base] [--css theme.css]',
	)
	process.exit(1)
}

// If CSS provided, inject it into the HTML before </head> so markmap
// renders with themed font metrics (affects node bounding box calculations)
let htmlContent = await fs.readFile(htmlPath, 'utf8')
if (cssPath) {
	const css = await fs.readFile(cssPath, 'utf8')
	const styleTag = `<style>/* cortex-theme */\n${css}\n</style>`
	htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`)
	console.log(`Injected theme CSS from ${cssPath}`)
}

// Write a temp HTML with injected styles
const tmpHtml = path.resolve(
	path.dirname(htmlPath),
	'.markmap-themed-' + path.basename(htmlPath),
)
await fs.writeFile(tmpHtml, htmlContent, 'utf8')

const absHtml = 'file://' + tmpHtml

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.goto(absHtml, { waitUntil: 'networkidle0' })

// Wait for the SVG to render (markmap uses requestAnimationFrame)
await page.waitForSelector('svg', { timeout: 10_000 })

// Give markmap time to finish D3 transitions and size calculations
await new Promise((r) => setTimeout(r, 2_000))

// Trigger a fit-to-window so markmap recalculates with themed sizes
await page.evaluate(() => {
	const mm = window.markmap
	if (mm?.fit) mm.fit()
})
await new Promise((r) => setTimeout(r, 500))

// Extract the SVG as a valid standalone file
const svgData = await page.evaluate(() => {
	const svg = document.querySelector('svg')
	const bbox = svg.getBBox()
	const padding = 16

	// Compute viewBox from the actual rendered content
	const viewBox = [
		bbox.x - padding,
		bbox.y - padding,
		bbox.width + padding * 2,
		bbox.height + padding * 2,
	].join(' ')

	// Clone the SVG so we can mutate it
	const clone = svg.cloneNode(true)

	// Add required namespaces for standalone SVG
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
	clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
	clone.setAttribute('xmlns:fo', 'http://www.w3.org/1999/xhtml')
	clone.setAttribute('viewBox', viewBox)
	clone.setAttribute('width', Math.ceil(bbox.width + padding * 2))
	clone.setAttribute('height', Math.ceil(bbox.height + padding * 2))

	// Add white background rect as first child (before all content)
	// Use explicit viewBox coordinates -- percentage-based width/height starts
	// at SVG coordinate (0,0), not the viewBox origin, leaving gaps when
	// the viewBox has negative x/y offsets.
	const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
	bgRect.setAttribute('x', String(bbox.x - padding))
	bgRect.setAttribute('y', String(bbox.y - padding))
	bgRect.setAttribute('width', String(bbox.width + padding * 2))
	bgRect.setAttribute('height', String(bbox.height + padding * 2))
	bgRect.setAttribute('fill', '#ffffff')
	clone.insertBefore(bgRect, clone.firstChild)

	// Remove markmap-specific class/style that depend on external context
	clone.removeAttribute('class')
	clone.removeAttribute('id')

	// Resolve CSS custom properties into concrete values within the style block
	const styleEl = clone.querySelector('style')
	if (styleEl) {
		const computed = window.getComputedStyle(svg)
		let cssText = styleEl.textContent
		// Replace var(--markmap-*) references with computed values
		cssText = cssText.replace(/var\(--([^)]+)\)/g, (match, varName) => {
			const val = computed.getPropertyValue('--' + varName).trim()
			return val || match
		})
		styleEl.textContent = cssText
	}

	// Typographic scale by depth (from design-system skill)
	const fontScale = {
		1: 'font-family:Inter,Helvetica,Arial,sans-serif;font-size:24px;line-height:32px;font-weight:700;color:#000;',
		2: 'font-family:Inter,Helvetica,Arial,sans-serif;font-size:20px;line-height:28px;font-weight:600;color:#000;',
		3: 'font-family:Inter,Helvetica,Arial,sans-serif;font-size:18px;line-height:24px;font-weight:500;color:#000;',
		default:
			'font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;font-weight:400;color:#000;',
	}

	// Apply inline styles to each foreignObject div -- SVG <style> CSS
	// does not reliably cross the namespace boundary into XHTML content
	for (const node of clone.querySelectorAll('.markmap-node, [data-depth]')) {
		const depth = node.getAttribute('data-depth')
		const style = fontScale[depth] || fontScale.default
		for (const div of node.querySelectorAll('foreignObject div')) {
			div.setAttribute('style', style)
			if (!div.getAttribute('xmlns')) {
				div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
			}
		}
	}

	return clone.outerHTML
})

const svgFile = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgData
await fs.writeFile(`${outBase}.svg`, svgFile, 'utf8')
console.log(
	`SVG written to ${outBase}.svg (${(svgFile.length / 1024).toFixed(1)}KB)`,
)

// Generate PDF -- A4 landscape with margins
await page.pdf({
	path: `${outBase}.pdf`,
	format: 'A4',
	landscape: true,
	printBackground: true,
	margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
})
const pdfStat = await fs.stat(`${outBase}.pdf`)
console.log(
	`PDF written to ${outBase}.pdf (${(pdfStat.size / 1024).toFixed(1)}KB)`,
)

await browser.close()

// Clean up temp file
await fs.unlink(tmpHtml).catch(() => {})
