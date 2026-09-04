import path from "node:path"
import { anchorSlug } from "./anchor.ts"
import type { CatalogRow, Frontmatter } from "./types.ts"

export interface ResolvableDocument {
  id?: string
  path: string
  reserved?: boolean
  frontmatter?: Frontmatter | null
  rows?: Pick<CatalogRow, "id" | "anchor" | "slug">[]
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
  const rows = new Set<string>()
  for (const document of documents) {
    if (document.reserved) continue
    const id = document.id ?? conceptId(document.path)
    for (const row of document.rows ?? []) {
      rows.add(row.slug.toLowerCase())
      register(aliases, row.id, row.slug)
    }
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
  const resolveNote = (value: string): string | null => {
    const normalized = normalize(value)
    const exactMatch = exact.get(normalized)
    if (exactMatch) return exactMatch
    const indexMatch = exact.get(`${normalized}/index`)
    if (indexMatch) return indexMatch
    const aliasMatch = aliases.get(normalized)
    if (!normalized.includes("/")) {
      const shortMatch = short.get(normalized)
      if ((aliases.has(normalized) && !aliasMatch) || (short.has(normalized) && !shortMatch)) return null
      if (aliasMatch && shortMatch && aliasMatch !== shortMatch) return null
      return aliasMatch ?? shortMatch ?? null
    }
    if (aliasMatch) return aliasMatch
    return null
  }
  return (target) => {
    const separator = String(target).indexOf("#")
    // A fragment addresses a row of that note; when no row answers to it — a heading, a
    // block reference — the target is the note itself, as it was before rows existed.
    if (separator >= 0) {
      const note = resolveNote(String(target).slice(0, separator))
      if (!note) return null
      const slug = `${note}#${anchorSlug(String(target).slice(separator + 1))}`
      return rows.has(slug.toLowerCase()) ? slug : note
    }
    return resolveNote(String(target))
  }
}
