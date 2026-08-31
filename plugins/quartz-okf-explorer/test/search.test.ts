import assert from "node:assert/strict"
import test from "node:test"
import { indexGraph } from "../lib/model.js"
import { matchNode, nextScope, rankResults, scopesFor, searchAcross } from "../lib/search.js"
import { RAW_CHILD, RAW_ROOT, stubT } from "./fixtures.js"

const root = indexGraph(RAW_ROOT)
const child = indexGraph(RAW_CHILD)

test("matchNode looks at title, label and id, case-insensitively", () => {
  const n = root.nodes.get("sources/council")
  assert.equal(matchNode(n, "minutes"), true)
  assert.equal(matchNode(n, "cm-1"), true)
  assert.equal(matchNode(n, "sources/"), true)
  assert.equal(matchNode(n, "zzz"), false)
})

test("rankResults orders by the kind order, then by title, and caps the list", () => {
  const nodes = [...root.nodes.values()]
  const ranked = rankResults(nodes, "o", { kindOrder: ["source", "organisation"] })
  assert.deepEqual(ranked.map((n) => n.id).slice(0, 2), ["sources/council", "org"])
  assert.equal(rankResults(nodes, "o", { kindOrder: [], limit: 2 }).length, 2)
  assert.deepEqual(rankResults(nodes, "", {}), [])
})

test("scopesFor offers a scope only when more than one graph is published", () => {
  assert.deepEqual(scopesFor(1, stubT), [])
  assert.deepEqual(scopesFor(2, stubT), [
    { id: "graph", label: "scope.this" },
    { id: "all", label: "scope.all" },
  ])
  assert.equal(nextScope("graph", scopesFor(2, stubT)), "all")
  assert.equal(nextScope("all", scopesFor(2, stubT)), "graph")
  assert.equal(nextScope("graph", []), "graph")
})

test("searchAcross badges foreign rows with their graph and names the unavailable graphs", () => {
  const graphs = [
    { key: "", title: "Root", model: root, current: true },
    { key: "it", title: "IT graph", model: child, current: false },
    { key: "x", title: "Broken graph", model: null, error: "Broken graph: 404", current: false },
  ]
  const { rows, unavailable } = searchAcross(graphs, "cio", { limit: 20 })
  assert.deepEqual(rows.map((r) => [r.key, r.node.id, r.badge]), [
    ["", "it/roles/cio", null],
    ["it", "roles/cio", "IT graph"],
  ])
  assert.deepEqual(unavailable, ["Broken graph: 404"])
})

test("searchAcross ranks each graph by its own kind order and caps the total", () => {
  const graphs = [
    { key: "", title: "Root", model: root, current: true, kindOrder: [] },
    { key: "it", title: "IT graph", model: child, current: false, kindOrder: ["service", "role"] },
  ]
  const { rows } = searchAcross(graphs, "the", { limit: 3 })
  assert.equal(rows.length, 3)
  const all = searchAcross(graphs, "the", { limit: 20 }).rows
  const foreign = all.filter((r) => r.key === "it").map((r) => r.node.id)
  assert.deepEqual(foreign, ["compute/batch", "roles/cio"])
  assert.ok(all.findIndex((r) => r.key === "") < all.findIndex((r) => r.key === "it"))
})
