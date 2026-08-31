import assert from "node:assert/strict"
import test from "node:test"
import { activateTab, closeTab, dockOpen, EMPTY_DOCK, hideDock, openTab, pinTab, pinnedTabs } from "../lib/dock.ts"

const note = (id: string) => ({ id, title: `Note ${id}`, type: "topic", url: `/${id}` })

test("openTab shows the note as the dock's temporary tab", () => {
  const d = openTab(EMPTY_DOCK, note("a"))
  assert.deepEqual(d.tabs, [{ id: "a", title: "Note a", type: "topic", url: "/a", pinned: false }])
  assert.equal(d.active, "a")
  assert.equal(dockOpen(d), true)
  assert.equal(dockOpen(EMPTY_DOCK), false)
})

test("only one temporary tab exists: the next note replaces it, pinned tabs stay in the bar", () => {
  let d = openTab(EMPTY_DOCK, note("a"))
  d = pinTab(d, "a")
  d = openTab(d, note("b"))
  d = openTab(d, note("c"))
  assert.deepEqual(d.tabs.map((t) => [t.id, t.pinned]), [["a", true], ["c", false]])
  assert.equal(d.active, "c")
  assert.deepEqual(pinnedTabs(d).map((t) => t.id), ["a"])
})

test("openTab on a note already in the dock just shows it", () => {
  let d = pinTab(openTab(EMPTY_DOCK, note("a")), "a")
  d = openTab(d, note("b"))
  const before = d.tabs
  d = openTab(d, note("a"))
  assert.equal(d.tabs, before)
  assert.equal(d.active, "a")
})

test("pinTab pins and unpins; unpinning makes the note the one temporary tab", () => {
  let d = openTab(EMPTY_DOCK, note("a"))
  d = pinTab(d, "a", true)
  assert.equal(d.tabs[0].pinned, true)
  d = openTab(d, note("b"))
  d = pinTab(d, "a", false)
  assert.deepEqual(d.tabs.map((t) => [t.id, t.pinned]), [["a", false]])
  assert.equal(d.active, "a")
  assert.equal(pinTab(d, "zz"), d)
})

test("closing the shown tab hides the dock; the pinned ones stay in the bar", () => {
  let d = EMPTY_DOCK
  for (const id of ["a", "b"]) d = pinTab(openTab(d, note(id)), id)
  d = openTab(d, note("c"))
  d = closeTab(d, "c")
  assert.deepEqual(d.tabs.map((t) => t.id), ["a", "b"])
  assert.equal(d.active, null)
  assert.equal(dockOpen(d), false)
  d = activateTab(d, "b")
  assert.equal(dockOpen(d), true)
  d = closeTab(d, "a")
  assert.deepEqual(d.tabs.map((t) => t.id), ["b"])
  assert.equal(d.active, "b")
  assert.equal(closeTab(d, "nope"), d)
})

test("hideDock drops the temporary tab and keeps the pinned ones", () => {
  let d = pinTab(openTab(EMPTY_DOCK, note("a")), "a")
  d = openTab(d, note("b"))
  d = hideDock(d)
  assert.deepEqual(d.tabs.map((t) => t.id), ["a"])
  assert.equal(d.active, null)
  assert.deepEqual(hideDock(EMPTY_DOCK), EMPTY_DOCK)
})

test("activateTab ignores ids that are not open", () => {
  const d = openTab(EMPTY_DOCK, note("a"))
  assert.equal(activateTab(d, "b"), d)
})
