import assert from "node:assert/strict"
import test from "node:test"
import { backgroundMenuItems, commandList, isPaletteQuery, matchCommands, nodeMenuItems } from "../lib/commands.ts"
import { stubT } from "./fixtures.ts"

const t = stubT
const ctx = {
  modes: [{ id: "full", label: "Full" }, { id: "authority", label: "Chain of authority" }],
  modeId: "full",
  portals: [{ id: "topics/it", title: "IT graph" }],
  inSubgraph: false,
  parentTitle: null,
  selected: null,
  dockOpen: false,
}

test("isPaletteQuery recognises the > prefix, with or without spaces", () => {
  assert.equal(isPaletteQuery(">"), true)
  assert.equal(isPaletteQuery("  > fit"), true)
  assert.equal(isPaletteQuery("fit"), false)
  assert.equal(isPaletteQuery(""), false)
})

test("commandList offers what the graph on screen allows, the active mode excluded", () => {
  const ids = commandList(ctx, t).map((c) => c.id)
  assert.deepEqual(ids, ["fit", "clear", "mode:authority", "enter:topics/it", "copy-link"])
  const deep = commandList({ ...ctx, inSubgraph: true, parentTitle: "Root", selected: { id: "x", title: "X", subgraph: false }, dockOpen: true }, t)
  assert.deepEqual(deep.map((c) => c.id), ["fit", "clear", "mode:authority", "enter:topics/it", "back", "open-selected", "pin-selected", "close-dock", "copy-link"])
  const portal = commandList({ ...ctx, selected: { id: "topics/it", title: "IT", subgraph: true } }, t)
  assert.ok(portal.some((c) => c.id === "explore-selected"))
})

test("matchCommands strips the prefix and matches label or keywords, everything on an empty query", () => {
  const all = commandList(ctx, t)
  assert.equal(matchCommands(all, ">").length, all.length)
  assert.deepEqual(matchCommands(all, "> AUTHOR").map((c) => c.id), ["mode:authority"])
  assert.deepEqual(matchCommands(all, ">it graph").map((c) => c.id), ["enter:topics/it"])
  assert.deepEqual(matchCommands(all, ">zzz"), [])
})

test("the node menu lists the note's actions and the portal's extra one; the background menu is short", () => {
  const plain = nodeMenuItems({ portal: false }, t)
  assert.deepEqual(plain.map((i) => i.id ?? "sep"), ["open", "open-new", "pin", "frame", "sep", "copy-link"])
  const portal = nodeMenuItems({ portal: true }, t)
  assert.deepEqual(portal.map((i) => i.id ?? "sep"), ["open", "open-new", "pin", "frame", "explore", "sep", "copy-link"])
  assert.deepEqual(backgroundMenuItems(t).map((i) => i.id), ["fit", "clear"])
  assert.ok(plain.every((i) => i.sep || typeof i.label === "string"))
})
