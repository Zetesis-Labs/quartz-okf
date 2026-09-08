import type { CatalogRow, Frontmatter } from "./types.ts"

export type PageResolver = (target: string) => string | null

export interface MaterializationDocument {
  id: string
  path: string
  reserved?: boolean
  frontmatter?: Frontmatter | null
  rows?: CatalogRow[]
}

export interface Materialization {
  row: CatalogRow
  catalog: MaterializationDocument
  page: MaterializationDocument
}

export interface MaterializationProblem {
  path: string
  code: string
  message: string
}

export interface MaterializationIndex {
  byRow: Map<string, Materialization>
  byPage: Map<string, Materialization>
  problems: MaterializationProblem[]
}

function locationOf(row: CatalogRow): string {
  return `table ${row.table}${row.row ? `, row ${row.row}` : ""}`
}

/** Valid one-to-one bindings; invalid candidates never enter either index. */
export function materializationsOf(
  documents: MaterializationDocument[],
  resolve: PageResolver,
): MaterializationIndex {
  const pages = new Map(
    documents
      .filter((document) => !document.reserved)
      .map((document) => [document.id, document]),
  )
  const candidates: Materialization[] = []
  const problems: MaterializationProblem[] = []

  for (const catalog of documents) {
    for (const row of catalog.rows ?? []) {
      if (!row.page) continue
      const pageId = resolve(row.page)
      const page = pageId ? pages.get(pageId) : undefined
      const at = locationOf(row)
      if (!page) {
        problems.push({
          path: catalog.path,
          code: "catalog/page-unresolved",
          message: `${at}: "${row.page}" names no authored page of this corpus`,
        })
        continue
      }
      if (page.id === catalog.id) {
        problems.push({
          path: catalog.path,
          code: "catalog/page-self",
          message: `${at}: row "${row.id}" cannot use its containing catalog note as its page`,
        })
        continue
      }
      if (page.frontmatter?.type !== row.type) {
        problems.push({
          path: catalog.path,
          code: "catalog/page-type-conflict",
          message: `${at}: row "${row.id}" has type "${row.type}" but page "${page.id}" has type "${String(page.frontmatter?.type ?? "")}"`,
        })
        continue
      }
      candidates.push({ row, catalog, page })
    }
  }

  const grouped = new Map<string, Materialization[]>()
  for (const candidate of candidates) {
    const group = grouped.get(candidate.page.id) ?? []
    group.push(candidate)
    grouped.set(candidate.page.id, group)
  }

  const byRow = new Map<string, Materialization>()
  const byPage = new Map<string, Materialization>()
  for (const [page, claims] of grouped) {
    if (claims.length > 1) {
      const last = claims.at(-1)
      if (!last) continue
      problems.push({
        path: last.catalog.path,
        code: "catalog/page-duplicate",
        message: `${locationOf(last.row)}: page "${page}" is claimed by ${claims.map((claim) => `"${claim.row.id}"`).join(" and ")}`,
      })
      continue
    }
    const claim = claims[0]
    byRow.set(claim.row.slug, claim)
    byPage.set(claim.page.id, claim)
  }

  return { byRow, byPage, problems }
}
