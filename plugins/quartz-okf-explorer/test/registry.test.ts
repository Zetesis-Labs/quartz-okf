import assert from "node:assert/strict"
import test from "node:test"
import { indexGraph } from "../lib/model.ts"
import { expandRegistry, loadGraphs, registryFrom } from "../lib/registry.ts"
import { RAW_CHILD, RAW_ROOT } from "./fixtures.ts"

const root = indexGraph(RAW_ROOT)
const child = indexGraph(RAW_CHILD)

test("registryFrom lists the root and every portal it publishes, with its path", () => {
  const reg = registryFrom(root, { title: "Root", url: "/static/okf-graph.json" })
  assert.deepEqual([...reg.keys()], ["", "it"])
  assert.deepEqual(reg.get(""), { key: "", title: "Root", url: "/static/okf-graph.json", path: [], model: root, error: null })
  assert.deepEqual(reg.get("it"), { key: "it", title: "IT graph", url: "/static/okf-subgraphs/it.json", path: ["it"], model: null, error: null })
})

test("expandRegistry attaches a loaded graph and registers its own portals under its path", () => {
  const reg = registryFrom(root, { title: "Root", url: "/g.json" })
  expandRegistry(reg, "it", child)
  assert.equal(reg.get("it").model, child)
  assert.deepEqual(reg.get("grid").path, ["it", "grid"])
  assert.equal(reg.get("grid").url, "/static/okf-subgraphs/grid.json")
  expandRegistry(reg, "it", child)
  assert.equal(reg.size, 3)
})

test("loadGraphs fetches only what is missing and records a named failure instead of throwing", async () => {
  const reg = registryFrom(root, { title: "Root", url: "/g.json" })
  reg.set("x", { key: "x", title: "Broken graph", url: "/x.json", path: ["x"], model: null, error: null })
  const calls = []
  const fetchGraph = async (url) => {
    calls.push(url)
    if (url.endsWith("x.json")) throw new Error("404")
    return RAW_CHILD
  }
  await loadGraphs(reg, ["", "it", "x"], fetchGraph)
  assert.deepEqual(calls, ["/static/okf-subgraphs/it.json", "/x.json"])
  assert.equal(reg.get("it").model.title, "IT graph")
  assert.equal(reg.get("grid").path.join("/"), "it/grid")
  assert.equal(reg.get("x").model, null)
  assert.equal(reg.get("x").error, "Broken graph: 404")
  await loadGraphs(reg, ["it"], fetchGraph)
  assert.equal(calls.length, 2)
})
