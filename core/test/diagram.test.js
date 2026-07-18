import assert from "node:assert/strict"
import test from "node:test"
import { buildScopeDiagram, weaveDiagram } from "../lib/diagram.js"

const graph = {
  nodes: [
    { slug: "cluster", title: "Cluster", type: "cluster" },
    { slug: "svc", title: "Service", type: "service" },
    { slug: "data", title: "Data", type: "datastore" },
    { slug: "sub", title: "Sub Store", type: "datastore" },
    { slug: "minio", title: "MinIO", type: "datastore" },
    { slug: "host", title: "Host", type: "node" },
  ],
  edges: [
    { source: "cluster", target: "svc", label: "Contains" },
    { source: "cluster", target: "data", label: "Contains", derived: true },
    { source: "data", target: "sub", label: "Contains" },
    { source: "svc", target: "data", label: "State in" },
    { source: "data", target: "minio", label: "Backed by" },
    { source: "cluster", target: "host", label: "Runs on" },
  ],
}

test("renders containment, data arrows, externals and type classes", () => {
  const mermaid = buildScopeDiagram(graph, "cluster")
  assert.match(mermaid, /subgraph n_cluster\["Cluster"\]/)
  assert.match(mermaid, /subgraph n_data\["Data"\]/)
  assert.match(mermaid, /n_sub\["Sub Store"\]/)
  assert.match(mermaid, /n_svc -->\|State in\| n_data/)
  assert.match(mermaid, /n_data -\.->\|Backed by\| n_minio/)
  assert.match(mermaid, /n_cluster -->\|Runs on\| n_host/)
  assert.match(mermaid, /classDef okf_service stroke:#008300/)
  assert.match(mermaid, /class n_host,n_minio okf_external/)
  assert.equal(buildScopeDiagram(graph, "svc"), null)
})

test("weaves idempotently and replaces an existing block in place", () => {
  const mermaid = buildScopeDiagram(graph, "cluster")
  const once = weaveDiagram("# Topology\n\n* **Contains**: [[svc]]\n", mermaid)
  assert.match(once, /# Structure/)
  assert.equal(weaveDiagram(once, mermaid), once)
  const updated = weaveDiagram(once, "flowchart TB\n  n_x[\"X\"]\n")
  assert.match(updated, /n_x\["X"\]/)
  assert.doesNotMatch(updated, /n_svc -->/)
  assert.equal((updated.match(/# Structure/g) ?? []).length, 1)
})
