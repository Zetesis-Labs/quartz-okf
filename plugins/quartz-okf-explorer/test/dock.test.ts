import assert from "node:assert/strict"
import test from "node:test"
import { activateTab, closeTab, dockOpen, EMPTY_DOCK, openTab, pinTab } from "../lib/dock.ts"

const note = (id: string) => ({ id, title: `Note ${id}`, type: "topic", url: `/${id}` })

test("openTab adds a temporary tab and activates it", () => {
  const d = openTab(EMPTY_DOCK, note("a"))
  assert.deepEqual(d.tabs, [{ id: "a", title: "Note a", type: "topic", url: "/a", pinned: false }])
  assert.equal(d.active, "a")
  assert.equal(dockOpen(d), true)
  assert.equal(dockOpen(EMPTY_DOCK), false)
})

test("only one temporary tab exists: the next note replaces it in place, pinned tabs stay", () => {
  let d = openTab(EMPTY_DOCK, note("a"))
  d = pinTab(d, "a")
  d = openTab(d, note("b"))
  d = openTab(d, note("c"))
  assert.deepEqual(d.tabs.map((t) => [t.id, t.pinned]), [["a", true], ["c", false]])
  assert.equal(d.active, "c")
})

test("openTab on a note already in the dock just activates it", () => {
  let d = pinTab(openTab(EMPTY_DOCK, note("a")), "a")
  d = openTab(d, note("b"))
  const before = d.tabs
  d = openTab(d, note("a"))
  assert.equal(d.tabs, before)
  assert.equal(d.active, "a")
})

test("pinTab toggles explicitly and leaves unknown ids alone", () => {
  let d = openTab(EMPTY_DOCK, note("a"))
  d = pinTab(d, "a", true)
  assert.equal(d.tabs[0].pinned, true)
  d = pinTab(d, "a", false)
  assert.equal(d.tabs[0].pinned, false)
  assert.equal(pinTab(d, "zz"), d)
})

test("closeTab activates the neighbour that takes its place, and the last close empties the dock", () => {
  let d = EMPTY_DOCK
  for (const id of ["a", "b", "c"]) d = pinTab(openTab(d, note(id)), id)
  d = activateTab(d, "b")
  d = closeTab(d, "b")
  assert.deepEqual(d.tabs.map((t) => t.id), ["a", "c"])
  assert.equal(d.active, "c")
  d = closeTab(d, "c")
  assert.equal(d.active, "a")
  d = closeTab(d, "a")
  assert.deepEqual(d, EMPTY_DOCK)
  assert.equal(closeTab(d, "nope"), d)
})

test("activateTab ignores ids that are not open", () => {
  const d = openTab(EMPTY_DOCK, note("a"))
  assert.equal(activateTab(d, "b"), d)
})
