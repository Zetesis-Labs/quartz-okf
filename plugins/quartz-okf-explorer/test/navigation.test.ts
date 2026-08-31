import assert from "node:assert/strict"
import test from "node:test"
import {
  backTo,
  currentKey,
  currentPath,
  directEntry,
  enterLevel,
  inSubgraph,
  levelOf,
  popAction,
  ROOT_LEVELS,
  trailFor,
  withRootContext,
} from "../lib/navigation.ts"

const root = { url: "/static/okf-graph.json", selectedId: "topics/it", title: "Root", modeId: "full", id: null }
const it = { url: "/static/okf-subgraphs/it.json", selectedId: "topics/grid", title: "IT", modeId: "ops", id: "it" }

test("the root has no trail, no key and is not a subgraph", () => {
  assert.equal(inSubgraph(ROOT_LEVELS), false)
  assert.deepEqual(trailFor(ROOT_LEVELS, "Root"), [])
  assert.deepEqual(currentPath(ROOT_LEVELS), [])
  assert.equal(currentKey(ROOT_LEVELS), "")
})

test("enterLevel pushes where the reader was and names the graph entered", () => {
  const one = enterLevel(ROOT_LEVELS, root, "it")
  assert.equal(inSubgraph(one), true)
  assert.equal(one.currentId, "it")
  assert.deepEqual(trailFor(one, "IT"), [{ id: "it", title: "IT" }])
  const two = enterLevel(one, it, "grid")
  assert.deepEqual(trailFor(two, "Grid"), [{ id: "it", title: "IT" }, { id: "grid", title: "Grid" }])
  assert.deepEqual(currentPath(two), ["it", "grid"])
  assert.equal(currentKey(two), "grid")
})

test("backTo truncates the stack to the level and hands back where to land", () => {
  const two = enterLevel(enterLevel(ROOT_LEVELS, root, "it"), it, "grid")
  const back = backTo(two, 1)
  assert.ok(back)
  assert.equal(back.destination, it)
  assert.equal(back.levels.currentId, "it")
  assert.deepEqual(trailFor(back.levels, "IT"), [{ id: "it", title: "IT" }])
  const home = backTo(two, 0)
  assert.ok(home)
  assert.equal(home.destination, root)
  assert.deepEqual(home.levels, ROOT_LEVELS)
  assert.equal(backTo(two, 2), null)
  assert.equal(backTo(two, -1), null)
})

test("levelOf finds the stack entry of a graph id, the root being null", () => {
  const two = enterLevel(enterLevel(ROOT_LEVELS, root, "it"), it, "grid")
  assert.equal(levelOf(two, null), 0)
  assert.equal(levelOf(two, "it"), 1)
  assert.equal(levelOf(two, "grid"), -1)
  assert.equal(levelOf(ROOT_LEVELS, null), -1)
})

test("directEntry opens inside a subgraph with a synthetic root level, completed from federatedFrom", () => {
  const d = directEntry("/static/okf-graph.json", "full", "it")
  assert.equal(d.currentId, "it")
  assert.deepEqual(d.stack, [{ url: "/static/okf-graph.json", selectedId: null, title: null, modeId: "full", id: null }])
  const filled = withRootContext(d, { site: "x", node: "topics/it", title: "Root" })
  assert.equal(filled.stack[0].selectedId, "topics/it")
  assert.equal(filled.stack[0].title, "Root")
  assert.equal(withRootContext(d, null).stack[0].selectedId, null)
})

test("popAction turns a history entry into the move that reproduces it", () => {
  const two = enterLevel(enterLevel(ROOT_LEVELS, root, "it"), it, "grid")
  assert.deepEqual(popAction(two, { open: false, graph: null, focus: null }), { close: true })
  assert.deepEqual(popAction(two, { open: true, graph: "grid", focus: null }), { none: true })
  assert.deepEqual(popAction(two, { open: true, graph: "it", focus: null }), { back: 1 })
  assert.deepEqual(popAction(two, { open: true, graph: null, focus: null }), { back: 0 })
  assert.deepEqual(popAction(two, { open: true, graph: "other", focus: null }), { enter: "other" })
  assert.deepEqual(popAction(ROOT_LEVELS, { open: true, graph: null, focus: null }), { none: true })
})
