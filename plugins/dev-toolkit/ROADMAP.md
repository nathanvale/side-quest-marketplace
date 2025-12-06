# dev-toolkit Roadmap

Development skills and tools for building, testing, and optimizing Bun CLI applications and developer experiences.

## 🚀 Phase 1: Foundation (Current)

### ✅ Completed Skills

1. **Bun CLI Development** (HIGH PRIORITY)
   - Argument parsing patterns
   - Dual output formats (markdown/JSON)
   - Error handling and exit codes
   - Subcommand architecture
   - References: BUN_CLI_STANDARD.md, CLI_REVIEW.md
   - Scripts: scaffold-cli.ts, review-cli.ts

2. **Bun Runtime Workflows**
   - bunx for one-off commands
   - Workspace monorepo patterns
   - Lockfile management
   - Fast startup optimization
   - Integration patterns (bundler, test runner, package manager)

3. **Developer Experience (DX) Patterns**
   - DX Framework: feedback loops, cognitive load, flow state
   - ADHD-friendly patterns and design
   - Measurable skill matrices for progression
   - Productivity strategies and measurement

---

## 📋 Phase 2: Advanced Skills (Planned)

### 4. TypeScript CLI Best Practices
- Type-safe argument parsing
- oclif framework patterns
- Testing strategies for CLIs
- Colored output libraries
- Scripts: TypeScript CLI template generator

### 5. MCP Server Development
- Tool naming conventions (mcp__*__* pattern)
- Error handling patterns
- Response format standardization
- Testing MCP servers
- Scripts: MCP server scaffolder, validation toolkit
- References: PLUGIN_ARCHITECTURE.md, existing MCP servers (git, kit, atuin)

### 6. Monorepo Management
- Bun workspace configuration
- Cross-plugin dependency management
- Validation strategies
- Circular dependency detection
- Scripts: Dependency graph analyzer, circular dependency detector

### 7. Test-Driven Development (TDD)
- Test organization patterns
- Mocking strategies with Bun test
- Coverage strategies and analysis
- ADHD-friendly testing approaches
- Scripts: Test generator, coverage analyzer
- References: para-obsidian test suite (51 tests)

### 8. Plugin Validation & Quality
- Pre-commit hook patterns
- CI/CD integration
- Validation engine patterns
- Quality metrics and dashboards
- References: core/src/validate/, validate-plugin hooks
- Scripts: Validation runner, quality metrics tool

### 9. Documentation Patterns
- Progressive disclosure in docs
- CLAUDE.md structure and organization
- Quick reference design
- Visual hierarchy and formatting
- Token optimization strategies
- Scripts: Documentation generator, token analyzer
- References: Refactored docs (63% token reduction)

### 10. Git Workflow Automation
- Conventional commits (feat, fix, docs, etc.)
- AI-assisted PR generation
- Git hooks and automation
- Commit message validation
- Scripts: Commit validator, PR template generator
- References: git plugin, /git:commit, /git:create-pr commands

---

## 🔮 Future Enhancements

### MCP Tools (Phase 3+)
Consider adding MCP tools to enable direct Claude integration:
- `dev_scaffold_cli` — Generate new CLI scaffolds
- `dev_review_against_standard` — Review CLI implementations against BUN_CLI_STANDARD.md
- `dev_analyze_dx` — Analyze developer experience metrics
- `dev_generate_skill` — Create new skill markdown files

### example-skills Consolidation (Phase 4+)
Evaluate consolidating development-related skills from `example-skills` plugin:
- Potential candidates: algorithmic-art, frontend-design, mcp-builder, skill-creator, theme-factory, web-artifacts-builder
- Decision: Keep separate until both plugins stabilize, then consider merging "development" category

### Community Contributions
- Welcome pull requests for additional CLI patterns
- Encourage sharing of Bun workflow optimizations
- Community-driven skill refinement and expansion

---

## 🎯 Success Metrics

- [ ] All Phase 1 skills (3) fully implemented with examples
- [ ] All Phase 2 skills (7) documented and ready for Phase 3
- [ ] 50+ developers using dev-toolkit skills
- [ ] MCP tools adoption decision made
- [ ] Marketplace validation: 100% pass rate
- [ ] Token optimization: docs < 10KB per skill

---

## 🤝 How to Contribute

1. Try a skill and provide feedback
2. Share additional CLI patterns you've discovered
3. Suggest new skill topics
4. Help refine examples and documentation

---

## 📚 Related Resources

- **BUN_CLI_STANDARD.md** — Comprehensive CLI development standard
- **CLI_REVIEW.md** — Para Obsidian reference implementation analysis
- **PLUGIN_ARCHITECTURE.md** — Plugin structure and conventions
- **BUN_RUNNER_GUIDE.md** — Test runner integration patterns
- **GIT_WORKFLOW.md** — Conventional commits and automation

---

Last updated: 2025-12-05
Next review: After Phase 1 completion
