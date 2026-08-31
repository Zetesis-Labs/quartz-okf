import assert from "node:assert/strict"
import test from "node:test"
import { matchesGlob, verifySite } from "../lib/verify.ts"
import type { SiteFacts, VerifyFloors } from "../lib/types.ts"

const healthy: SiteFacts = {
  index: true,
  graph: { nodes: 26, edges: 72 },
  explorer: { present: true, assets: [{ name: "okf-explorer.js", present: true }] },
  page: { path: "index.html", widget: true, config: true },
  counts: [],
}

const codes = (problems: { code: string }[]) => problems.map((problem) => problem.code)

test("a healthy site has no problems", () => {
  assert.deepEqual(verifySite(healthy, {}), [])
})

test("a site without index.html is a problem", () => {
  assert.deepEqual(codes(verifySite({ ...healthy, index: false }, {})), ["verify/no-index"])
})

test("a graph that is missing or unreadable is a problem naming the document", () => {
  const problems = verifySite({ ...healthy, graph: null }, {})
  assert.deepEqual(codes(problems), ["verify/no-graph"])
  assert.match(problems[0].message, /okf-graph\.json/)
})

test("a graph without edges is a problem that points at the topology sections", () => {
  const problems = verifySite({ ...healthy, graph: { nodes: 12, edges: 0 } }, {})
  assert.deepEqual(codes(problems), ["verify/no-edges"])
  assert.match(problems[0].message, /Topology/)
})

test("an empty graph is reported as empty, not as edgeless", () => {
  assert.deepEqual(codes(verifySite({ ...healthy, graph: { nodes: 0, edges: 0 } }, {})), ["verify/empty-graph"])
})

test("an explorer asset referenced and not emitted is a problem naming the asset", () => {
  const explorer = { present: true, assets: [{ name: "okf-explorer.js", present: false }] }
  const problems = verifySite({ ...healthy, explorer }, {})
  assert.deepEqual(codes(problems), ["verify/missing-asset"])
  assert.match(problems[0].message, /okf-explorer\.js/)
})

test("a missing explorer page is a problem of its own", () => {
  assert.deepEqual(codes(verifySite({ ...healthy, explorer: null }, {})), ["verify/no-explorer"])
})

// Since 004 the explorer is a component: a page without its widget means the layout
// never placed it, and the site would publish a graph nobody can open.
test("a page without the component, or without its configuration, is a problem", () => {
  const noWidget = verifySite({ ...healthy, page: { path: "index.html", widget: false, config: true } }, {})
  assert.deepEqual(codes(noWidget), ["verify/no-component"])
  assert.match(noWidget[0].message, /index\.html/)

  const noConfig = verifySite({ ...healthy, page: { path: "index.html", widget: true, config: false } }, {})
  assert.deepEqual(codes(noConfig), ["verify/no-component-config"])
})

test("the floors the consumer declares are enforced and name both numbers", () => {
  const floors: VerifyFloors = { minNodes: 30, minEdges: 100 }
  const problems = verifySite(healthy, floors)
  assert.deepEqual(codes(problems), ["verify/below-floor", "verify/below-floor"])
  assert.match(problems[0].message, /26.*30/)
  assert.match(problems[1].message, /72.*100/)
})

test("a page count below its floor is a problem naming the glob", () => {
  const facts: SiteFacts = { ...healthy, counts: [{ glob: "libros/*.html", count: 90 }] }
  const problems = verifySite(facts, { pages: [{ glob: "libros/*.html", min: 95 }] })
  assert.deepEqual(codes(problems), ["verify/below-floor"])
  assert.match(problems[0].message, /libros\/\*\.html.*90.*95/)
})

test("a declared glob that was never counted is a problem, not a silent pass", () => {
  const problems = verifySite(healthy, { pages: [{ glob: "libros/*.html", min: 95 }] })
  assert.deepEqual(codes(problems), ["verify/uncounted"])
})

test("every problem is reported, not only the first", () => {
  const broken: SiteFacts = {
    index: false,
    graph: null,
    explorer: null,
    page: null,
    counts: [],
  }
  assert.deepEqual(codes(verifySite(broken, { minNodes: 1 })), [
    "verify/no-index",
    "verify/no-graph",
    "verify/no-explorer",
    "verify/no-page",
  ])
})

// A floor cannot be judged without the number it applies to; reporting the missing
// graph once is enough, and a second complaint about a number nobody could read is noise.
test("floors are not judged when the number they apply to could not be read", () => {
  const problems = verifySite({ ...healthy, graph: null }, { minNodes: 10, minEdges: 10 })
  assert.deepEqual(codes(problems), ["verify/no-graph"])
})

test("a site that publishes no widget on purpose is not asked for one", () => {
  const facts: SiteFacts = { ...healthy, page: { path: "index.html", widget: false, config: false } }
  assert.deepEqual(verifySite(facts, { component: false }), [])
})

test("a page floor's glob matches a directory and a whole tree", () => {
  assert.equal(matchesGlob("libros/*.html", "libros/uno.html"), true)
  assert.equal(matchesGlob("libros/*.html", "libros/serie/uno.html"), false)
  assert.equal(matchesGlob("libros/*.html", "otros/uno.html"), false)
  assert.equal(matchesGlob("**/*.html", "libros/serie/uno.html"), true)
  assert.equal(matchesGlob("*.html", "index.html"), true)
  assert.equal(matchesGlob("*.html", "libros/uno.html"), false)
})
