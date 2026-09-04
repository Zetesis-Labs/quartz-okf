import assert from "node:assert/strict"
import test from "node:test"
import { indexGraph } from "../lib/model.ts"
import { RAW_ROOT } from "./fixtures.ts"

// Characterization of `indexar` in the previous explorer.html: same node fields, same
// counts and in-degree, same edge list, same drops.
test("indexGraph keys nodes by slug and carries the fields the canvas reads", () => {
  const model = indexGraph(RAW_ROOT)
  assert.equal(model.nodes.size, 5)
  const org = model.nodes.get("org")
  assert.deepEqual(
    { ...org, counts: org.counts },
    {
      id: "org", type: "organisation", title: "The organisation", label: "The organisation", desc: "Root.",
      url: "/org", aliases: [], properties: {}, subgraph: null, federated: null, row: null,
      counts: { "Supervised by": 1, Cites: 1 }, indeg: 1,
    },
  )
})

test("indexGraph keeps a short label, a federated url and the portal marker as published", () => {
  const { nodes } = indexGraph(RAW_ROOT)
  assert.equal(nodes.get("sources/council").label, "CM-1")
  assert.equal(nodes.get("sources/council").title, "Council minutes")
  assert.equal(nodes.get("it/roles/cio").url, "/it/roles/cio")
  assert.equal(nodes.get("it/roles/cio").federated, "it")
  assert.equal(nodes.get("topics/it").subgraph.id, "it")
  assert.equal(nodes.get("boards/council").type, "committee")
})

test("indexGraph drops edges without a resolvable target and marks derived ones", () => {
  const { edges } = indexGraph(RAW_ROOT)
  assert.deepEqual(edges, [
    { s: "boards/council", t: "org", k: "Governs", derived: false },
    { s: "org", t: "boards/council", k: "Supervised by", derived: true },
    { s: "topics/it", t: "it/roles/cio", k: "Contains", derived: false },
    { s: "it/roles/cio", t: "topics/it", k: "Part of", derived: true },
    { s: "org", t: "sources/council", k: "Cites", derived: false },
  ])
})

test("indexGraph exposes title, provenance, display and the vocabulary lists", () => {
  const model = indexGraph(RAW_ROOT)
  assert.equal(model.title, "Fixture site")
  assert.equal(model.federatedFrom, null)
  assert.deepEqual(model.display, RAW_ROOT.display)
  assert.deepEqual(model.types, RAW_ROOT.types)
  assert.deepEqual(model.edgeLabels, RAW_ROOT.edgeLabels)
})

test("indexGraph derives the label list from the kept edges when the document has none", () => {
  const raw = { ...RAW_ROOT, edgeLabels: undefined, types: undefined }
  const model = indexGraph(raw)
  assert.deepEqual(model.edgeLabels, ["Governs", "Supervised by", "Contains", "Part of", "Cites"])
  assert.deepEqual(model.types, [])
})

test("indexGraph accepts `id` as the node key and `desc` as the description", () => {
  const model = indexGraph({ nodes: [{ id: "a", desc: "A." }], edges: [] })
  assert.equal(model.nodes.get("a").desc, "A.")
  assert.equal(model.nodes.get("a").type, "unknown")
  assert.equal(model.nodes.get("a").title, "a")
})

test("indexGraph carries a row's aliases and its page marker", () => {
  const model = indexGraph({
    nodes: [
      {
        slug: "standards/arm#ac001",
        title: "AC001 — Student Recruitment",
        label: "AC001",
        type: "component",
        aliases: ["AC001"],
        url: "/standards/arm#ac001",
        row: { note: "standards/arm", anchor: "ac001" },
      },
      { slug: "standards/arm", title: "Catalogue", type: "report" },
    ],
    edges: [],
  })
  const row = model.nodes.get("standards/arm#ac001")
  assert.deepEqual(row.aliases, ["AC001"])
  assert.deepEqual(row.row, { note: "standards/arm", anchor: "ac001" })
  assert.equal(row.url, "/standards/arm#ac001")
  assert.deepEqual(model.nodes.get("standards/arm").aliases, [])
  assert.equal(model.nodes.get("standards/arm").row, null)
})
