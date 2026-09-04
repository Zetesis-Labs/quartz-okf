import type { CatalogRow } from "../../lib/types.ts"

/** The slice of a hast node this pass reads and writes. */
export interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

type RowRef = Pick<CatalogRow, "id" | "anchor" | "slug" | "table" | "identifier">

function collect(node: HastNode, tagName: string, found: HastNode[] = []): HastNode[] {
  for (const child of node.children ?? []) {
    if (child.tagName === tagName) found.push(child)
    collect(child, tagName, found)
  }
  return found
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? ""
  return (node.children ?? []).map(textOf).join("")
}

function identifierOf(row: HastNode, column: number): string | null {
  const cells = (row.children ?? []).filter((child) => child.tagName === "td")
  const cell = cells[column]
  return cell ? textOf(cell).trim() : null
}

const isHeaderRow = (row: HastNode): boolean => (row.children ?? []).some((cell) => cell.tagName === "th")

export function markCatalogRows(tree: HastNode, rows: RowRef[]): string[] {
  const tables = collect(tree, "table")
  const problems: string[] = []
  const byTable = new Map<number, RowRef[]>()
  for (const row of rows) {
    byTable.set(row.table, [...(byTable.get(row.table) ?? []), row])
  }
  for (const [index, group] of [...byTable.entries()].sort((left, right) => left[0] - right[0])) {
    const table = tables[index - 1]
    if (!table) {
      problems.push(`table ${index}: the rendered page has no such table`)
      continue
    }
    // The core drops a row it could not read, so the rendered rows and the extracted ones
    // are not always one to one: each is matched by the id it must be holding, scanning
    // forward from the last match.
    const rendered = collect(table, "tr").filter((row) => !isHeaderRow(row))
    let cursor = 0
    let marked = 0
    for (const row of group) {
      const position = rendered.findIndex((candidate, at) => {
        if (at < cursor) return false
        if (row.identifier) {
          return identifierOf(candidate, row.identifier.column) === row.identifier.text
        }
        return textOf(candidate).includes(row.id)
      })
      if (position < 0) {
        problems.push(`table ${index}: no rendered row holds "${row.id}"`)
        continue
      }
      const target = rendered[position]
      target.properties = { ...(target.properties ?? {}), id: row.anchor, "data-okf-node": row.slug }
      cursor = position + 1
      marked += 1
    }
    if (marked > 0) table.properties = { ...(table.properties ?? {}), "data-okf-catalog": "" }
  }
  return problems
}
