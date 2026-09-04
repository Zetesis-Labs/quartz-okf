import assert from "node:assert/strict"
import test from "node:test"
import { catalogsOf, cellTargets, cellText, findCatalogs, parseMarker } from "../lib/catalog.ts"

const ARM = `# Topology

* **Part of**: [[standards]]

# The catalogue

<!-- okf:rows type=component id=Code label=Name properties="Gloss=gloss, Vendors" -->

| Code | Name | Gloss | Vendors |
|---|---|---|---|
| AC001 | Student Recruitment | Attracting students. | Slate |
| AC002 | Agent Management | Recruitment agents. | |
`

const source = (body: string) => ({ id: "standards/arm", body })

test("parseMarker reads bare and quoted keys", () => {
  const marker = parseMarker(`<!-- okf:rows type=component id=Code properties="Gloss=gloss, Vendors" -->`)
  assert.deepEqual(marker?.keys, { type: "component", id: "Code", properties: "Gloss=gloss, Vendors" })
  assert.deepEqual(marker?.clauses, [])
})

test("parseMarker reads clauses in the Topology grammar", () => {
  const marker = parseMarker(`<!-- okf:rows type=component edge=none; Part of: [[AP001]]; Uses: [[tools/okf]], [[tools/quartz]] -->`)
  assert.deepEqual(marker?.keys, { type: "component", edge: "none" })
  assert.deepEqual(marker?.clauses, [
    { label: "Part of", target: "AP001", alias: undefined },
    { label: "Uses", target: "tools/okf", alias: undefined },
    { label: "Uses", target: "tools/quartz", alias: undefined },
  ])
})

test("parseMarker ignores comments that are not markers", () => {
  assert.equal(parseMarker("<!-- a note to self -->"), null)
  assert.equal(parseMarker("| Code | Name |"), null)
})

test("findCatalogs numbers tables among every table of the note and skips fenced ones", () => {
  const body = `| Plain | Table |
|---|---|
| a | b |

\`\`\`markdown
<!-- okf:rows type=component id=Code -->

| Code | Name |
|---|---|
| X1 | Example |
\`\`\`

<!-- okf:rows type=component id=Code -->

| Code | Name |
|---|---|
| AC001 | Student Recruitment |
`
  const found = findCatalogs(body)
  assert.equal(found.tables, 2)
  assert.equal(found.catalogs.length, 1)
  assert.equal(found.catalogs[0].index, 2)
  assert.deepEqual(found.catalogs[0].header, ["Code", "Name"])
  assert.deepEqual(found.catalogs[0].rows, [["AC001", "Student Recruitment"]])
})

test("findCatalogs reports a marker with no table under it", () => {
  const found = findCatalogs("<!-- okf:rows type=component id=Code -->\n\nJust prose.\n")
  assert.equal(found.catalogs.length, 0)
  assert.deepEqual(
    found.problems.map((problem) => problem.code),
    ["catalog/table-missing"],
  )
})

test("cellText strips emphasis, code and link syntax", () => {
  assert.equal(cellText(" **AC001** "), "AC001")
  assert.equal(cellText("`AC001`"), "AC001")
  assert.equal(cellText("[[standards/arm|Catalogue]]"), "Catalogue")
  assert.equal(cellText("[Slate](https://example.com)"), "Slate")
  assert.equal(cellText('<span id="ac001">AC001</span>'), "AC001")
  assert.equal(cellText("AP-01_x"), "AP-01_x")
})

test("cellTargets reads wikilinks, else comma-separated tokens", () => {
  assert.deepEqual(cellTargets("[[tools/okf]], [[tools/quartz|Quartz]]"), ["tools/okf", "tools/quartz"])
  assert.deepEqual(cellTargets("AP001, AP002"), ["AP001", "AP002"])
  assert.deepEqual(cellTargets("[[standards/arm#AC001]]"), ["standards/arm#AC001"])
  assert.deepEqual(cellTargets("  "), [])
})

test("catalogsOf builds one row per line with its identity, title and properties", () => {
  const { rows, problems } = catalogsOf(source(ARM), {})
  assert.deepEqual(problems, [])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    id: "AC001",
    anchor: "ac001",
    slug: "standards/arm#ac001",
    type: "component",
    title: "AC001 — Student Recruitment",
    label: "AC001",
    properties: { gloss: "Attracting students.", Vendors: "Slate" },
    edges: [{ label: "Part of", target: "standards/arm" }],
    table: 1,
    identifier: { column: 0, text: "AC001" },
  })
  // An empty property cell contributes nothing rather than an empty string.
  assert.deepEqual(rows[1].properties, { gloss: "Recruitment agents." })
})

test("catalogsOf takes note-level defaults and lets a marker override them", () => {
  const body = `<!-- okf:rows -->

| Code | Name |
|---|---|
| AC001 | Student Recruitment |

<!-- okf:rows type=capability -->

| Code | Name |
|---|---|
| AP001 | Student Attraction |
`
  const { rows } = catalogsOf(source(body), { defaults: { type: "component", id: "Code", label: "Name" } })
  assert.deepEqual(
    rows.map((row) => [row.id, row.type, row.title]),
    [
      ["AC001", "component", "AC001 — Student Recruitment"],
      ["AP001", "capability", "AP001 — Student Attraction"],
    ],
  )
})

test("catalogsOf splits an identifier cell with a pattern", () => {
  const body = `<!-- okf:rows type=capability id="L2" pattern="^(?<id>BC\\d{3})\\s+(?<label>.+)$" -->

| L2 | What it does |
|---|---|
| BC002 Curriculum Planning | Decides what to build. |
`
  const { rows, problems } = catalogsOf(source(body), {})
  assert.deepEqual(problems, [])
  assert.equal(rows[0].id, "BC002")
  assert.equal(rows[0].title, "BC002 — Curriculum Planning")
  assert.equal(rows[0].slug, "standards/arm#bc002")
})

test("catalogsOf applies a table's clauses to every row and honours edge=none", () => {
  const body = `<!-- okf:rows type=component id=Code edge=none; Part of: [[AP001]] -->

| Code | Name |
|---|---|
| AC001 | Student Recruitment |
| AC002 | Agent Management |
`
  const { rows } = catalogsOf(source(body), {})
  assert.deepEqual(rows[0].edges, [{ label: "Part of", target: "AP001" }])
  assert.deepEqual(rows[1].edges, [{ label: "Part of", target: "AP001" }])
})

test("catalogsOf reads per-row edges from a column named after an edge label", () => {
  const body = `<!-- okf:rows type=component id=Code label=Name -->

| Code | Name | Uses |
|---|---|---|
| AC001 | Student Recruitment | [[tools/okf]], [[tools/quartz]] |
| AC002 | Agent Management | |
`
  const { rows } = catalogsOf(source(body), { edgeLabels: ["Part of", "Uses"] })
  assert.deepEqual(rows[0].edges, [
    { label: "Part of", target: "standards/arm" },
    { label: "Uses", target: "tools/okf" },
    { label: "Uses", target: "tools/quartz" },
  ])
  assert.deepEqual(rows[1].edges, [{ label: "Part of", target: "standards/arm" }])
  // A column that declares edges is not also a property.
  assert.equal(rows[0].properties, undefined)
})

test("catalogsOf reports every way a table can be wrong, naming table and row", () => {
  const cases: [string, string][] = [
    ["<!-- okf:rows type=component -->\n\n| Code |\n|---|\n| AC001 |\n", "catalog/marker-invalid"],
    ["<!-- okf:rows type=component id=Code ref=Code -->\n\n| Code |\n|---|\n| AC001 |\n", "catalog/marker-invalid"],
    ["<!-- okf:rows id=Code -->\n\n| Code |\n|---|\n| AC001 |\n", "catalog/type-missing"],
    ["<!-- okf:rows type=component id=Missing -->\n\n| Code |\n|---|\n| AC001 |\n", "catalog/column-unknown"],
    ["<!-- okf:rows type=component id=Code label=Gone -->\n\n| Code |\n|---|\n| AC001 |\n", "catalog/column-unknown"],
    ["<!-- okf:rows type=component id=Code -->\n\n| Code |\n|---|\n|  |\n", "catalog/id-empty"],
    ["<!-- okf:rows type=component id=Code -->\n\n| Code |\n|---|\n| *** |\n", "catalog/id-empty"],
    ["<!-- okf:rows type=component id=Code -->\n\n| Code |\n|---|\n| AC001 |\n| ac001 |\n", "catalog/id-duplicate"],
    ['<!-- okf:rows type=component id=Code pattern="(" -->\n\n| Code |\n|---|\n| AC001 |\n', "catalog/pattern-invalid"],
    ['<!-- okf:rows type=component id=Code pattern="^(?<other>.+)$" -->\n\n| Code |\n|---|\n| AC001 |\n', "catalog/pattern-invalid"],
    ['<!-- okf:rows type=component id=Code pattern="^(?<id>BC\\d+)$" -->\n\n| Code |\n|---|\n| AC001 |\n', "catalog/pattern-nomatch"],
    ["<!-- okf:rows ref=Code -->\n\n| Code |\n|---|\n| AC001 |\n", "catalog/edge-required"],
  ]
  for (const [body, code] of cases) {
    const { problems } = catalogsOf(source(body), {})
    assert.deepEqual(
      problems.map((problem) => problem.code),
      [code],
      body,
    )
    assert.match(problems[0].message, /table 1/, body)
  }
})

test("catalogsOf reports a row anchor that collides with a heading of the same note", () => {
  const { problems, rows } = catalogsOf(source(ARM), { headingAnchors: ["ac001"] })
  assert.deepEqual(
    problems.map((problem) => problem.code),
    ["catalog/anchor-collision"],
  )
  assert.equal(rows.length, 1)
})

test("catalogsOf turns a ref table into annotations of nodes declared elsewhere", () => {
  const body = `<!-- okf:rows ref=Code edge=About properties="State=state, Comment=note" -->

| Code | State | Comment |
|---|---|---|
| AC001 | core | Built in phase one. |
| [[standards/arm#AC002]] | integrate | Bought. |
`
  const { rows, annotations, problems } = catalogsOf({ id: "analysis/gap", body }, {})
  assert.deepEqual(problems, [])
  assert.equal(rows.length, 0)
  assert.deepEqual(annotations, [
    { ref: "AC001", edge: "About", properties: { state: "core", note: "Built in phase one." }, table: 1, row: 1 },
    { ref: "standards/arm#AC002", edge: "About", properties: { state: "integrate", note: "Bought." }, table: 1, row: 2 },
  ])
})

test("parseMarker keeps a quoted semicolon inside its value and reports what it cannot read", () => {
  const marker = parseMarker(`<!-- okf:rows type=component id=Code pattern="^(?<id>a;b)$" -->`)
  assert.equal(marker?.keys.pattern, "^(?<id>a;b)$")
  assert.deepEqual(marker?.unparsed, [])
  const broken = parseMarker("<!-- okf:rows type=component id=Code; nonsense -->")
  assert.deepEqual(broken?.unparsed, ["nonsense"])
})

test("a marker segment that is neither a key nor a clause fails the table", () => {
  const { problems, rows } = catalogsOf(
    source("<!-- okf:rows type=component id=Code; nonsense -->\n\n| Code |\n|---|\n| AC001 |\n"),
    {},
  )
  assert.deepEqual(
    problems.map((problem) => problem.code),
    ["catalog/marker-invalid"],
  )
  assert.equal(rows.length, 0)
})

test("a marker rejects trailing garbage and unknown keys instead of ignoring them", () => {
  for (const marker of [
    "<!-- okf:rows type=component id=Code nonsense -->",
    "<!-- okf:rows type=component id=Code typo=value -->",
  ]) {
    const { problems, rows } = catalogsOf(source(`${marker}\n\n| Code |\n|---|\n| AC001 |\n`), {})
    assert.deepEqual(problems.map((problem) => problem.code), ["catalog/marker-invalid"])
    assert.equal(rows.length, 0)
  }
})

test("a table can state a value that holds for every one of its rows", () => {
  const body = `<!-- okf:rows type=component id=Code label=Name set="level=component, rank=leaf" properties="Gloss=gloss" -->

| Code | Name | Gloss |
|---|---|---|
| AC001 | Student Recruitment | Attracting students. |
| AC002 | Agent Management | |
`
  const { rows, problems } = catalogsOf(source(body), {})
  assert.deepEqual(problems, [])
  assert.deepEqual(rows[0].properties, { level: "component", rank: "leaf", gloss: "Attracting students." })
  // A row with nothing of its own still carries what its table states.
  assert.deepEqual(rows[1].properties, { level: "component", rank: "leaf" })
})

test("a column wins over the value the table states for the same key", () => {
  const body = `<!-- okf:rows type=component id=Code set="rank=leaf" properties="Rank=rank" -->

| Code | Rank |
|---|---|
| AC001 | root |
`
  const { rows } = catalogsOf(source(body), {})
  assert.equal(rows[0].properties?.rank, "root")
})

test("an unreadable `set` fails the table instead of dropping the value", () => {
  const { problems } = catalogsOf(source('<!-- okf:rows type=component id=Code set="rank" -->\n\n| Code |\n|---|\n| AC001 |\n'), {})
  assert.deepEqual(
    problems.map((problem) => problem.code),
    ["catalog/marker-invalid"],
  )
  assert.match(problems[0].message, /rank/)
})

test("an annotating table can state values and write the node's description", () => {
  const body = `<!-- okf:rows ref=Code edge=About description=Comment set="reviewed=2026" properties="State=state" -->

| Code | State | Comment |
|---|---|---|
| AC001 | core | Built in phase one. |
`
  const { annotations, problems } = catalogsOf({ id: "analysis/gap", body }, {})
  assert.deepEqual(problems, [])
  assert.deepEqual(annotations[0], {
    ref: "AC001",
    edge: "About",
    description: "Built in phase one.",
    properties: { reviewed: "2026", state: "core" },
    table: 1,
    row: 1,
  })
})

test("a reference cell naming several entries annotates every one of them", () => {
  const body = `<!-- okf:rows ref=Códigos edge=About set="clasif=⬛" properties="Comentario=note" -->

| Códigos | Comentario |
|---|---|
| AC009, AC010, AC008 | Un mismo apartado los cubre. |
| AC118 | Sólo este. |
`
  const { annotations, problems } = catalogsOf({ id: "analysis/gap", body }, {})
  assert.deepEqual(problems, [])
  assert.deepEqual(
    annotations.map((annotation) => annotation.ref),
    ["AC009", "AC010", "AC008", "AC118"],
  )
  assert.deepEqual(annotations[1].properties, { clasif: "⬛", note: "Un mismo apartado los cubre." })
})
