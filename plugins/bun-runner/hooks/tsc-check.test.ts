import { describe, expect, test } from 'bun:test'
import { parseTscOutput } from './tsc-check'

describe('parseTscOutput', () => {
  test('parses single error correctly', () => {
    const output = `src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`

    const result = parseTscOutput(output)

    expect(result.errorCount).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({
      file: 'src/index.ts',
      line: 10,
      col: 5,
      message: "Type 'string' is not assignable to type 'number'.",
    })
  })

  test('parses multiple errors correctly', () => {
    const output = `src/utils.ts(5,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/utils.ts(12,3): error TS2304: Cannot find name 'foo'.
src/index.ts(1,1): error TS2307: Cannot find module './missing'.`

    const result = parseTscOutput(output)

    expect(result.errorCount).toBe(3)
    expect(result.errors).toHaveLength(3)
    expect(result.errors[0]?.file).toBe('src/utils.ts')
    expect(result.errors[0]?.line).toBe(5)
    expect(result.errors[1]?.file).toBe('src/utils.ts')
    expect(result.errors[1]?.line).toBe(12)
    expect(result.errors[2]?.file).toBe('src/index.ts')
  })

  test('handles empty output', () => {
    const result = parseTscOutput('')

    expect(result.errorCount).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  test('handles output with no errors', () => {
    const output = `Some random output
that is not an error
just informational text`

    const result = parseTscOutput(output)

    expect(result.errorCount).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  test('handles Windows-style paths', () => {
    const output = `C:\\Users\\dev\\project\\src\\index.ts(5,10): error TS2322: Type error.`

    const result = parseTscOutput(output)

    expect(result.errorCount).toBe(1)
    expect(result.errors[0]?.file).toBe('C:\\Users\\dev\\project\\src\\index.ts')
  })

  test('parses errors with complex messages', () => {
    const output = `src/types.ts(15,3): error TS2739: Type '{ name: string; }' is missing the following properties from type 'User': id, email, createdAt`

    const result = parseTscOutput(output)

    expect(result.errorCount).toBe(1)
    expect(result.errors[0]?.message).toBe(
      "Type '{ name: string; }' is missing the following properties from type 'User': id, email, createdAt",
    )
  })

  test('ignores warning lines', () => {
    // TSC doesn't output warnings in this format, but ensure we only match errors
    const output = `src/index.ts(10,5): error TS2322: This is an error.
src/index.ts(20,5): warning TS6789: This would be a warning if TSC had them.`

    const result = parseTscOutput(output)

    expect(result.errorCount).toBe(1)
    expect(result.errors[0]?.line).toBe(10)
  })
})
