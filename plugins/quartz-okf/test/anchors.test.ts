import assert from "node:assert/strict"
import test from "node:test"
import { markCatalogRows } from "../src/anchors.ts"

const text = (value) => ({ type: "text", value })
const cell = (tag, value) => ({ type: "element", tagName: tag, properties: {}, children: [text(value)] })
const row = (cells, tag = "td") => ({
  type: "element",
  tagName: "tr",
  properties: {},
  children: cells.map((value) => cell(tag, value)),
})
const table = (header, body) => ({
  type: "element",
  tagName: "table",
  properties: {},
  children: [
    { type: "element", tagName: "thead", properties: {}, children: [row(header, "th")] },
    { type: "element", tagName: "tbody", properties: {}, children: body.map((cells) => row(cells)) },
  ],
})
const tree = (...tables) => ({ type: "root", children: tables })

const ROWS = [
  { id: "AC001", anchor: "ac001", slug: "standards/arm#ac001", table: 1 },
  { id: "AC002", anchor: "ac002", slug: "standards/arm#ac002", table: 1 },
]

test("marks the catalog table and gives every row its anchor", () => {
  const document = tree(
    table(["Code", "Name"], [
      ["AC001", "Student Recruitment"],
      ["AC002", "Agent Management"],
    ]),
  )
  const problems = markCatalogRows(document, ROWS)
  assert.deepEqual(problems, [])
  const [catalog] = document.children
  assert.equal(catalog.properties["data-okf-catalog"], "")
  const body = catalog.children[1].children
  assert.deepEqual(body[0].properties, { id: "ac001", "data-okf-node": "standards/arm#ac001" })
  assert.deepEqual(body[1].properties, { id: "ac002", "data-okf-node": "standards/arm#ac002" })
})

test("addresses the right table when the note holds several", () => {
  const document = tree(
    table(["Something", "Else"], [["not", "a catalog"]]),
    table(["Code", "Name"], [["AC001", "Student Recruitment"]]),
  )
  const problems = markCatalogRows(document, [{ ...ROWS[0], table: 2 }])
  assert.deepEqual(problems, [])
  assert.equal(document.children[0].properties["data-okf-catalog"], undefined)
  assert.equal(document.children[1].children[1].children[0].properties.id, "ac001")
})

test("skips rows the core dropped and still anchors the ones that are there", () => {
  const document = tree(
    table(["Code", "Name"], [
      ["", "No id here"],
      ["AC002", "Agent Management"],
    ]),
  )
  const problems = markCatalogRows(document, [ROWS[1]])
  assert.deepEqual(problems, [])
  const body = document.children[0].children[1].children
  assert.equal(body[0].properties.id, undefined)
  assert.equal(body[1].properties.id, "ac002")
})

test("reports a row it cannot find and a table that is not there, and writes neither", () => {
  const document = tree(table(["Code", "Name"], [["AC001", "Student Recruitment"]]))
  const problems = markCatalogRows(document, [
    ROWS[0],
    { id: "AC999", anchor: "ac999", slug: "standards/arm#ac999", table: 1 },
    { id: "AC003", anchor: "ac003", slug: "standards/arm#ac003", table: 7 },
  ])
  assert.deepEqual(problems, [
    'table 1: no rendered row holds "AC999"',
    "table 7: the rendered page has no such table",
  ])
  assert.equal(document.children[0].children[1].children[0].properties.id, "ac001")
})

test("an identifier split by a pattern still finds its row", () => {
  const document = tree(table(["L2", "What"], [["BC002 Curriculum Planning", "Decides."]]))
  const problems = markCatalogRows(document, [
    { id: "BC002", anchor: "bc002", slug: "standards/bcm#bc002", table: 1 },
  ])
  assert.deepEqual(problems, [])
  assert.equal(document.children[0].children[1].children[0].properties.id, "bc002")
})

test("the transformer's html phase anchors a note's rows and ships the highlight", async () => {
  const { OkfTransformer } = await import("../src/index.ts")
  const document = tree(table(["Code", "Name"], [["AC001", "Student Recruitment"]]))
  const file = { data: { slug: "standards/arm", filePath: "content/standards/arm.md", okf: { rows: [ROWS[0]] } } }
  const [plugin] = OkfTransformer().htmlPlugins()
  plugin()(document, file)
  assert.equal(document.children[0].children[1].children[0].properties.id, "ac001")
  const [style, script] = document.children.slice(-2)
  assert.equal(style.tagName, "style")
  assert.match(style.children[0].value, /data-okf-node\]:target/)
  assert.equal(script.tagName, "script")
  assert.match(script.children[0].value, /scrollIntoView/, "la fila enlazada tiene que aterrizar")
  assert.match(script.children[0].value, /data-okf-catalog/, "sólo las filas de catálogo, no cualquier ancla")
})
