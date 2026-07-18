import assert from "node:assert/strict"
import test from "node:test"
import { buildGraph } from "../lib/graph.js"
import { PROFILE } from "../profile.js"

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
  assert.equal(graph.stats.edges, 3)
  assert.equal(graph.stats.declaredEdges, 2)
  assert.equal(graph.stats.derivedEdges, 1)
  assert.equal(graph.stats.unresolvedEdges, 1)
  assert.equal(graph.edges[0].target, "technology")
  assert.equal(graph.edges[0].iri.endsWith("#uses"), true)
  assert.deepEqual(graph.unresolved[0], {
    source: "cluster",
    target: "pending",
    label: "Depends on",
  })
})

test("exports additive node platform properties without changing graph v1", () => {
  const documents = [
    {
      id: "host",
      path: "host.md",
      reserved: false,
      frontmatter: {
        type: "node",
        title: "Host",
        node_kind: "physical",
        os_family: "proxmox-ve",
        os_version: "8.4",
        hardware_architecture: "amd64",
        hardware_memory: "64 GiB",
      },
      edges: [],
    },
    {
      id: "service",
      path: "service.md",
      reserved: false,
      frontmatter: { type: "service", title: "Service" },
      edges: [],
    },
  ]
  const graph = buildGraph(documents)

  assert.equal(graph.schema, "okf-graph/v1")
  assert.deepEqual(graph.propertyGroups[0].fields[0], {
    path: ["node_kind"],
    label: "Node kind",
  })
  assert.deepEqual(graph.nodes[0].properties, {
    node_kind: "physical",
    os: { family: "proxmox-ve", version: "8.4" },
    hardware: { architecture: "amd64", memory: "64 GiB" },
  })
  assert.equal("properties" in graph.nodes[1], false)
})

test("projects arbitrary profile fields without domain-specific core logic", () => {
  const profile = {
    ...PROFILE,
    propertyGroups: [
      {
        id: "service-runtime",
        appliesTo: ["service"],
        fields: [
          {
            source: "service_tier",
            graphPath: ["runtime", "tier"],
          },
        ],
      },
    ],
  }
  const graph = buildGraph(
    [
      {
        id: "service",
        path: "service.md",
        reserved: false,
        frontmatter: { type: "service", title: "Service", service_tier: "edge" },
        edges: [],
      },
    ],
    { profile },
  )

  assert.deepEqual(graph.nodes[0].properties, { runtime: { tier: "edge" } })
  assert.deepEqual(graph.propertyGroups, [
    {
      id: "service-runtime",
      label: "service-runtime",
      appliesTo: ["service"],
      fields: [{ path: ["runtime", "tier"], label: "service_tier" }],
    },
  ])
})

test("rejects unsafe profile graph paths", () => {
  const profile = {
    ...PROFILE,
    propertyGroups: [
      {
        id: "unsafe",
        appliesTo: ["service"],
        fields: [{ source: "value", graphPath: ["__proto__", "polluted"] }],
      },
    ],
  }

  assert.throws(
    () =>
      buildGraph(
        [
          {
            id: "service",
            path: "service.md",
            reserved: false,
            frontmatter: { type: "service", value: "yes" },
            edges: [],
          },
        ],
        { profile },
      ),
    /unsafe profile graphPath segment/,
  )
  assert.equal({}.polluted, undefined)
})

test("derives inverse edges once and never mirrors an explicit declaration", () => {
  const documents = [
    {
      id: "host",
      path: "host.md",
      reserved: false,
      frontmatter: { type: "node", title: "Host" },
      edges: [
        { label: "Uses", target: "tool" },
        { label: "Peers with", target: "peer" },
      ],
    },
    {
      id: "tool",
      path: "tool.md",
      reserved: false,
      frontmatter: { type: "technology", title: "Tool" },
      edges: [{ label: "Consumed by", target: "host" }],
    },
    {
      id: "peer",
      path: "peer.md",
      reserved: false,
      frontmatter: { type: "router", title: "Peer" },
      edges: [],
    },
  ]
  const graph = buildGraph(documents)
  const derived = graph.edges.filter((edge) => edge.derived)
  assert.deepEqual(
    derived.map((edge) => `${edge.source} ${edge.label} ${edge.target}`),
    ["peer Peers with host"],
  )
  assert.equal(derived[0].iri.endsWith("#peers-with"), true)
  assert.equal(graph.stats.declaredEdges, 3)
  assert.equal(graph.stats.derivedEdges, 1)
})
