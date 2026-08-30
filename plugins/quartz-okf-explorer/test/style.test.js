import assert from "node:assert/strict"
import test from "node:test"
import { fillOf, scaleOf, sizeOf } from "../lib/style.js"

const node = (over = {}) => ({ type: "service", indeg: 10, counts: { Cites: 5 }, properties: {}, ...over })

test("scaleOf picks the first step whose max covers the value, else the last", () => {
  const scale = [{ max: 0, color: "a" }, { max: 2, color: "b" }, { color: "c" }]
  assert.equal(scaleOf(0, scale).color, "a")
  assert.equal(scaleOf(2, scale).color, "b")
  assert.equal(scaleOf(9, scale).color, "c")
})

test("sizeOf: consumer radius by type wins, then property map, then default", () => {
  const radius = { byType: { service: 9 }, property: "tier", map: { edge: 7 }, default: 3 }
  assert.equal(sizeOf(node(), { radius, mode: {} }), 9)
  assert.equal(sizeOf(node({ type: "x", properties: { tier: "edge" } }), { radius, mode: {} }), 7)
  assert.equal(sizeOf(node({ type: "x" }), { radius, mode: {} }), 3)
})

test("sizeOf without a radius block follows the mode, then the in-degree", () => {
  assert.equal(sizeOf(node(), { radius: null, mode: { sizeBy: { countEdge: "Cites" } } }), 4 + 4)
  assert.equal(sizeOf(node({ counts: { Cites: 40 } }), { radius: null, mode: { sizeBy: { countEdge: "Cites" } } }), 13)
  assert.equal(sizeOf(node(), { radius: null, mode: { sizeBy: { indegree: true } } }), 4.5 + Math.min(9, 10 * 0.22))
  assert.equal(sizeOf(node({ indeg: 100 }), { radius: null, mode: {} }), 4.2 + 6)
})

test("fillOf: countEdge scale applies only to knowledge types", () => {
  const mode = { colorBy: { countEdge: "Cites", scale: [{ max: 0, color: "#none" }, { color: "#some" }] } }
  const colors = { service: "#svc" }
  assert.equal(fillOf(node(), { mode, colors, knowledgeTypes: [] }), "#some")
  assert.equal(fillOf(node({ counts: {} }), { mode, colors, knowledgeTypes: ["service"] }), "#none")
  assert.equal(fillOf(node(), { mode, colors, knowledgeTypes: ["other"] }), "#svc")
})

test("fillOf: property map accepts strings and objects and falls back per type or globally", () => {
  const colors = { service: "#svc", topic: "#top" }
  const mode = { colorBy: { property: "status", map: { current: "#cur", old: { color: "#old" } }, fallback: { topic: "#agg" } } }
  assert.equal(fillOf(node({ properties: { status: "current" } }), { mode, colors, knowledgeTypes: [] }), "#cur")
  assert.equal(fillOf(node({ properties: { status: "old" } }), { mode, colors, knowledgeTypes: [] }), "#old")
  assert.equal(fillOf(node({ type: "topic" }), { mode, colors, knowledgeTypes: [] }), "#agg")
  assert.equal(fillOf(node(), { mode, colors, knowledgeTypes: [] }), "#svc")
  const global = { colorBy: { property: "status", map: {}, fallback: "#all" } }
  assert.equal(fillOf(node(), { mode: global, colors, knowledgeTypes: [] }), "#all")
})

test("fillOf: without a colorBy the type colour paints the node, grey when unknown", () => {
  assert.equal(fillOf(node(), { mode: {}, colors: { service: "#svc" }, knowledgeTypes: [] }), "#svc")
  assert.equal(fillOf(node({ type: "zz" }), { mode: {}, colors: {}, knowledgeTypes: [] }), "#888")
})
