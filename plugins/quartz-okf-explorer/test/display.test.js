import assert from "node:assert/strict"
import test from "node:test"
import { FULL_MODE_ID, PALETTE, baseDisplay, displayFor, modeById } from "../lib/display.js"
import { indexGraph } from "../lib/model.js"
import { RAW_CHILD, RAW_ROOT, stubT } from "./fixtures.js"

const root = indexGraph(RAW_ROOT)
const child = indexGraph(RAW_CHILD)
const cfg = {
  typeColors: { organisation: "#org", role: "#cfg-role" },
  typeLabels: { organisation: "Organisation" },
  edgeColors: { Governs: "#gov" },
  knowledgeTypes: ["organisation"],
  typeOrder: ["organisation", "graph"],
  tooltip: { "*": "{indeg}" },
  modes: [{ id: "full", label: "Full", edges: "*" }, { id: "gov", label: "Gov", edges: ["Governs"] }],
}

test("baseDisplay takes the consumer's vocabulary and falls back to one full mode", () => {
  const base = baseDisplay(cfg, stubT)
  assert.deepEqual(base.kindOrder, ["organisation", "graph"])
  assert.equal(base.modes.length, 2)
  const bare = baseDisplay({}, stubT)
  assert.deepEqual(bare.modes, [{ id: FULL_MODE_ID, label: "mode.full", edges: "*", desc: "mode.full.desc" }])
  assert.deepEqual(bare.kindOrder, [])
  assert.deepEqual(bare.knowledgeTypes, [])
})

test("at the root the consumer wins, the graph's display fills gaps, the palette fills the rest", () => {
  const d = displayFor(baseDisplay(cfg, stubT), root, { inSubgraph: false, t: stubT })
  assert.equal(d.colors.role, "#cfg-role")
  assert.equal(d.colors.committee, "#3b82f6")
  assert.equal(d.colors.graph, PALETTE[1])
  assert.equal(d.colors.topic, PALETTE[2])
  assert.equal(d.labels.role, "Executive role")
  assert.equal(d.labels.graph, "graph")
  assert.equal(d.edgeColors.Governs, "#gov")
  assert.equal(d.edgeColors.Contains, "#9a6fbf")
  assert.equal(d.edgeColors["Supervised by"], PALETTE[1])
  assert.equal(d.modes.length, 2)
  assert.deepEqual(d.tooltip, cfg.tooltip)
})

test("inside a subgraph the child's display wins and the base only fills gaps", () => {
  const d = displayFor(baseDisplay(cfg, stubT), child, { inSubgraph: true, t: stubT })
  assert.equal(d.colors.role, "#111111")
  assert.equal(d.colors.organisation, "#org")
  assert.equal(d.colors.topic, PALETTE[2])
  assert.equal(d.labels.service, "Service")
  assert.equal(d.edgeColors.Runs, "#a855f7")
  assert.equal(d.edgeColors.Governs, "#gov")
  assert.deepEqual(d.modes.map((m) => m.id), ["ops"])
  assert.deepEqual(d.kindOrder, ["service", "role"])
  assert.deepEqual(d.tooltip, { service: "{indeg|integration|integrations}" })
})

test("a child without modes gets the catalogue's full mode and the base ordering", () => {
  const bare = indexGraph({ ...RAW_CHILD, display: {} })
  const d = displayFor(baseDisplay(cfg, stubT), bare, { inSubgraph: true, t: stubT })
  assert.deepEqual(d.modes.map((m) => m.id), [FULL_MODE_ID])
  assert.deepEqual(d.kindOrder, ["organisation", "graph"])
  assert.deepEqual(d.tooltip, cfg.tooltip)
})

test("displayFor is deterministic and never mutates the base", () => {
  const base = baseDisplay(cfg, stubT)
  const a = displayFor(base, child, { inSubgraph: true, t: stubT })
  const b = displayFor(base, child, { inSubgraph: true, t: stubT })
  assert.deepEqual(a, b)
  assert.equal(base.colors.service, undefined)
})

test("modeById returns the mode or the first one", () => {
  const d = baseDisplay(cfg, stubT)
  assert.equal(modeById(d, "gov").id, "gov")
  assert.equal(modeById(d, "zz").id, "full")
})
