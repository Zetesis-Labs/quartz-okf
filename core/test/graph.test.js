import assert from "node:assert/strict"
import test from "node:test"
import { buildGraph } from "../lib/graph.js"

test("exports typed nodes, typed edges, and unresolved evidence", () => {
  const documents = [
    {
      id: "cluster",
      path: "cluster.md",
      reserved: false,
      frontmatter: { type: "cluster", title: "Cluster", tags: ["fleet"] },
      edges: [
        { label: "Uses", target: "technology" },
        { label: "Depends on", target: "pending" },
      ],
    },
    {
      id: "technology",
      path: "technology.md",
      reserved: false,
      frontmatter: { type: "technology", title: "Technology" },
      edges: [],
    },
  ]
  const graph = buildGraph(documents, {
    sourceHead: "abc",
    lastMaintainedHead: "abc",
    stale: false,
  })
  assert.equal(graph.stats.notes, 2)
  assert.equal(graph.stats.edges, 2)
  assert.equal(graph.stats.unresolvedEdges, 1)
  assert.equal(graph.edges[0].target, "technology")
  assert.equal(graph.edges[0].iri.endsWith("#uses"), true)
  assert.deepEqual(graph.unresolved[0], {
    source: "cluster",
    target: "pending",
    label: "Depends on",
  })
})
