/**
 * Shared constants for bun-runner hooks.
 */

/**
 * File extensions supported by Biome for linting and formatting.
 * Includes JavaScript, TypeScript, JSON, CSS, and GraphQL.
 */
export const BIOME_SUPPORTED_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.jsonc',
  '.css',
  '.graphql',
  '.gql',
]

/**
 * File extensions supported by TypeScript compiler.
 */
export const TSC_SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
