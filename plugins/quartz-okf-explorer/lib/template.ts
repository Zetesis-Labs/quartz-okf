export function readPath(subject: unknown, path: string): unknown {
  return String(path)
    .split(".")
    .reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), subject)
}

/**
 * `{path}` writes the value; `{path|one|many}` writes the value and the word the number
 * asks for. Paths read the subject (`counts.Cites`, `subgraph.notes`) or a flat bag.
 */
export function fill(template: string, subject: unknown): string {
  return template.replace(/\{([^}|]+)(?:\|([^|}]*)\|([^}]*))?\}/g, (_, path: string, one?: string, many?: string) => {
    const v = readPath(subject, path.trim())
    const val = v == null ? "" : v
    if (one == null) return String(val)
    return `${val} ${Number(val) === 1 ? one : many}`
  })
}
