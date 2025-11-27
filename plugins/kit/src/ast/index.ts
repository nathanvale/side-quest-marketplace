/**
 * AST Module
 *
 * Tree-sitter powered AST search for code analysis.
 * Provides pattern-based search across TypeScript, JavaScript, and Python files.
 */

// Language utilities
export {
  detectLanguage,
  getParser,
  getSupportedGlob,
  initParser,
  isSupported,
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './languages.js'
// Pattern matching
export { ASTPattern } from './pattern.js'
// Search engine
export { ASTSearcher } from './searcher.js'
// Types
export {
  AST_SEARCH_TIMEOUT,
  type ASTMatch,
  type ASTMatchContext,
  type ASTSearchOptions,
  type ASTSearchResult,
  type PatternCriteria,
  SearchMode,
} from './types.js'
