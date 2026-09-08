import assert from "node:assert/strict"
import test from "node:test"
import { materializationsOf } from "../lib/materialization.ts"
import { buildBaseResolver } from "../lib/resolver.ts"
import type { CatalogRow, ValidatedDocument } from "../lib/types.ts"

function note(id: string, type: string, rows: CatalogRow[] = []): ValidatedDocument {
  return {
    id,
    path: `${id}.md`,
    source: "",
    body: "",
    reserved: false,
    frontmatter: { type, title: id },
    edges: [],
    violations: [],
    rows,
  }
}

function row(id: string, page: string, rowNumber = 1): CatalogRow {
  return {
    id,
    anchor: id.toLowerCase(),
    slug: `standards/catalog#${id.toLowerCase()}`,
    type: "component",
    title: id,
    label: id,
    edges: [],
    table: 1,
    page,
    row: rowNumber,
  }
}

test("indexes a valid materialized page in both directions", () => {
  const documents = [
    note("standards/catalog", "report", [row("AC001", "details/recruitment")]),
    note("details/recruitment", "component"),
  ]
  const index = materializationsOf(documents, buildBaseResolver(documents))

  assert.deepEqual(index.problems, [])
  assert.equal(index.byRow.get("standards/catalog#ac001")?.page.id, "details/recruitment")
  assert.equal(index.byPage.get("details/recruitment")?.row.slug, "standards/catalog#ac001")
})

test("rejects unresolved, self-referential and type-conflicting page claims", () => {
  const documents = [
    note("standards/catalog", "report", [
      row("AC001", "missing", 1),
      row("AC002", "standards/catalog", 2),
      row("AC003", "details/wrong-type", 3),
    ]),
    note("details/wrong-type", "decision"),
  ]
  const index = materializationsOf(documents, buildBaseResolver(documents))

  assert.deepEqual(
    index.problems.map((problem) => [problem.path, problem.code]),
    [
      ["standards/catalog.md", "catalog/page-unresolved"],
      ["standards/catalog.md", "catalog/page-self"],
      ["standards/catalog.md", "catalog/page-type-conflict"],
    ],
  )
  assert.equal(index.byRow.size, 0)
  assert.match(index.problems[0].message, /table 1, row 1/)
})

test("two rows claiming one page invalidate the materialization instead of picking a winner", () => {
  const documents = [
    note("standards/catalog", "report", [
      row("AC001", "details/shared", 1),
      row("AC002", "details/shared", 2),
    ]),
    note("details/shared", "component"),
  ]
  const index = materializationsOf(documents, buildBaseResolver(documents))

  assert.deepEqual(index.problems.map((problem) => problem.code), ["catalog/page-duplicate"])
  assert.match(index.problems[0].message, /AC001/)
  assert.match(index.problems[0].message, /AC002/)
  assert.equal(index.byRow.size, 0)
  assert.equal(index.byPage.size, 0)
})
