import assert from "node:assert/strict"
import test from "node:test"
import { buildGraph, deriveInverseEdges } from "../lib/graph.ts"
import { PROFILE } from "../lib/reference-profile.ts"

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
      frontmatter: { type: "technology", title: "Technology", aliases: ["tech"] },
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
  assert.deepEqual(graph.nodes[1].aliases, ["tech"])
  assert.equal("aliases" in graph.nodes[0], false)
  assert.deepEqual(graph.unresolved[0], {
    source: "cluster",
    target: "pending",
    label: "Depends on",
  })
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
            label: "Service tier",
            graphPath: ["runtime", "tier"],
          },
          {
            source: "runtime_family",
            label: "Runtime",
            graphPath: ["runtime", "software", "family"],
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
        frontmatter: {
          type: "service",
          title: "Service",
          service_tier: "edge",
          runtime_family: "example-runtime",
        },
        edges: [],
      },
    ],
    { profile },
  )

  assert.equal(graph.schema, "okf-graph/v1")
  assert.deepEqual(graph.nodes[0].properties, {
    runtime: {
      tier: "edge",
      software: { family: "example-runtime" },
    },
  })
  assert.deepEqual(graph.propertyGroups, [
    {
      id: "service-runtime",
      label: "service-runtime",
      appliesTo: ["service"],
      fields: [
        { path: ["runtime", "tier"], label: "Service tier" },
        { path: ["runtime", "software", "family"], label: "Runtime" },
      ],
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

const INVERSE_FIXTURE = [
  {
    id: "app",
    path: "app.md",
    reserved: false,
    frontmatter: { type: "application", title: "App" },
    edges: [
      { label: "Runs on", target: "cluster" },
      { label: "Depends on", target: "db" },
      { label: "Uses", target: "missing" },
    ],
  },
  {
    id: "cluster",
    path: "cluster.md",
    reserved: false,
    frontmatter: { type: "cluster", title: "Cluster" },
    edges: [{ label: "Hosts", target: "app" }],
  },
  {
    id: "db",
    path: "db.md",
    reserved: false,
    frontmatter: { type: "datastore", title: "DB" },
    edges: [{ label: "Backed by", target: "cluster" }],
  },
]

test("characterization: edge list of declared, mirrored, unmirrored and unresolved edges", () => {
  const graph = buildGraph(INVERSE_FIXTURE)
  assert.deepEqual(graph.edges, [
    { source: "app", target: "cluster", label: "Runs on", iri: `${PROFILE.id}#runs-on` },
    { source: "app", target: "db", label: "Depends on", iri: `${PROFILE.id}#depends-on` },
    { source: "app", target: null, label: "Uses", iri: `${PROFILE.id}#uses`, targetRaw: "missing" },
    { source: "cluster", target: "app", label: "Hosts", iri: `${PROFILE.id}#hosts` },
    { source: "db", target: "cluster", label: "Backed by", iri: `${PROFILE.id}#backed-by` },
  ])
  assert.deepEqual(graph.stats, {
    notes: 3,
    edges: 5,
    declaredEdges: 5,
    derivedEdges: 0,
    unresolvedEdges: 1,
  })
})

test("deriveInverseEdges is the derivation buildGraph uses, exposed for other composers", () => {
  const declared = [
    { source: "app", target: "cluster", label: "Runs on", iri: `${PROFILE.id}#runs-on` },
    { source: "cluster", target: "app", label: "Hosts", iri: `${PROFILE.id}#hosts` },
    { source: "app", target: "tool", label: "Uses", iri: `${PROFILE.id}#uses` },
    { source: "app", target: null, label: "Uses", iri: `${PROFILE.id}#uses`, targetRaw: "x" },
    { source: "app", target: "db", label: "Depends on", iri: `${PROFILE.id}#depends-on` },
  ]
  const derived = deriveInverseEdges(declared, PROFILE)
  assert.deepEqual(derived, [
    { source: "tool", target: "app", label: "Consumed by", iri: `${PROFILE.id}#consumed-by`, derived: true },
  ])
  const viaGraph = buildGraph([
    {
      id: "app",
      path: "app.md",
      reserved: false,
      frontmatter: { type: "application", title: "App" },
      edges: [{ label: "Uses", target: "tool" }],
    },
    { id: "tool", path: "tool.md", reserved: false, frontmatter: { type: "technology", title: "T" }, edges: [] },
  ])
  assert.deepEqual(viaGraph.edges.filter((edge) => edge.derived), derived)
})

test("records the site's canonical origin when given, and nothing otherwise", () => {
  const documents = [
    { id: "a", path: "a.md", reserved: false, frontmatter: { type: "concept", title: "A" }, edges: [] },
  ]
  assert.equal(buildGraph(documents, { baseUrl: "https://example.org" }).baseUrl, "https://example.org")
  assert.equal("baseUrl" in buildGraph(documents), false)
})

const CATALOG = [
  {
    id: "standards/arm",
    path: "standards/arm.md",
    reserved: false,
    frontmatter: { type: "report", title: "Catalogue", tags: ["standards"] },
    edges: [],
    rows: [
      {
        id: "AP001",
        anchor: "ap001",
        slug: "standards/arm#ap001",
        type: "concept",
        title: "AP001 — Student Attraction",
        label: "AP001",
        edges: [{ label: "Part of", target: "standards/arm" }],
        table: 1,
      },
      {
        id: "AC001",
        anchor: "ac001",
        slug: "standards/arm#ac001",
        type: "technology",
        title: "AC001 — Student Recruitment",
        label: "AC001",
        description: "Attracting students.",
        properties: { gloss: "Leads to enrolment." },
        edges: [{ label: "Part of", target: "AP001" }],
        table: 2,
      },
    ],
  },
  {
    id: "analysis/gap",
    path: "analysis/gap.md",
    reserved: false,
    frontmatter: { type: "report", title: "Gap" },
    edges: [],
    annotations: [
      { ref: "AC001", edge: "About", properties: { state: "core" }, table: 1 },
      { ref: "AC404", edge: "About", properties: { state: "core" }, table: 1 },
    ],
  },
]

test("emits one node per catalog row, addressed inside its note's page", () => {
  const graph = buildGraph(CATALOG)
  const row = graph.nodes.find((node) => node.slug === "standards/arm#ac001")
  assert.deepEqual(row, {
    slug: "standards/arm#ac001",
    title: "AC001 — Student Recruitment",
    label: "AC001",
    type: "technology",
    description: "Attracting students.",
    path: "standards/arm.md",
    aliases: ["AC001"],
    properties: { gloss: "Leads to enrolment.", state: "core" },
    url: "/standards/arm#ac001",
    row: { note: "standards/arm", anchor: "ac001" },
  })
  assert.equal(graph.stats.rows, 2)
  assert.equal(graph.stats.notes, graph.nodes.length)
})

test("row edges resolve like any other edge and derive their inverse", () => {
  const graph = buildGraph(CATALOG)
  const declared = graph.edges.filter((edge) => edge.source === "standards/arm#ac001")
  assert.deepEqual(
    declared.map((edge) => [edge.label, edge.target]),
    [["Part of", "standards/arm#ap001"]],
  )
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.source === "standards/arm#ap001" &&
        edge.target === "standards/arm#ac001" &&
        edge.label === "Contains" &&
        edge.derived,
    ),
  )
})

test("an annotation merges its properties into the row and connects the annotating note", () => {
  const graph = buildGraph(CATALOG)
  assert.ok(
    graph.edges.some(
      (edge) => edge.source === "analysis/gap" && edge.target === "standards/arm#ac001" && edge.label === "About",
    ),
  )
  assert.deepEqual(
    graph.unresolved.filter((edge) => edge.target === "AC404"),
    [{ source: "analysis/gap", target: "AC404", label: "About" }],
  )
})

test("an annotation may rewrite the description of the node it annotates", () => {
  const documents = [
    {
      id: "standards/arm",
      path: "standards/arm.md",
      reserved: false,
      frontmatter: { type: "report", title: "Catalogue" },
      edges: [],
      rows: [
        {
          id: "AC001",
          anchor: "ac001",
          slug: "standards/arm#ac001",
          type: "technology",
          title: "AC001 — Student Recruitment",
          label: "AC001",
          description: "The standard's own wording.",
          properties: { rank: "leaf" },
          edges: [],
          table: 1,
        },
      ],
    },
    {
      id: "analysis/gap",
      path: "analysis/gap.md",
      reserved: false,
      frontmatter: { type: "report", title: "Gap" },
      edges: [],
      annotations: [
        {
          ref: "AC001",
          edge: "About",
          description: "What this project decided to do with it.",
          properties: { state: "core" },
          table: 1,
        },
      ],
    },
  ]
  const row = buildGraph(documents).nodes.find((node) => node.slug === "standards/arm#ac001")
  assert.equal(row?.description, "What this project decided to do with it.")
  assert.deepEqual(row?.properties, { rank: "leaf", state: "core" })
})

test("a link in the prose to a row is a citation; one to a note is just prose", () => {
  const profile = { ...PROFILE, bodyLinks: "Cites" }
  const body = `# Análisis

Nos ocupa [[standards/arm#AC001]], y [[otra]] queda como prosa; [[standards/arm#AC404]] no existe.
`
  const documents = [
    {
      id: "standards/arm",
      path: "standards/arm.md",
      reserved: false,
      frontmatter: { type: "report", title: "Catálogo" },
      edges: [],
      rows: [
        {
          id: "AC001",
          anchor: "ac001",
          slug: "standards/arm#ac001",
          type: "technology",
          title: "AC001",
          label: "AC001",
          edges: [],
          table: 1,
        },
      ],
    },
    { id: "otra", path: "otra.md", reserved: false, frontmatter: { type: "concept", title: "Otra" }, edges: [] },
    {
      id: "analisis",
      path: "analisis.md",
      reserved: false,
      frontmatter: { type: "report", title: "Análisis" },
      body,
      source: body,
      edges: [
        { label: "Cites", target: "standards/arm#AC001", fromBody: true },
        { label: "Cites", target: "otra", fromBody: true },
        { label: "Cites", target: "standards/arm#AC404", fromBody: true },
      ],
    },
  ]
  const graph = buildGraph(documents, { profile })
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "analisis").map((e) => e.target),
    ["standards/arm#ac001"],
    "sólo el enlace que nombra una fila declara una relación",
  )
  assert.deepEqual(graph.unresolved, [], "un enlace de la prosa que no alcanza una fila no es un error")
})
