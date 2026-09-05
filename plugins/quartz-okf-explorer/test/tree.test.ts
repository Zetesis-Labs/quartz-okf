import assert from "node:assert/strict"
import test from "node:test"
import { centroidOf, hierarchyOf, radialLayout, treeOf } from "../lib/tree.ts"

const node = (id: string) => ({ id })
const link = (source: string, target: string, kind: string) => ({ source, target, kind, derived: false })

// A standard: one root, three domains, capabilities under two of them, components under one.
const NODES = ["std", "d1", "d2", "d3", "c1", "c2", "c3", "k1", "k2", "k3", "k4"].map(node)
const PART_OF = [
  link("d1", "std", "Part of"),
  link("d2", "std", "Part of"),
  link("d3", "std", "Part of"),
  link("c1", "d1", "Part of"),
  link("c2", "d1", "Part of"),
  link("c3", "d2", "Part of"),
  link("k1", "c1", "Part of"),
  link("k2", "c1", "Part of"),
  link("k3", "c1", "Part of"),
  link("k4", "c2", "Part of"),
]
const CONTAINS = PART_OF.map((l) => link(l.target, l.source, "Contains"))

const angleOf = (p: { x: number; y: number }, cx: number, cy: number) => Math.atan2(p.y - cy, p.x - cx)
const radiusOf = (p: { x: number; y: number }, cx: number, cy: number) => Math.hypot(p.x - cx, p.y - cy)
const CENTRE = { cx: 500, cy: 400 }

test("treeOf reads the string and the object spellings, radial by default", () => {
  assert.deepEqual(treeOf({ id: "m", label: "m" }), null)
  assert.deepEqual(treeOf({ id: "m", label: "m", tree: "Part of" }), { edge: "Part of", layout: "radial" })
  assert.deepEqual(treeOf({ id: "m", label: "m", tree: { edge: "Part of", layout: "rings" } }), { edge: "Part of", layout: "rings" })
})

test("hierarchyOf reads only the declared edge and finds the root, parents, children and depths", () => {
  const h = hierarchyOf(NODES, [...PART_OF, ...CONTAINS, link("k4", "d3", "Cites")], "Part of")
  assert.ok(h)
  assert.deepEqual(h.roots, ["std"])
  assert.equal(h.parent.get("k4"), "c2")
  assert.deepEqual(h.children.get("d1"), ["c1", "c2"])
  assert.equal(h.depth.get("std"), 0)
  assert.equal(h.depth.get("d2"), 1)
  assert.equal(h.depth.get("k3"), 3)
  assert.deepEqual(h.loose, [])
  assert.deepEqual(h.shared, [])
  assert.deepEqual(h.cyclic, [])
})

test("the edge may be declared from the parent's side and reads as the same tree", () => {
  const byChild = hierarchyOf(NODES, PART_OF, "Part of")
  const byParent = hierarchyOf(NODES, CONTAINS, "Contains")
  assert.ok(byChild && byParent)
  assert.deepEqual([...byParent.parent], [...byChild.parent])
  assert.deepEqual(byParent.roots, byChild.roots)
})

test("children keep the order the view gives its nodes, not the order of the links", () => {
  const nodes = ["std", "b", "a", "c"].map(node)
  const links = [link("a", "std", "Part of"), link("c", "std", "Part of"), link("b", "std", "Part of")]
  assert.deepEqual(hierarchyOf(nodes, links, "Part of")?.children.get("std"), ["b", "a", "c"])
})

test("nodes on screen that the edge never touches are loose", () => {
  const h = hierarchyOf([...NODES, node("note")], [...PART_OF, link("note", "k1", "Cites")], "Part of")
  assert.deepEqual(h?.loose, ["note"])
})

test("a node with two parents goes under the first one and is reported", () => {
  const h = hierarchyOf(NODES, [...PART_OF, link("k4", "c3", "Part of")], "Part of")
  assert.ok(h)
  assert.equal(h.parent.get("k4"), "c2")
  assert.deepEqual(h.shared, ["k4"])
  assert.equal(h.depth.get("k4"), 3)
})

test("a cycle is reported and its nodes are left loose", () => {
  const nodes = ["std", "d1", "x", "y"].map(node)
  const links = [link("d1", "std", "Part of"), link("x", "y", "Part of"), link("y", "x", "Part of")]
  const h = hierarchyOf(nodes, links, "Part of")
  assert.ok(h)
  assert.deepEqual(h.roots, ["std"])
  assert.deepEqual(h.cyclic.sort(), ["x", "y"])
  assert.deepEqual(h.loose.sort(), ["x", "y"])
  assert.equal(h.depth.has("x"), false)
})

test("no link under the edge means no hierarchy", () => {
  assert.equal(hierarchyOf(NODES, CONTAINS, "Part of"), null)
  assert.equal(hierarchyOf(NODES, [], "Part of"), null)
})

test("radialLayout puts the root at the centre, one ring per depth, and the same input gives the same output", () => {
  const h = hierarchyOf(NODES, PART_OF, "Part of")
  assert.ok(h)
  const { positions, rings } = radialLayout(h, { ...CENTRE, spacing: 16, step: 70 })
  assert.deepEqual(positions.get("std"), { x: 500, y: 400, ring: 0, radius: 0 })
  assert.equal(rings.length, 4)
  assert.equal(rings[0], 0)
  for (let i = 1; i < rings.length; i += 1) assert.ok(rings[i] > rings[i - 1])
  for (const [id, p] of positions) {
    const depth = h.depth.get(id) ?? -1
    assert.equal(p.ring, depth)
    assert.ok(Math.abs(radiusOf(p, CENTRE.cx, CENTRE.cy) - rings[depth]) < 1e-6, `${id} sits off its ring`)
  }
  const again = radialLayout(h, { ...CENTRE, spacing: 16, step: 70 })
  assert.deepEqual([...again.positions], [...positions])
})

test("leaves on the outer ring are equidistant in angle and siblings stay contiguous in order", () => {
  const h = hierarchyOf(NODES, PART_OF, "Part of")
  assert.ok(h)
  const { positions } = radialLayout(h, { ...CENTRE, spacing: 16, step: 70 })
  // Leaves in reading order: k1 k2 k3 (under c1), k4 (under c2), c3 (under d2), d3.
  const leaves = ["k1", "k2", "k3", "k4", "c3", "d3"]
  const angles = leaves.map((id) => angleOf(positions.get(id) ?? { x: 0, y: 0 }, CENTRE.cx, CENTRE.cy))
  const gaps = angles.map((a, i) => {
    const next = angles[(i + 1) % angles.length]
    return ((next - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  })
  for (const gap of gaps) assert.ok(Math.abs(gap - (2 * Math.PI) / leaves.length) < 1e-6, `uneven gap ${gap}`)
  // A parent sits in the middle of its children's sector.
  const c1 = angleOf(positions.get("c1") ?? { x: 0, y: 0 }, CENTRE.cx, CENTRE.cy)
  assert.ok(Math.abs(c1 - angles[1]) < 1e-6, "c1 is not at the middle of k1..k3")
})

test("the outer radius grows with the leaf count and never below the ring step", () => {
  const few = hierarchyOf(NODES, PART_OF, "Part of")
  assert.ok(few)
  const small = radialLayout(few, { ...CENTRE, spacing: 16, step: 70 })
  assert.equal(small.rings.at(-1), 210)
  const many = Array.from({ length: 200 }, (_, i) => `leaf${i}`)
  const wide = hierarchyOf(
    [node("root"), ...many.map(node)],
    many.map((id) => link(id, "root", "Part of")),
    "Part of",
  )
  assert.ok(wide)
  const big = radialLayout(wide, { ...CENTRE, spacing: 16, step: 70 })
  assert.ok((big.rings.at(-1) ?? 0) >= (200 * 16) / (2 * Math.PI))
})

test("several roots share the first ring around a virtual centre; a lone node sits at the centre", () => {
  const nodes = ["a", "b", "a1", "b1"].map(node)
  const links = [link("a1", "a", "Part of"), link("b1", "b", "Part of")]
  const h = hierarchyOf(nodes, links, "Part of")
  assert.ok(h)
  assert.deepEqual(h.roots, ["a", "b"])
  const { positions, rings } = radialLayout(h, { ...CENTRE, spacing: 16, step: 70 })
  assert.equal(positions.get("a")?.ring, 1)
  assert.equal(positions.get("a1")?.ring, 2)
  assert.equal(rings.length, 3)
  const lone = hierarchyOf([node("only")], [link("only", "gone", "Part of")], "Part of")
  assert.equal(lone, null)
})

test("centroidOf averages the placed neighbours and says so when there are none", () => {
  assert.deepEqual(centroidOf([{ x: 0, y: 0 }, { x: 10, y: 20 }]), { x: 5, y: 10 })
  assert.equal(centroidOf([]), null)
})
