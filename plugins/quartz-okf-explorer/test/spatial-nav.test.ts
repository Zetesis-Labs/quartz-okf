import assert from "node:assert/strict"
import test from "node:test"
import { nearestInDirection, nextSequential } from "../lib/spatial-nav.ts"

const nodes = [
  { id: "c", x: 0, y: 0 },
  { id: "right", x: 100, y: 5 },
  { id: "far-right", x: 300, y: 0 },
  { id: "up", x: 3, y: -80 },
  { id: "down-right", x: 60, y: 60 },
  { id: "nowhere" },
]

test("nearestInDirection prefers the closest node along the axis, penalising lateral drift", () => {
  const c = nodes[0]
  assert.equal(nearestInDirection(c, nodes, "right")?.id, "right")
  assert.equal(nearestInDirection(c, nodes, "up")?.id, "up")
  assert.equal(nearestInDirection(c, nodes, "down")?.id, "down-right")
  assert.equal(nearestInDirection(c, nodes, "left"), null)
  assert.equal(nearestInDirection({ id: "x" }, nodes, "right"), null)
})

test("nextSequential walks the list in order and wraps, from nothing it starts at either end", () => {
  assert.equal(nextSequential(null, nodes)?.id, "c")
  assert.equal(nextSequential(null, nodes, true)?.id, "nowhere")
  assert.equal(nextSequential(nodes[1], nodes)?.id, "far-right")
  assert.equal(nextSequential(nodes[0], nodes, true)?.id, "nowhere")
  assert.equal(nextSequential({ id: "ghost" }, nodes)?.id, "c")
  assert.equal(nextSequential(null, []), null)
})
