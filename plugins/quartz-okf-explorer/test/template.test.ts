import assert from "node:assert/strict"
import test from "node:test"
import { fill, readPath } from "../lib/template.js"

const node = { indeg: 1, counts: { Cites: 3 }, subgraph: { notes: 12, previewed: 0 }, properties: { level: "high" } }

test("readPath walks dotted paths and returns undefined past a hole", () => {
  assert.equal(readPath(node, "counts.Cites"), 3)
  assert.equal(readPath(node, "properties.level"), "high")
  assert.equal(readPath(node, "properties.missing.deeper"), undefined)
  assert.equal(readPath(node, 7), undefined)
})

test("fill substitutes plain paths and picks the word from the number", () => {
  assert.equal(fill("{indeg|incoming link|incoming links}", node), "1 incoming link")
  assert.equal(fill("{counts.Cites|source|sources} · {indeg}", node), "3 sources · 1")
  assert.equal(fill("{subgraph.notes|note|notes} · {subgraph.previewed|open|open}", node), "12 notes · 0 open")
})

test("fill writes an empty value for a missing path and keeps the plural", () => {
  assert.equal(fill("{counts.Uses|use|uses}", node), " uses")
  assert.equal(fill("{nothing}", node), "")
})

test("fill works on flat variable bags, as the wording catalogue needs", () => {
  assert.equal(fill("{nodes|node|nodes} · {links|link|links}", { nodes: 1, links: 2 }), "1 node · 2 links")
  assert.equal(fill("Back to {graph}", { graph: "Root" }), "Back to Root")
})
