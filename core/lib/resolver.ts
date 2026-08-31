import path from "node:path"
import type { Frontmatter } from "./types.ts"

export interface ResolvableDocument {
  id?: string
  path: string
  reserved?: boolean
  frontmatter?: Frontmatter | null
}

export type Resolver = (target: string) => string | null

function normalize(value: string): string {
  return String(value)
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/\.md$/i, "")
    .replace(/\/$/, "")
    .toLowerCase()
}

function register(map: Map<string, string | null>, key: string, target: string): void {
  const normalized = normalize(key)
  if (!normalized || normalized === "index") return
  if (map.has(normalized) && map.get(normalized) !== target) map.set(normalized, null)
  else if (!map.has(normalized)) map.set(normalized, target)
}

export function conceptId(filePath: string): string {
  return String(filePath).replaceAll("\\", "/").replace(/\.md$/i, "")
}

function aliasesOf(document: ResolvableDocument): string[] {
  const aliases = document.frontmatter?.aliases
  if (Array.isArray(aliases)) return aliases.map(String)
  return aliases ? [String(aliases)] : []
}

export function buildResolver(documents: ResolvableDocument[]): Resolver {
  const exact = new Map<string, string | null>()
  const aliases = new Map<string, string | null>()
  const short = new Map<string, string | null>()
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
    for (const alias of aliasesOf(document)) register(aliases, alias, id)
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
