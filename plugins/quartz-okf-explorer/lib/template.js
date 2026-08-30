export function readPath(subject, path) {
  return String(path)
    .split(".")
    .reduce((o, k) => (o == null ? o : o[k]), subject)
}

/**
 * `{path}` writes the value; `{path|one|many}` writes the value and the word the number
 * asks for. Paths read the subject (`counts.Cites`, `subgraph.notes`) or a flat bag.
 */
export function fill(template, subject) {
  return template.replace(/\{([^}|]+)(?:\|([^|}]*)\|([^}]*))?\}/g, (_, path, one, many) => {
    const v = readPath(subject, path.trim())
    const val = v == null ? "" : v
    if (one == null) return String(val)
    return `${val} ${Number(val) === 1 ? one : many}`
  })
}
