import path from "node:path"

function normalize(value) {
  return String(value)
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/\.md$/i, "")
    .replace(/\/$/, "")
    .toLowerCase()
}

function register(map, key, target) {
  const normalized = normalize(key)
  if (!normalized || normalized === "index") return
  if (map.has(normalized) && map.get(normalized) !== target) map.set(normalized, null)
  else if (!map.has(normalized)) map.set(normalized, target)
}

export function conceptId(filePath) {
  return String(filePath).replaceAll("\\", "/").replace(/\.md$/i, "")
}

export function buildResolver(documents) {
  const exact = new Map()
  const aliases = new Map()
  const short = new Map()
  for (const document of documents) {
    if (document.reserved) continue
    const id = document.id ?? conceptId(document.path)
    register(exact, id, id)
    const base = path.posix.basename(id)
    register(short, base, id)
    // Folder notes are addressable by both spellings regardless of pipeline:
    // the authored file form (dir/name/name) and the folder form (dir/name).
    // Site pipelines collapse the folder note into dir/name; the export keeps
    // the authored path. Registering both keeps the two graphs in parity.
    const parent = path.posix.dirname(id)
    if (parent !== "." && path.posix.basename(parent) === base) {
      register(exact, parent, id)
    }
    register(exact, `${id}/${base}`, id)
    for (const alias of Array.isArray(document.frontmatter?.aliases)
      ? document.frontmatter.aliases
      : document.frontmatter?.aliases
        ? [document.frontmatter.aliases]
        : []) {
      register(aliases, alias, id)
    }
  }
  return (target) => {
    const normalized = normalize(target)
    const exactMatch = exact.get(normalized)
    if (exactMatch) return exactMatch
    const indexMatch = exact.get(`${normalized}/index`)
    if (indexMatch) return indexMatch
    const aliasMatch = aliases.get(normalized)
    if (aliasMatch) return aliasMatch
    if (!normalized.includes("/")) return short.get(normalized) ?? null
    return null
  }
}
