import assert from "node:assert/strict"
import test from "node:test"
import {
  absolutiseChildGraph,
  federateGraph,
  isRemoteRepo,
  subgraphId,
  validateFederationConfig,
} from "../lib/federation.ts"
import { mergeProfile } from "../lib/profile.ts"
import { PROFILE } from "../lib/reference-profile.ts"

const profile = mergeProfile(PROFILE, {
  types: [...PROFILE.types, "unit", "graph", "policy", "source"],
  edgeLabels: ["Contains", "Part of", "Governs", "Supervised by"],
  inverseLabels: {
    Contains: "Part of",
    "Part of": "Contains",
    Governs: "Supervised by",
    "Supervised by": "Governs",
  },
})

const PORTAL = "topics/it-governance"
const ID = "it-governance"

function parentGraph() {
  return {
    schema: "okf-graph/v1",
    site: "CERN",
    baseUrl: "https://cern.example",
    types: profile.types,
    edgeLabels: profile.edgeLabels,
    propertyGroups: [],
    stats: { notes: 2, edges: 2, declaredEdges: 1, derivedEdges: 1, unresolvedEdges: 0 },
    nodes: [
      { slug: "cern", title: "CERN", type: "unit", tags: [], path: "cern.md" },
      { slug: PORTAL, title: "IT governance", type: "graph", tags: [], path: `${PORTAL}.md` },
    ],
    edges: [
      { source: "cern", target: PORTAL, label: "Contains", iri: `${PROFILE.id}#contains` },
      { source: PORTAL, target: "cern", label: "Part of", iri: `${PROFILE.id}#part-of`, derived: true },
    ],
    unresolved: [],
  }
}

function childGraph() {
  return {
    schema: "okf-graph/v1",
    site: "CERN IT Governance",
    baseUrl: "https://cern.zetesis.xyz",
    source_head: "def456",
    stats: { notes: 4, edges: 4, declaredEdges: 2, derivedEdges: 2, unresolvedEdges: 0 },
    nodes: [
      {
        slug: "identity/sso",
        title: "SSO",
        type: "service",
        tags: ["identity"],
        description: "Single sign-on.",
        path: "identity/sso.md",
        properties: { visibility: "open", entorno: "corporate" },
      },
      {
        slug: "identity/gms",
        title: "GMS",
        type: "service",
        tags: [],
        path: "identity/gms.md",
        properties: { visibility: "open" },
      },
      {
        slug: "security/oc5",
        title: "OC5",
        type: "policy",
        tags: [],
        path: "security/oc5.md",
        properties: { visibility: "internal" },
      },
      { slug: "sources/foo", title: "Source", type: "source", tags: [], path: "sources/foo.md" },
    ],
    edges: [
      { source: "identity/sso", target: "identity/gms", label: "Authorizes", iri: "child#authorizes" },
      { source: "identity/gms", target: "identity/sso", label: "Authorized by", iri: "child#authorized-by", derived: true },
      { source: "security/oc5", target: "identity/sso", label: "Governs", iri: "child#governs" },
      { source: "identity/sso", target: "security/oc5", label: "Supervised by", derived: true },
    ],
    unresolved: [],
  }
}

const DISPLAY = {
  typeColors: { service: "#10b981", policy: "#ef4444" },
  typeLabels: { service: "Service / System", policy: "Policy / Circular" },
  edgeColors: { Authorizes: "#6366f1" },
  modes: [{ id: "full", label: "Full view", edges: "*" }],
}

const ENTRY = {
  node: PORTAL,
  repo: "https://github.com/example/child-graph",
  ref: "def456",
  preview: { property: "visibility", equals: "open" },
}
const federation = (...entries) => ({ subgraphs: entries.length ? entries : [ENTRY] })
const child = (overrides = {}) => ({ [ID]: { graph: childGraph(), display: DISPLAY, ...overrides } })
const localSlugs = ["cern", PORTAL]
const codes = (items) => items.map((item) => item.code)

test("subgraph id defaults to the last segment of the portal slug", () => {
  assert.equal(subgraphId(ENTRY), ID)
  assert.equal(subgraphId({ ...ENTRY, id: "it" }), "it")
})

test("a repository is remote when it is a URL, local when it is a path", () => {
  for (const remote of ["https://github.com/x/y", "git@github.com:x/y.git", "ssh://git@host/x", "file:///tmp/x"]) {
    assert.equal(isRemoteRepo(remote), true, remote)
  }
  for (const local of ["../child", "/abs/child", "child"]) assert.equal(isRemoteRepo(local), false, local)
})

test("a complete declaration validates clean; edge defaults to Contains", () => {
  assert.deepEqual(validateFederationConfig(federation(), profile, localSlugs), [])
  assert.deepEqual(validateFederationConfig(federation({ ...ENTRY, repo: "../child", ref: undefined }), profile, localSlugs), [])
})

test("validation names every configuration problem with its subgraph id", () => {
  const cases = [
    [{ ...ENTRY, node: undefined }, "federation/node-required"],
    [{ ...ENTRY, node: "topics/missing" }, "federation/node-unknown"],
    [{ ...ENTRY, repo: undefined }, "federation/repo-required"],
    [{ ...ENTRY, ref: undefined }, "federation/ref-required"],
    [{ ...ENTRY, preview: undefined }, "federation/preview-required"],
    [{ ...ENTRY, preview: { property: "visibility" } }, "federation/preview-required"],
    [{ ...ENTRY, edge: "Runs on" }, "federation/edge-unknown"],
  ]
  for (const [entry, code] of cases) {
    const problems = validateFederationConfig(federation(entry), profile, localSlugs)
    assert.deepEqual(codes(problems), [code], code)
    assert.match(problems[0].message, /it-governance|\(unnamed\)|topics\/missing/)
  }
})

test("a mount path already used by the parent corpus is a problem", () => {
  const problems = validateFederationConfig(federation(), profile, [...localSlugs, `${ID}/intro`])
  assert.deepEqual(codes(problems), ["federation/mount-collision"])
  assert.match(problems[0].message, /it-governance\/intro/)
  const asNote = validateFederationConfig(federation(), profile, [...localSlugs, ID])
  assert.deepEqual(codes(asNote), ["federation/mount-collision"])
})

test("two declarations resolving to the same id are a problem", () => {
  const problems = validateFederationConfig(
    federation(ENTRY, { ...ENTRY, node: "cern", id: ID }),
    profile,
    localSlugs,
  )
  assert.deepEqual(codes(problems), ["federation/id-duplicate"])
  assert.match(problems[0].message, /it-governance/)
})

test("federates the open child notes as pages of the parent site, without mutating the input", () => {
  const parent = parentGraph()
  const before = structuredClone(parent)
  const result = federateGraph(parent, child(), federation(), profile)
  assert.deepEqual(parent, before)
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.warnings, [])

  const federated = result.graph.nodes.filter((node) => node.federated)
  assert.deepEqual(
    federated.map((node) => node.slug),
    [`${ID}/identity/sso`, `${ID}/identity/gms`],
  )
  assert.deepEqual(federated[0], {
    slug: `${ID}/identity/sso`,
    title: "SSO",
    type: "service",
    tags: ["identity"],
    description: "Single sign-on.",
    path: "identity/sso.md",
    properties: { visibility: "open", entorno: "corporate" },
    federated: ID,
    url: `/${ID}/identity/sso`,
  })
  assert.equal(result.graph.nodes.some((node) => node.slug.endsWith("security/oc5")), false)
})

test("marks the portal with the child's identity, mount and counts", () => {
  const result = federateGraph(parentGraph(), child(), federation(), profile)
  const portal = result.graph.nodes.find((node) => node.slug === PORTAL)
  assert.deepEqual(portal.subgraph, {
    id: ID,
    title: "CERN IT Governance",
    site: "https://cern.zetesis.xyz",
    mount: `/${ID}`,
    graph: `/static/okf-subgraphs/${ID}.json`,
    source_head: "def456",
    notes: 4,
    previewed: 2,
  })
  assert.deepEqual(result.graph.stats, {
    notes: 4,
    edges: 8,
    declaredEdges: 4,
    derivedEdges: 4,
    unresolvedEdges: 0,
    federatedNodes: 2,
    federatedEdges: 6,
  })
})

test("declares portal edges, derives their inverses and keeps child edges between open notes", () => {
  const result = federateGraph(parentGraph(), child(), federation(), profile)
  const added = result.graph.edges.filter((edge) => edge.federated === ID)
  const line = (edge) => `${edge.source} ${edge.label} ${edge.target}${edge.derived ? " (derived)" : ""}`
  assert.deepEqual(added.map(line), [
    `${PORTAL} Contains ${ID}/identity/sso`,
    `${PORTAL} Contains ${ID}/identity/gms`,
    `${ID}/identity/sso Authorizes ${ID}/identity/gms`,
    `${ID}/identity/gms Authorized by ${ID}/identity/sso (derived)`,
    `${ID}/identity/sso Part of ${PORTAL} (derived)`,
    `${ID}/identity/gms Part of ${PORTAL} (derived)`,
  ])
  assert.equal(added[0].iri, `${PROFILE.id}#contains`)
  assert.equal(added[2].iri, "child#authorizes")
  assert.equal(added[4].iri, `${PROFILE.id}#part-of`)
  assert.deepEqual(result.graph.unresolved, [])
  assert.deepEqual(result.graph.edges.slice(0, 2), parentGraph().edges)
})

test("uses the configured edge label", () => {
  const result = federateGraph(parentGraph(), child(), federation({ ...ENTRY, edge: "Governs" }), profile)
  const added = result.graph.edges.filter((edge) => edge.federated && !edge.derived && edge.source === PORTAL)
  assert.deepEqual(added.map((edge) => edge.label), ["Governs", "Governs"])
  const inverse = result.graph.edges.filter((edge) => edge.derived && edge.target === PORTAL && edge.federated)
  assert.deepEqual(inverse.map((edge) => edge.label), ["Supervised by", "Supervised by"])
})

test("an empty preview is a warning, never a silent portal", () => {
  const result = federateGraph(
    parentGraph(),
    child(),
    federation({ ...ENTRY, preview: { property: "visibility", equals: "public" } }),
    profile,
  )
  assert.deepEqual(codes(result.warnings), ["federation/preview-empty"])
  assert.equal(result.graph.nodes.find((node) => node.slug === PORTAL).subgraph.previewed, 0)
  assert.equal(result.graph.stats.federatedNodes, 0)
})

test("a mounted head that differs from the pinned ref, or a remote that moved on, are warnings", () => {
  const drifted = federateGraph(parentGraph(), child(), federation({ ...ENTRY, ref: "abc123" }), profile)
  assert.deepEqual(codes(drifted.warnings), ["federation/ref-drift"])
  assert.match(drifted.warnings[0].message, /it-governance.*abc123.*def456/)
  assert.deepEqual(drifted.problems, [])
  assert.equal(drifted.graph.stats.federatedNodes, 2)

  const behind = federateGraph(parentGraph(), child({ remoteHead: "999aaa" }), federation(), profile)
  assert.deepEqual(codes(behind.warnings), ["federation/ref-behind"])
  assert.match(behind.warnings[0].message, /it-governance.*def456.*999aaa/)

  const local = federateGraph(parentGraph(), child(), federation({ ...ENTRY, repo: "../child", ref: undefined }), profile)
  assert.deepEqual(local.warnings, [])
  assert.equal(local.graph.nodes.find((node) => node.slug === PORTAL).subgraph.source_head, "def456")
})

test("an unmounted child leaves a marked, empty portal and a warning naming the location", () => {
  const result = federateGraph(
    parentGraph(),
    { [ID]: { error: "not mounted", location: ENTRY.repo } },
    federation(),
    profile,
  )
  assert.deepEqual(codes(result.warnings), ["federation/child-unreachable"])
  assert.match(result.warnings[0].message, /it-governance.*child-graph.*not mounted/)
  const portal = result.graph.nodes.find((node) => node.slug === PORTAL)
  assert.deepEqual(portal.subgraph, {
    id: ID,
    mount: `/${ID}`,
    graph: `/static/okf-subgraphs/${ID}.json`,
    notes: 0,
    previewed: 0,
  })
  assert.deepEqual(result.subgraphs, [])
})

test("returns the subgraph copy addressed inside the parent site, carrying the child's display", () => {
  const result = federateGraph(parentGraph(), child(), federation(), profile)
  assert.equal(result.subgraphs.length, 1)
  assert.equal(result.subgraphs[0].id, ID)
  const copy = result.subgraphs[0].graph
  assert.deepEqual(copy.federatedFrom, { site: "https://cern.example", node: PORTAL, title: "CERN" })
  assert.equal(copy.nodes[0].url, `/${ID}/identity/sso`)
  assert.deepEqual(copy.display, DISPLAY)
})

test("the parent graph publishes the union of its children's display as a fallback", () => {
  const result = federateGraph(parentGraph(), child(), federation(), profile)
  assert.deepEqual(result.graph.display, {
    typeColors: DISPLAY.typeColors,
    typeLabels: DISPLAY.typeLabels,
    edgeColors: DISPLAY.edgeColors,
  })
  const bare = federateGraph(parentGraph(), { [ID]: { graph: childGraph() } }, federation(), profile)
  assert.equal("display" in bare.graph, false)
})

test("absolutiseChildGraph addresses every note under the mount and drops nested portals", () => {
  const graph = childGraph()
  graph.nodes[0].subgraph = { id: "nested" }
  graph.nodes[1].url = "https://elsewhere.example/gms"
  const before = structuredClone(graph)
  const copy = absolutiseChildGraph(graph, `/${ID}`, { site: "https://cern.example", node: PORTAL })
  assert.deepEqual(graph, before)
  assert.deepEqual(
    copy.nodes.map((node) => node.url),
    [
      `/${ID}/identity/sso`,
      "https://elsewhere.example/gms",
      `/${ID}/security/oc5`,
      `/${ID}/sources/foo`,
    ],
  )
  assert.equal("subgraph" in copy.nodes[0], false)
  assert.deepEqual(copy.federatedFrom, { site: "https://cern.example", node: PORTAL })
  assert.equal(copy.source_head, "def456")
})
