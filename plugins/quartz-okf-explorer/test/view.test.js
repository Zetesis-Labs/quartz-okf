import assert from "node:assert/strict"
import test from "node:test"
import { indexGraph } from "../lib/model.js"
import { buildView } from "../lib/view.js"
import { RAW_ROOT } from "./fixtures.js"

const model = indexGraph(RAW_ROOT)
const display = {
  colors: { organisation: "#org", committee: "#com", graph: "#gra", role: "#rol", source: "#src" },
  labels: { organisation: "Organisation", source: "Primary source" },
}
const FULL = { id: "full", edges: "*" }
const ids = (view) => view.nodes.map((n) => n.id).sort()

// Characterization of `build()` in the previous explorer.html.
test("a full mode keeps every node that takes part in an edge", () => {
  const view = buildView(model, display, FULL)
  assert.deepEqual(ids(view), ["boards/council", "it/roles/cio", "org", "sources/council", "topics/it"])
  assert.equal(view.links.length, 5)
  assert.deepEqual(view.links[0], { source: "boards/council", target: "org", kind: "Governs", derived: false })
  assert.equal(view.edgesFilterable, true)
  assert.deepEqual(view.edgeCounts, { Governs: 1, "Supervised by": 1, Contains: 1, "Part of": 1, Cites: 1 })
})

test("a mode that fixes one relation is not filterable by relation", () => {
  const view = buildView(model, display, { id: "gov", edges: ["Governs"] })
  assert.deepEqual(ids(view), ["boards/council", "org"])
  assert.equal(view.edgesFilterable, false)
  assert.deepEqual(view.edgeCounts, { Governs: 1 })
})

test("checked relations narrow a multi-relation mode; null means all", () => {
  const mode = { id: "two", edges: ["Governs", "Cites"] }
  assert.deepEqual(ids(buildView(model, display, mode)), ["boards/council", "org", "sources/council"])
  const narrowed = buildView(model, display, mode, { edges: new Set(["Cites"]) })
  assert.deepEqual(ids(narrowed), ["org", "sources/council"])
  assert.deepEqual(narrowed.edgeCounts, { Governs: 1, Cites: 1 })
})

test("sourceType and targetType restrict the edges before anything else", () => {
  const bySource = buildView(model, display, { id: "s", edges: "*", sourceType: "organisation" })
  assert.deepEqual(ids(bySource), ["boards/council", "org", "sources/council"])
  const byTarget = buildView(model, display, { id: "t", edges: "*", targetType: "graph" })
  assert.deepEqual(ids(byTarget), ["it/roles/cio", "topics/it"])
})

test("groups follow the node type with colour and label from the display", () => {
  const view = buildView(model, display, FULL)
  assert.deepEqual(view.groups.counts, { organisation: 1, committee: 1, graph: 1, role: 1, source: 1 })
  assert.equal(view.groups.byProperty, false)
  assert.deepEqual(view.groups.meta.organisation, { color: "#org", label: "Organisation" })
  assert.deepEqual(view.groups.meta.role, { color: "#rol", label: "role" })
})

test("checked types keep only those groups; an empty set keeps nothing", () => {
  const some = buildView(model, display, FULL, { types: new Set(["organisation", "source"]) })
  assert.deepEqual(ids(some), ["org", "sources/council"])
  assert.deepEqual(some.links.map((l) => l.kind), ["Cites"])
  const none = buildView(model, display, FULL, { types: new Set() })
  assert.deepEqual(ids(none), [])
})

test("a mode colouring by a property groups by its values and never filters nodes without it", () => {
  const mode = { id: "p", edges: "*", colorBy: { property: "status", map: { current: { color: "#cur", label: "In force" } } } }
  const view = buildView(model, display, mode)
  assert.equal(view.groups.byProperty, true)
  assert.deepEqual(view.groups.counts, { current: 1 })
  assert.deepEqual(view.groups.meta.current, { color: "#cur", label: "In force" })
  const none = buildView(model, display, mode, { types: new Set() })
  assert.deepEqual(ids(none), ["boards/council", "org", "sources/council", "topics/it"])
})

test("adjacency and index are built over the visible nodes only", () => {
  const view = buildView(model, display, FULL, { types: new Set(["organisation", "source", "committee"]) })
  assert.deepEqual([...view.adj.get("org")].sort(), ["boards/council", "sources/council"])
  assert.equal(view.idx.get("topics/it"), undefined)
  assert.equal(view.idx.get("org").title, "The organisation")
  assert.notEqual(view.idx.get("org"), model.nodes.get("org"))
})
