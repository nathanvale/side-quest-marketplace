import * as readline from 'node:readline'

interface SelectOption {
  name: string
  label: string
  checked: boolean
}

export type Scope = 'project' | 'global'

/**
 * Multi-select checkbox UI for terminal.
 * Uses arrow keys to navigate, space to toggle, enter to confirm.
 *
 * @param options - Array of options to display
 * @param message - Header message to show
 * @param scope - Whether changes apply to 'project' or 'global'
 * @returns Promise resolving to selected option names
 */
export async function selectMultiple(
  options: SelectOption[],
  message: string,
  scope: Scope = 'project',
): Promise<string[]> {
  return new Promise((resolve) => {
    const state = options.map((opt) => ({ ...opt }))
    let cursor = 0
    const projectPath = process.cwd()

    // Enable raw mode for keypress detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    readline.emitKeypressEvents(process.stdin)

    const render = () => {
      // Clear screen and move to top
      process.stdout.write('\x1B[2J\x1B[H')

      // Scope indicator
      const scopeLabel = scope === 'global' ? 'GLOBAL' : 'PROJECT'
      const scopeDesc =
        scope === 'global'
          ? 'applies to all directories'
          : 'this directory only'
      console.log(`\n  Scope: ${scopeLabel} (${scopeDesc})`)
      if (scope === 'project') {
        console.log(`  Path:  ${projectPath}`)
      }
      console.log()

      console.log(`${message}\n`)
      console.log(
        '  Use ↑↓ to move, Space to toggle, Enter to confirm, a=all, n=none\n',
      )

      state.forEach((opt, i) => {
        const checkbox = opt.checked ? '[x]' : '[ ]'
        const pointer = i === cursor ? '>' : ' '
        const line = `  ${pointer} ${checkbox} ${opt.label}`
        console.log(line)
      })

      const selectedCount = state.filter((o) => o.checked).length
      console.log(`\n  ${selectedCount} enabled`)
    }

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdin.removeListener('keypress', onKeypress)
      process.stdout.write('\x1B[2J\x1B[H') // Clear screen
    }

    const onKeypress = (
      _str: string | undefined,
      key: { name: string; ctrl?: boolean },
    ) => {
      if (!key) return

      // Handle Ctrl+C
      if (key.ctrl && key.name === 'c') {
        cleanup()
        process.exit(0)
      }

      switch (key.name) {
        case 'up':
          cursor = cursor > 0 ? cursor - 1 : state.length - 1
          render()
          break

        case 'down':
          cursor = cursor < state.length - 1 ? cursor + 1 : 0
          render()
          break

        case 'space': {
          const item = state[cursor]
          if (item) {
            item.checked = !item.checked
          }
          render()
          break
        }

        case 'return':
          cleanup()
          resolve(state.filter((o) => o.checked).map((o) => o.name))
          break

        case 'a':
          // Select all
          for (const o of state) {
            o.checked = true
          }
          render()
          break

        case 'n':
          // Select none
          for (const o of state) {
            o.checked = false
          }
          render()
          break
      }
    }

    process.stdin.on('keypress', onKeypress)
    render()
  })
}

/**
 * Create options from server list with current disabled state.
 *
 * @param servers - Record of server names to McpServer configs
 * @param disabled - Set of currently disabled server names
 * @returns Array of SelectOption for the multi-select UI
 */
export function createServerOptions(
  servers: Record<string, unknown>,
  disabled: Set<string>,
): SelectOption[] {
  return Object.keys(servers)
    .sort()
    .map((name) => ({
      name,
      label: name,
      checked: disabled.has(name),
    }))
}

/**
 * Create options for enabling servers (inverted - show disabled servers to enable).
 *
 * @param servers - Record of server names to McpServer configs
 * @param disabled - Set of currently disabled server names
 * @returns Array of SelectOption for the multi-select UI
 */
export function createEnableOptions(
  servers: Record<string, unknown>,
  disabled: Set<string>,
): SelectOption[] {
  return Object.keys(servers)
    .sort()
    .map((name) => ({
      name,
      label: name,
      checked: !disabled.has(name), // Checked = enabled
    }))
}
