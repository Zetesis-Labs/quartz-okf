// Plain JavaScript on purpose: any Node can load it, and it runs before the first
// TypeScript module is imported. A `.ts` file on an old Node fails to parse, and the
// reader would get a syntax error at an unrelated line instead of this message.
export const FLOOR = [22, 18]

export function checkFloor(version) {
  const [major = 0, minor = 0] = String(version).split(".").map(Number)
  if (major > FLOOR[0] || (major === FLOOR[0] && minor >= FLOOR[1])) return null
  return `quartz-okf needs Node >= ${FLOOR.join(".")} (found ${version}): TypeScript runs through Node's native type stripping`
}

export function enforceFloor() {
  const problem = checkFloor(process.versions.node)
  if (!problem) return
  console.error(problem)
  process.exit(1)
}
