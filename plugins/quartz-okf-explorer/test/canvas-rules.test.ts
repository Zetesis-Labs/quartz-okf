import assert from "node:assert/strict"
import test from "node:test"
import { drawnAlone, inViewport, labelText, labelVisible, linkAlpha, nodeAlpha, viewportOf } from "../lib/canvas-rules.ts"

const quiet = { focused: false, near: false, hit: false, selected: false, hasFocus: false, hasQuery: false }

test("nodeAlpha dims what is neither focused, near nor matching", () => {
  assert.equal(nodeAlpha(quiet), 1)
  assert.equal(nodeAlpha({ ...quiet, hasFocus: true }), 0.12)
  assert.equal(nodeAlpha({ ...quiet, hasFocus: true, near: true }), 1)
  assert.equal(nodeAlpha({ ...quiet, hasFocus: true, focused: true }), 1)
  assert.equal(nodeAlpha({ ...quiet, hasQuery: true }), 0.12)
  assert.equal(nodeAlpha({ ...quiet, hasQuery: true, hit: true }), 1)
  assert.equal(nodeAlpha({ ...quiet, hasFocus: true, hasQuery: true, hit: true }), 0.12)
})

test("drawnAlone singles out nodes with state of their own or a marker", () => {
  assert.equal(drawnAlone(quiet, { portal: false, federated: false }), false)
  assert.equal(drawnAlone({ ...quiet, selected: true }, { portal: false, federated: false }), true)
  assert.equal(drawnAlone({ ...quiet, hasQuery: true }, { portal: false, federated: false }), true)
  assert.equal(drawnAlone(quiet, { portal: true, federated: false }), true)
  assert.equal(drawnAlone(quiet, { portal: false, federated: true }), true)
})

test("labelVisible follows the zoom and the node's weight, and hides dimmed labels", () => {
  const base = { ...quiet, portal: false, size: 5, k: 1, dimming: false }
  assert.equal(labelVisible(base), false)
  assert.equal(labelVisible({ ...base, k: 2.3 }), true)
  assert.equal(labelVisible({ ...base, size: 7.5 }), true)
  assert.equal(labelVisible({ ...base, size: 7.5, k: 0.8 }), false)
  assert.equal(labelVisible({ ...base, size: 9, k: 0.3 }), true)
  assert.equal(labelVisible({ ...base, portal: true, k: 0.2 }), true)
  assert.equal(labelVisible({ ...base, near: true, k: 0.7 }), true)
  assert.equal(labelVisible({ ...base, near: true, k: 0.5 }), false)
  assert.equal(labelVisible({ ...base, dimming: true, size: 9 }), false)
  assert.equal(labelVisible({ ...base, dimming: true, size: 9, hit: true }), true)
})

test("linkAlpha and labelText", () => {
  assert.equal(linkAlpha({ hasFocus: false, hasQuery: false }), 0.34)
  assert.equal(linkAlpha({ hasFocus: false, hasQuery: true }), 0.1)
  assert.equal(linkAlpha({ hasFocus: true, hasQuery: true }), 0.05)
  assert.equal(labelText("short"), "short")
  assert.equal(labelText("x".repeat(50)), "x".repeat(41) + "…")
})

test("viewportOf maps the screen to world coordinates with a margin; inViewport pads by the radius", () => {
  const vp = viewportOf({ x: 100, y: 50, k: 2 }, 800, 600, 80)
  assert.deepEqual(vp, { x0: -50 - 40, y0: -25 - 40, x1: 350 + 40, y1: 275 + 40 })
  assert.equal(inViewport(vp, 0, 0, 5), true)
  assert.equal(inViewport(vp, 500, 0, 5), false)
  assert.equal(inViewport(vp, 395, 0, 10), true)
  assert.equal(inViewport(vp, 395, 0, 1), false)
})
