import assert from "node:assert/strict"
import test from "node:test"
import { findNode, focusKeys, resolveFocus } from "../lib/focus.js"
import { indexGraph } from "../lib/model.js"
import { RAW_CHILD, RAW_ROOT } from "./fixtures.js"

const root = indexGraph(RAW_ROOT)
const child = indexGraph(RAW_CHILD)

test("focusKeys trims slashes, lowercases and adds the decoded form when it differs", () => {
  assert.deepEqual(focusKeys("/Topics/IT/"), ["topics/it"])
  assert.deepEqual(focusKeys("a%C3%B1o"), ["a%c3%b1o", "año"])
  assert.deepEqual(focusKeys("100%"), ["100%"])
})

test("findNode matches the id exactly, then the page url, then the leaf", () => {
  const nodes = [...root.nodes.values()]
  assert.equal(findNode(nodes, ["it/roles/cio"]).id, "it/roles/cio")
  assert.equal(findNode([...child.nodes.values()], ["it/compute/batch"]).id, "compute/batch")
  assert.equal(findNode(nodes, ["council"]).id, "sources/council")
  assert.equal(findNode(nodes, ["nothing"]), null)
})

test("resolveFocus prefers the root and only then looks inside the published subgraphs", () => {
  const graphs = [{ key: "", model: root }, { key: "it", model: child }]
  assert.deepEqual(pick(resolveFocus(focusKeys("it/roles/cio"), graphs)), { key: "", id: "it/roles/cio" })
  assert.deepEqual(pick(resolveFocus(focusKeys("it/compute/batch"), graphs)), { key: "it", id: "compute/batch" })
  assert.deepEqual(pick(resolveFocus(focusKeys("compute/batch"), graphs)), { key: "it", id: "compute/batch" })
})

test("resolveFocus never enters a subgraph on a leaf-only match, and skips unloaded graphs", () => {
  const graphs = [{ key: "", model: root }, { key: "it", model: child }, { key: "x", model: null }]
  assert.equal(resolveFocus(focusKeys("batch"), graphs), null)
  assert.equal(resolveFocus(focusKeys("zzz"), graphs), null)
})

const pick = (hit) => (hit ? { key: hit.key, id: hit.node.id } : null)
