import assert from "node:assert/strict"
import test from "node:test"
import { legacyRedirect, searchWithState, stateFromSearch } from "../lib/url-state.ts"

test("stateFromSearch reads the explorer flag, the graph and the focus", () => {
  assert.deepEqual(stateFromSearch(""), { open: false, graph: null, focus: null })
  assert.deepEqual(stateFromSearch("?explorer"), { open: true, graph: null, focus: null })
  assert.deepEqual(stateFromSearch("?explorer=1&graph=it&focus=it%2Fcompute%2Fbatch"), { open: true, graph: "it", focus: "it/compute/batch" })
  assert.deepEqual(stateFromSearch("?graph=it"), { open: false, graph: "it", focus: null })
  assert.deepEqual(stateFromSearch("?foo=bar"), { open: false, graph: null, focus: null })
})

test("searchWithState writes the state and keeps the page's other parameters", () => {
  assert.equal(searchWithState("", { open: true, graph: null, focus: null }), "?explorer")
  assert.equal(searchWithState("?foo=bar", { open: true, graph: "it", focus: "a/b" }), "?foo=bar&explorer&graph=it&focus=a%2Fb")
  assert.equal(searchWithState("?foo=bar&explorer&graph=it", { open: false, graph: null, focus: null }), "?foo=bar")
  assert.equal(searchWithState("?explorer&focus=x", { open: false, graph: null, focus: null }), "")
  assert.equal(searchWithState("?explorer&graph=it&focus=x", { open: true, graph: null, focus: null }), "?explorer")
})

test("legacyRedirect maps the old standalone page's parameters onto the in-page explorer", () => {
  assert.equal(legacyRedirect("?graph=it&focus=a%2Fb"), "/?explorer&graph=it&focus=a%2Fb")
  assert.equal(legacyRedirect(""), "/?explorer")
  assert.equal(legacyRedirect("?focus=x", "/index"), "/index?explorer&focus=x")
})
