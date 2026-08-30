import assert from "node:assert/strict"
import test from "node:test"
import { routeTo } from "../lib/route.js"

test("routeTo returns nothing when already there", () => {
  assert.deepEqual(routeTo([], []), [])
  assert.deepEqual(routeTo(["it"], ["it"]), [])
})

test("routeTo dives from the root and from an ancestor", () => {
  assert.deepEqual(routeTo([], ["it"]), [{ dive: "it" }])
  assert.deepEqual(routeTo(["it"], ["it", "grid"]), [{ dive: "grid" }])
  assert.deepEqual(routeTo([], ["it", "grid"]), [{ dive: "it" }, { dive: "grid" }])
})

test("routeTo goes back to the common prefix before diving", () => {
  assert.deepEqual(routeTo(["it"], []), [{ back: 0 }])
  assert.deepEqual(routeTo(["it", "grid"], ["it"]), [{ back: 1 }])
  assert.deepEqual(routeTo(["it"], ["other"]), [{ back: 0 }, { dive: "other" }])
  assert.deepEqual(routeTo(["a", "b"], ["a", "c", "d"]), [{ back: 1 }, { dive: "c" }, { dive: "d" }])
})
