import assert from "node:assert/strict"
import test from "node:test"
import { frameFor, visibleRect, wheelStep } from "../lib/viewport.ts"

test("wheelStep treats a line-mode wheel (Firefox) as one notch, sign only", () => {
  assert.equal(wheelStep({ deltaMode: 1, deltaY: 3, ctrlKey: false }), -0.2)
  assert.equal(wheelStep({ deltaMode: 1, deltaY: -1, ctrlKey: false }), 0.2)
})

test("wheelStep keeps a pixel-mode wheel (trackpad) proportional, capped at a notch's worth", () => {
  assert.equal(wheelStep({ deltaMode: 0, deltaY: 40, ctrlKey: false }), -40 * 0.002)
  assert.equal(wheelStep({ deltaMode: 0, deltaY: 4000, ctrlKey: false }), -120 * 0.002)
  assert.equal(wheelStep({ deltaMode: 0, deltaY: -4000, ctrlKey: false }), 120 * 0.002)
})

test("wheelStep scales a page-mode wheel by the canvas height and a pinch by ten", () => {
  assert.equal(wheelStep({ deltaMode: 2, deltaY: 1, ctrlKey: false }, { height: 50 }), -50 * 0.002)
  assert.equal(wheelStep({ deltaMode: 1, deltaY: 1, ctrlKey: true }), -0.2 * 10)
})

const rect = (over) => ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, ...over })

test("visibleRect keeps the canvas clear of the stack, the top bar and an open dock", () => {
  const v = visibleRect({
    width: 1000, height: 800,
    stack: rect({ width: 260, right: 260 }),
    north: rect({ bottom: 40 }),
    dock: rect({ width: 400, left: 600 }),
  })
  assert.deepEqual(v, { x0: 272, y0: 52, x1: 588, y1: 788 })
})

test("visibleRect puts a wide stack along the bottom and ignores a dock that covers the screen", () => {
  const v = visibleRect({
    width: 390, height: 800,
    stack: rect({ width: 390, top: 600 }),
    north: rect({ bottom: 40 }),
    dock: rect({ width: 390, left: 0 }),
  })
  assert.deepEqual(v, { x0: 12, y0: 52, x1: 378, y1: 588 })
})

test("visibleRect gives the whole canvas back when the hole left is too small to frame anything", () => {
  const v = visibleRect({ width: 300, height: 300, stack: rect({ width: 250, right: 250 }), north: rect({ bottom: 250 }) })
  assert.deepEqual(v, { x0: 12, y0: 12, x1: 288, y1: 288 })
})

test("frameFor centres the points' box in the rect at the largest scale that fits, within the bounds", () => {
  const v = { x0: 0, y0: 0, x1: 400, y1: 300 }
  const f = frameFor([{ x: 0, y: 0 }, { x: 180, y: 50 }], v, { pad: 40 })
  assert.equal(f.k, 2)
  assert.deepEqual([f.cx, f.cy, f.vx, f.vy], [90, 25, 200, 150])
  assert.equal(frameFor([{ x: 5, y: 5 }], v).k, 2.4)
  assert.equal(frameFor([{ x: 0, y: 0 }, { x: 10000, y: 0 }], v).k, 0.15)
  assert.equal(frameFor([{ x: 5, y: 5 }], v, { maxScale: 1.2 }).k, 1.2)
  assert.equal(frameFor([], v), null)
})
