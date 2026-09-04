import { anchorSlug } from "./anchor.ts"
import { fencedLineMask, markdownLinkTarget, wikilinkRefs } from "./topology.ts"
import type { CatalogAnnotation, CatalogProblem, CatalogRow, TopologyEdge } from "./types.ts"

// A row belongs to the page that holds its table; the label for that is the one the
// reference profile already gives a consumer, and it is validated against its own
// `edgeLabels` — the engine still ships no vocabulary of its own.
const CONTAINMENT_EDGE = "Part of"

const MARKER_RE = /^\s*<!--\s*okf:rows\b(.*?)-->\s*$/
const KEY_RE = /([A-Za-z_][\w-]*)=(?:"([^"]*)"|([^\s;]+))/g
const CLAUSE_RE = /^\s*([^:=]+?)\s*:\s*(.+?)\s*$/
const TABLE_DIVIDER_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/
const CELL_SPLIT_RE = /(?<!\\)\|/

export interface MarkerDeclaration {
  keys: Record<string, string>
  clauses: TopologyEdge[]
  /** Segments that are neither a key nor a clause: never dropped in silence. */
  unparsed: string[]
}

export interface FoundCatalog {
  marker: MarkerDeclaration
  header: string[]
  rows: string[][]
  /** 1-based position among every table of the note, so a renderer can find it again. */
  index: number
  line: number
}

export interface FoundCatalogs {
  catalogs: FoundCatalog[]
  problems: CatalogProblem[]
  tables: number
}

export interface CatalogOptions {
  /** Note-level defaults, from the frontmatter's `okf_rows`. */
  defaults?: Record<string, string>
  /** The profile's labels: a column named after one of them declares edges. */
  edgeLabels?: readonly string[]
  /** Anchors the note's headings already took. */
  headingAnchors?: readonly string[]
}

export interface CatalogResult {
  rows: CatalogRow[]
  annotations: CatalogAnnotation[]
  problems: CatalogProblem[]
  tables: number
}

export interface CatalogSource {
  id: string
  body: string
}

/** Splits on `;`, except inside a quoted value — a pattern may hold one. */
function splitSegments(declaration: string): string[] {
  const segments: string[] = []
  let current = ""
  let quoted = false
  for (const character of declaration) {
    if (character === '"') quoted = !quoted
    if (character === ";" && !quoted) {
      segments.push(current)
      current = ""
      continue
    }
    current += character
  }
  segments.push(current)
  return segments
}

export function parseMarker(line: string): MarkerDeclaration | null {
  const match = line.match(MARKER_RE)
  if (!match) return null
  const keys: Record<string, string> = {}
  const clauses: TopologyEdge[] = []
  const unparsed: string[] = []
  for (const segment of splitSegments(match[1])) {
    const pairs = [...segment.matchAll(KEY_RE)]
    if (pairs.length > 0) {
      for (const pair of pairs) keys[pair[1]] = pair[2] ?? pair[3]
      continue
    }
    const clause = segment.match(CLAUSE_RE)
    if (clause) {
      for (const target of cellTargets(clause[2])) {
        clauses.push({ label: clause[1].trim(), target, alias: undefined })
      }
      continue
    }
    if (segment.trim() !== "") unparsed.push(segment.trim())
  }
  return { keys, clauses, unparsed }
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  return trimmed.split(CELL_SPLIT_RE).map((cell) => cell.trim())
}

const isTableLine = (line: string): boolean => /^\s*\|/.test(line)

export function findCatalogs(body: string): FoundCatalogs {
  const lines = body.replaceAll("\r\n", "\n").split("\n")
  const fenced = fencedLineMask(lines)
  const catalogs: FoundCatalog[] = []
  const problems: CatalogProblem[] = []
  let tables = 0
  let pending: { marker: MarkerDeclaration; line: number } | null = null

  for (let index = 0; index < lines.length; index += 1) {
    if (fenced[index]) continue
    const line = lines[index]
    const marker = parseMarker(line)
    if (marker) {
      if (pending) problems.push(missingTable(pending.line))
      pending = { marker, line: index + 1 }
      continue
    }
    if (isTableLine(line) && !fenced[index + 1] && TABLE_DIVIDER_RE.test(lines[index + 1] ?? "")) {
      tables += 1
      const header = splitRow(line)
      const rows: string[][] = []
      let cursor = index + 2
      while (cursor < lines.length && !fenced[cursor] && isTableLine(lines[cursor])) {
        rows.push(splitRow(lines[cursor]))
        cursor += 1
      }
      if (pending) catalogs.push({ marker: pending.marker, header, rows, index: tables, line: pending.line })
      pending = null
      index = cursor - 1
      continue
    }
    if (pending && line.trim() !== "") {
      problems.push(missingTable(pending.line))
      pending = null
    }
  }
  if (pending) problems.push(missingTable(pending.line))
  return { catalogs, problems, tables }
}

function missingTable(line: number): CatalogProblem {
  return { code: "catalog/table-missing", message: `line ${line}: a rows marker with no table under it` }
}

export function cellText(cell: string): string {
  return String(cell)
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_all, target: string, alias?: string) =>
      (alias ?? target).trim(),
    )
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replaceAll("\\|", "|")
    .trim()
}

export function cellTargets(cell: string): string[] {
  const wikilinks = wikilinkRefs(cell)
  if (wikilinks.length > 0) return wikilinks.map((link) => link.target)
  const links = [...cell.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)]
    .map((match) => markdownLinkTarget(match[2]))
    .filter((target): target is string => Boolean(target))
  if (links.length > 0) return links
  return cell
    .split(",")
    .map((token) => cellText(token))
    .filter((token) => token !== "")
}

/** Values a table states for every one of its rows: `set="level=component, rank=leaf"`. */
function statedValues(declaration: string | undefined, problems: string[]): Record<string, string> {
  if (!declaration) return {}
  const values: Record<string, string> = {}
  for (const item of declaration.split(",")) {
    const separator = item.indexOf("=")
    const key = item.slice(0, separator).trim()
    const value = item.slice(separator + 1).trim()
    if (separator < 0 || !key || !value) {
      problems.push(`cannot read \`set\` item "${item.trim()}"; write it as key=value`)
      continue
    }
    values[key] = value
  }
  return values
}

interface PropertySpec {
  header: string
  key: string
  column: number
}

function propertySpecs(declaration: string | undefined, header: string[], problems: string[]): PropertySpec[] {
  if (!declaration) return []
  const specs: PropertySpec[] = []
  for (const item of declaration.split(",")) {
    const [name, alias] = item.split("=").map((part) => part.trim())
    if (!name) continue
    const column = header.indexOf(name)
    if (column < 0) {
      problems.push(`no column "${name}"`)
      continue
    }
    specs.push({ header: name, key: alias || name, column })
  }
  return specs
}

interface RowContext {
  document: CatalogSource
  catalog: FoundCatalog
  keys: Record<string, string>
  problems: CatalogProblem[]
}

function problemAt(catalog: FoundCatalog, code: string, message: string, row?: number): CatalogProblem {
  const where = row === undefined ? `table ${catalog.index}` : `table ${catalog.index}, row ${row}`
  return { code, message: `${where}: ${message}` }
}

function compilePattern(context: RowContext): RegExp | null | undefined {
  const declaration = context.keys.pattern
  if (!declaration) return undefined
  if (!declaration.includes("(?<id>")) {
    context.problems.push(problemAt(context.catalog, "catalog/pattern-invalid", `pattern has no \`id\` group: ${declaration}`))
    return null
  }
  try {
    return new RegExp(declaration)
  } catch (error) {
    context.problems.push(
      problemAt(context.catalog, "catalog/pattern-invalid", `pattern does not compile: ${(error as Error).message}`),
    )
    return null
  }
}

function annotationsOf(
  context: RowContext,
  specs: PropertySpec[],
  refColumn: number,
  stated: Record<string, string>,
): CatalogAnnotation[] {
  const { catalog, keys } = context
  const descriptionColumn = keys.description ? catalog.header.indexOf(keys.description) : -1
  const edge = keys.edge
  if (!edge || edge === "none") {
    context.problems.push(
      problemAt(catalog, "catalog/edge-required", "an annotating table must declare the edge it holds to what it annotates"),
    )
    return []
  }
  const annotations: CatalogAnnotation[] = []
  for (const [position, cells] of catalog.rows.entries()) {
    const cell = cells[refColumn] ?? ""
    // One row may speak for several entries: an analysis often says the same of a handful
    // of them, and repeating the row per entry would be writing for the tool.
    const refs = cellTargets(cell)
    if (refs.length === 0) {
      context.problems.push(problemAt(catalog, "catalog/id-empty", "the reference cell is empty", position + 1))
      continue
    }
    const properties: Record<string, unknown> = { ...stated }
    for (const spec of specs) {
      const value = cellText(cells[spec.column] ?? "")
      if (value !== "") properties[spec.key] = value
    }
    const description = descriptionColumn >= 0 ? cellText(cells[descriptionColumn] ?? "") : ""
    for (const ref of refs) {
      annotations.push({
        ref,
        edge,
        ...(description ? { description } : {}),
        properties,
        table: catalog.index,
      })
    }
  }
  return annotations
}

function rowsOf(
  context: RowContext,
  specs: PropertySpec[],
  options: CatalogOptions,
  idColumn: number,
  seen: Set<string>,
  stated: Record<string, string>,
): CatalogRow[] {
  const { catalog, document, keys } = context
  const type = keys.type
  if (!type) {
    context.problems.push(problemAt(catalog, "catalog/type-missing", "declare `type`, in the marker or in the note's `okf_rows`"))
    return []
  }
  const pattern = compilePattern(context)
  if (pattern === null) return []
  const labelColumn = keys.label ? catalog.header.indexOf(keys.label) : -1
  const descriptionColumn = keys.description ? catalog.header.indexOf(keys.description) : -1
  const edgeColumns = catalog.header
    .map((name, column) => ({ name, column }))
    .filter((entry) => (options.edgeLabels ?? []).includes(entry.name))
  const containment = keys.edge === "none" ? null : keys.edge || CONTAINMENT_EDGE
  const headings = new Set(options.headingAnchors ?? [])
  const rows: CatalogRow[] = []

  for (const [position, cells] of catalog.rows.entries()) {
    const number = position + 1
    const cell = cellText(cells[idColumn] ?? "")
    let id = cell
    let label = labelColumn >= 0 ? cellText(cells[labelColumn] ?? "") : ""
    if (pattern) {
      const match = cell.match(pattern)
      if (!match?.groups?.id) {
        context.problems.push(problemAt(catalog, "catalog/pattern-nomatch", `"${cell}" does not match the pattern`, number))
        continue
      }
      id = match.groups.id.trim()
      label = match.groups.label?.trim() || label
    }
    const anchor = anchorSlug(id)
    if (!id || !anchor) {
      context.problems.push(problemAt(catalog, "catalog/id-empty", "the identifier cell holds no usable id", number))
      continue
    }
    if (headings.has(anchor)) {
      context.problems.push(
        problemAt(catalog, "catalog/anchor-collision", `"${anchor}" is already a heading of this note`, number),
      )
      continue
    }
    if (seen.has(anchor)) {
      context.problems.push(
        problemAt(catalog, "catalog/id-duplicate", `two rows of this note answer to "${anchor}"`, number),
      )
      continue
    }
    seen.add(anchor)

    const properties: Record<string, unknown> = { ...stated }
    for (const spec of specs) {
      const value = cellText(cells[spec.column] ?? "")
      if (value !== "") properties[spec.key] = value
    }
    const edges: TopologyEdge[] = []
    if (containment) edges.push({ label: containment, target: document.id })
    for (const clause of catalog.marker.clauses) edges.push({ label: clause.label, target: clause.target })
    for (const column of edgeColumns) {
      for (const target of cellTargets(cells[column.column] ?? "")) {
        edges.push({ label: column.name, target })
      }
    }
    const description = descriptionColumn >= 0 ? cellText(cells[descriptionColumn] ?? "") : ""
    rows.push({
      id,
      anchor,
      slug: `${document.id}#${anchor}`,
      type,
      title: label ? `${id} — ${label}` : id,
      label: id,
      ...(description ? { description } : {}),
      ...(Object.keys(properties).length > 0 ? { properties } : {}),
      edges,
      table: catalog.index,
    })
  }
  return rows
}

/** Every node a note's marked tables declare, and every reason a table declared none. */
export function catalogsOf(document: CatalogSource, options: CatalogOptions = {}): CatalogResult {
  const found = findCatalogs(document.body)
  const problems = [...found.problems]
  const rows: CatalogRow[] = []
  const annotations: CatalogAnnotation[] = []
  const seen = new Set<string>()

  for (const catalog of found.catalogs) {
    const keys = { ...(options.defaults ?? {}), ...catalog.marker.keys }
    const context: RowContext = { document, catalog, keys, problems }
    if (catalog.marker.unparsed.length > 0) {
      problems.push(
        problemAt(catalog, "catalog/marker-invalid", `cannot read: ${catalog.marker.unparsed.join("; ")}`),
      )
      continue
    }
    const identifier = keys.id
    const reference = keys.ref
    if ((identifier && reference) || (!identifier && !reference)) {
      problems.push(problemAt(catalog, "catalog/marker-invalid", "declare either `id` (rows are nodes) or `ref` (rows annotate nodes)"))
      continue
    }
    const markerProblems: string[] = []
    const stated = statedValues(keys.set, markerProblems)
    if (markerProblems.length > 0) {
      problems.push(problemAt(catalog, "catalog/marker-invalid", markerProblems.join("; ")))
      continue
    }
    const columnProblems: string[] = []
    const specs = propertySpecs(keys.properties, catalog.header, columnProblems)
    const declared = (identifier ?? reference) as string
    const column = catalog.header.indexOf(declared)
    if (column < 0) columnProblems.push(`no column "${declared}"`)
    if (keys.label && !catalog.header.includes(keys.label)) columnProblems.push(`no column "${keys.label}"`)
    if (keys.description && !catalog.header.includes(keys.description)) columnProblems.push(`no column "${keys.description}"`)
    if (columnProblems.length > 0) {
      problems.push(
        problemAt(catalog, "catalog/column-unknown", `${columnProblems.join("; ")}; the table has: ${catalog.header.join(", ")}`),
      )
      continue
    }
    if (reference) {
      annotations.push(...annotationsOf(context, specs, column, stated))
      continue
    }
    rows.push(...rowsOf(context, specs, options, column, seen, stated))
  }
  return { rows, annotations, problems, tables: found.tables }
}
