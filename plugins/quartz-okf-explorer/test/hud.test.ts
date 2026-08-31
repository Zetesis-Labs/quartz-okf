import assert from "node:assert/strict"
import test from "node:test"
import { dismissOrder, filterRows, filtersIsland, selectionView, statsText, trailView, viewsIsland } from "../lib/hud.js"
import { stubT } from "./fixtures.js"

const t = stubT

test("trailView at the root shows the site as the only level and no scope with one graph", () => {
  const v = trailView({ rootTitle: "Root", trail: [], graphCount: 1, scope: "graph" }, t)
  assert.deepEqual(v.levels, [{ text: "Root", index: 0, current: true }])
  assert.equal(v.scopeKey, null)
})

test("trailView lists every ancestor as a control and marks the active scope", () => {
  const state = { rootTitle: "Root", trail: [{ id: "it", title: "IT" }, { id: "grid", title: "" }], graphCount: 3, scope: "all" }
  const v = trailView(state, t)
  assert.deepEqual(v.levels, [
    { text: "Root", index: 0, current: false },
    { text: "IT", index: 1, current: false },
    { text: "trail.subgraph", index: 2, current: true },
  ])
  assert.deepEqual(v.scopeKey, { text: "scope.all", active: true })
  assert.deepEqual(trailView({ ...state, scope: "graph" }, t).scopeKey, { text: "scope.this", active: false })
})

test("viewsIsland hides itself at the root with a single mode", () => {
  const one = viewsIsland({ trail: [], rootTitle: "Root", modes: [{ id: "a", label: "A" }], modeId: "a" }, t)
  assert.equal(one.hidden, true)
  const two = viewsIsland({ trail: [], rootTitle: "Root", modes: [{ id: "a", label: "A", desc: "d" }, { id: "b", label: "B" }], modeId: "b" }, t)
  assert.equal(two.hidden, false)
  assert.equal(two.back, null)
  assert.deepEqual(two.chips, [
    { id: "a", text: "A", active: false, desc: "d" },
    { id: "b", text: "B", active: true, desc: "" },
  ])
})

test("viewsIsland lists every portal of the graph as a door, whatever the mode shows", () => {
  const portals = [
    { id: "b", title: "B topic", subgraph: { id: "b", title: "B graph", notes: 1 } },
    { id: "a", title: "A topic", subgraph: { id: "a", notes: 12 } },
    { id: "n", title: "Note", subgraph: null },
  ]
  const v = viewsIsland({ trail: [], rootTitle: "Root", modes: [{ id: "x", label: "X" }], modeId: "x", portals }, t)
  assert.equal(v.hidden, false)
  assert.deepEqual(v.portals, [
    { id: "a", text: 'portal.enter:{"graph":"a"}', title: 'portal.title:{"graph":"a","notes":12}' },
    { id: "b", text: 'portal.enter:{"graph":"B graph"}', title: 'portal.title:{"graph":"B graph","notes":1}' },
  ])
  assert.deepEqual(viewsIsland({ trail: [], rootTitle: "Root", modes: [{ id: "x", label: "X" }], modeId: "x", portals: [portals[2]] }, t).portals, [])
})

test("viewsIsland inside a subgraph starts with the return chip even with one mode", () => {
  const v = viewsIsland({ trail: [{ id: "it", title: "IT" }], rootTitle: "Root", modes: [{ id: "a", label: "A" }], modeId: "a" }, t)
  assert.equal(v.hidden, false)
  assert.deepEqual(v.back, { text: 'views.back:{"graph":"Root"}', level: 0 })
  const deeper = viewsIsland({ trail: [{ id: "it", title: "IT" }, { id: "g", title: "Grid" }], rootTitle: "Root", modes: [], modeId: null }, t)
  assert.deepEqual(deeper.back, { text: 'views.back:{"graph":"IT"}', level: 1 })
})

test("filtersIsland tells how many groups are checked and warns when none is", () => {
  const base = { groups: { counts: { a: 3, b: 1 }, byProperty: false }, checkedTypes: null, edgeCounts: { X: 2, Y: 1 }, edgesFilterable: true, checkedEdges: null, nodeCount: 4, linkCount: 3 }
  const v = filtersIsland(base, t)
  assert.equal(v.hidden, false)
  assert.deepEqual(v.types, { text: "filters.types", sub: "2", warn: false })
  assert.deepEqual(v.edges, { hidden: false, text: "filters.edges", sub: "2", warn: false })
  assert.equal(v.stats, 'stats:{"nodes":4,"links":3}')
  const some = filtersIsland({ ...base, checkedTypes: new Set(["a"]), checkedEdges: new Set() }, t)
  assert.deepEqual(some.types, { text: "filters.types", sub: "1/2", warn: false })
  assert.deepEqual(some.edges, { hidden: false, text: "filters.edges", sub: "0/2", warn: true })
  const fixed = filtersIsland({ ...base, edgesFilterable: false }, t)
  assert.equal(fixed.edges.hidden, true)
  assert.equal(filtersIsland({ ...base, groups: { counts: {}, byProperty: false }, edgesFilterable: false }, t).hidden, true)
})

test("filterRows sorts by count and reports the all/none state", () => {
  const rows = filterRows({ b: 1, a: 3 }, { a: { color: "#a", label: "A" }, b: { color: "#b", label: "B" } }, null)
  assert.deepEqual(rows.rows, [
    { id: "a", label: "A", color: "#a", count: 3, checked: true },
    { id: "b", label: "B", color: "#b", count: 1, checked: true },
  ])
  assert.deepEqual([rows.allChecked, rows.noneChecked], [true, false])
  const partial = filterRows({ b: 1, a: 3 }, {}, new Set(["b"]))
  assert.deepEqual(partial.rows.map((r) => [r.id, r.label, r.checked]), [["a", "a", false], ["b", "b", true]])
  assert.deepEqual([partial.allChecked, partial.noneChecked], [false, false])
  assert.equal(filterRows({ a: 1 }, {}, new Set()).noneChecked, true)
})

test("selectionView groups relations by label, marks incoming ones and caps each group", () => {
  const sel = { id: "s", title: "Selected", type: "service", subgraph: null }
  const others = Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, title: `Other ${i}` }))
  const idx = new Map([[sel.id, sel], ...others.map((o) => [o.id, o])])
  const links = [
    ...others.slice(0, 7).map((o) => ({ source: sel, target: o.id, kind: "Uses" })),
    { source: "o7", target: "s", kind: "Governs" },
    { source: "o1", target: "o2", kind: "Uses" },
  ]
  const v = selectionView(sel, links, idx, { edgeLabel: {}, t })
  assert.equal(v.title, "Selected")
  assert.equal(v.type, "service")
  assert.equal(v.explore, false)
  assert.equal(v.groups.length, 2)
  assert.equal(v.groups[0].text, "Uses")
  assert.equal(v.groups[0].nodes.length, 6)
  assert.equal(v.groups[0].more, 1)
  assert.deepEqual(v.groups[0].nodes[0], { id: "o0", title: "Other 0" })
  assert.equal(v.groups[1].text, 'selection.incoming:{"label":"Governs"}')
  assert.deepEqual(v.groups[1].nodes, [{ id: "o7", title: "Other 7" }])
})

test("selectionView offers to explore a portal and shortens long titles", () => {
  const portal = { id: "p", title: "P", type: "graph", subgraph: { id: "it" } }
  const long = { id: "l", title: "x".repeat(40) }
  const idx = new Map([["p", portal], ["l", long]])
  const v = selectionView(portal, [{ source: "p", target: "l", kind: "Contains" }], idx, { edgeLabel: {}, t })
  assert.equal(v.explore, true)
  assert.equal(v.groups[0].nodes[0].title, "x".repeat(33) + "…")
  assert.equal(selectionView(null, [], idx, { edgeLabel: {}, t }), null)
})

test("statsText and dismissOrder", () => {
  assert.equal(statsText(3, 2, t), 'stats:{"nodes":3,"links":2}')
  assert.equal(dismissOrder({ menu: "types", results: true, selected: true, dock: true }), "menu")
  assert.equal(dismissOrder({ menu: null, results: true, selected: true, dock: true }), "results")
  assert.equal(dismissOrder({ menu: null, results: false, selected: true, dock: true }), "selection")
  assert.equal(dismissOrder({ menu: null, results: false, selected: false, dock: true }), "dock")
  assert.equal(dismissOrder({ menu: null, results: false, selected: false, dock: false }), null)
})
