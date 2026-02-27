import { defineConfig } from 'bunup'

export default defineConfig({
	entry: './src/index.ts',
	outDir: './dist',
	format: 'esm',
	// If you disable DTS generation, you must also remove the "types" field
	// and "exports['.'].types" from package.json, otherwise publint will fail
	// because it expects ./dist/index.d.ts to exist.
	dts: true,
	clean: true,
	splitting: false,
})
