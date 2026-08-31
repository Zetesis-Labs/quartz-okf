import assert from "node:assert/strict"
import test from "node:test"
import { nearestInDirection } from "../lib/spatial-nav.ts"

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

