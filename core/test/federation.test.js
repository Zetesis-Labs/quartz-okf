import assert from "node:assert/strict"
import test from "node:test"
import {
  absolutiseChildGraph,
  federateGraph,
  subgraphId,
  validateFederationConfig,
} from "../lib/federation.js"
import { mergeProfile } from "../lib/profile.js"
import { PROFILE } from "../profile.js"

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

const ENTRY = {
  node: PORTAL,
  graph: "https://cern.zetesis.xyz/static/okf-graph.json",
  preview: { property: "visibility", equals: "open" },
}
const federation = (...entries) => ({ subgraphs: entries.length ? entries : [ENTRY] })
const localSlugs = ["cern", PORTAL]
const codes = (problems) => problems.map((problem) => problem.code)

test("subgraph id defaults to the last segment of the portal slug", () => {
  assert.equal(subgraphId(ENTRY), "it-governance")
  assert.equal(subgraphId({ ...ENTRY, id: "it" }), "it")
})

test("a complete declaration validates clean; edge defaults to Contains", () => {
  assert.deepEqual(validateFederationConfig(federation(), profile, localSlugs), [])
})

test("validation names every configuration problem with its subgraph id", () => {
  const cases = [
    [{ ...ENTRY, node: undefined }, "federation/node-required"],
    [{ ...ENTRY, node: "topics/missing" }, "federation/node-unknown"],
    [{ ...ENTRY, graph: undefined }, "federation/graph-required"],
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

test("two declarations resolving to the same id are a problem", () => {
  const problems = validateFederationConfig(
    federation(ENTRY, { ...ENTRY, node: "cern", id: "it-governance" }),
    profile,
    localSlugs,
  )
  assert.deepEqual(codes(problems), ["federation/id-duplicate"])
  assert.match(problems[0].message, /it-governance/)
})

test("federates the open child notes around the portal without mutating the input", () => {
  const parent = parentGraph()
  const before = structuredClone(parent)
  const result = federateGraph(parent, { "it-governance": { graph: childGraph() } }, federation(), profile)
  assert.deepEqual(parent, before)
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.warnings, [])

  const federated = result.graph.nodes.filter((node) => node.federated)
  assert.deepEqual(
    federated.map((node) => node.slug),
    ["it-governance:identity/sso", "it-governance:identity/gms"],
  )
  assert.deepEqual(federated[0], {
    slug: "it-governance:identity/sso",
    title: "SSO",
    type: "service",
    tags: ["identity"],
    description: "Single sign-on.",
    path: "identity/sso.md",
    properties: { visibility: "open", entorno: "corporate" },
    federated: "it-governance",
    url: "https://cern.zetesis.xyz/identity/sso",
  })
  assert.equal(result.graph.nodes.some((node) => node.slug.endsWith("security/oc5")), false)
})

test("marks the portal with the child's identity and counts", () => {
  const result = federateGraph(parentGraph(), { "it-governance": { graph: childGraph() } }, federation(), profile)
  const portal = result.graph.nodes.find((node) => node.slug === PORTAL)
  assert.deepEqual(portal.subgraph, {
    id: "it-governance",
    title: "CERN IT Governance",
    site: "https://cern.zetesis.xyz",
    graph: "/static/okf-subgraphs/it-governance.json",
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
  const result = federateGraph(parentGraph(), { "it-governance": { graph: childGraph() } }, federation(), profile)
  const added = result.graph.edges.filter((edge) => edge.federated === "it-governance")
  const line = (edge) => `${edge.source} ${edge.label} ${edge.target}${edge.derived ? " (derived)" : ""}`
  assert.deepEqual(added.map(line), [
    "topics/it-governance Contains it-governance:identity/sso",
    "topics/it-governance Contains it-governance:identity/gms",
    "it-governance:identity/sso Authorizes it-governance:identity/gms",
    "it-governance:identity/gms Authorized by it-governance:identity/sso (derived)",
    "it-governance:identity/sso Part of topics/it-governance (derived)",
    "it-governance:identity/gms Part of topics/it-governance (derived)",
  ])
  assert.equal(added[0].iri, `${PROFILE.id}#contains`)
  assert.equal(added[2].iri, "child#authorizes")
  assert.equal(added[4].iri, `${PROFILE.id}#part-of`)
  assert.deepEqual(result.graph.unresolved, [])
  assert.deepEqual(result.graph.edges.slice(0, 2), parentGraph().edges)
})

test("uses the configured edge label and an explicit site over the child's baseUrl", () => {
  const entry = { ...ENTRY, edge: "Governs", site: "https://mirror.example/" }
  const result = federateGraph(parentGraph(), { "it-governance": { graph: childGraph() } }, federation(entry), profile)
  const added = result.graph.edges.filter((edge) => edge.federated && !edge.derived && edge.source === PORTAL)
  assert.deepEqual(added.map((edge) => edge.label), ["Governs", "Governs"])
  const inverse = result.graph.edges.filter((edge) => edge.derived && edge.target === PORTAL && edge.federated)
  assert.deepEqual(inverse.map((edge) => edge.label), ["Supervised by", "Supervised by"])
  const node = result.graph.nodes.find((candidate) => candidate.federated)
  assert.equal(node.url, "https://mirror.example/identity/sso")
})

test("needs a site from somewhere and refuses prefixed slugs that already exist", () => {
  const child = childGraph()
  delete child.baseUrl
  const noSite = federateGraph(parentGraph(), { "it-governance": { graph: child } }, federation(), profile)
  assert.deepEqual(codes(noSite.problems), ["federation/site-required"])
  assert.equal(noSite.graph.nodes.some((node) => node.federated), false)

  const parent = parentGraph()
  parent.nodes.push({ slug: "it-governance:identity/sso", title: "Clash", type: "unit", tags: [], path: "x.md" })
  const clash = federateGraph(parent, { "it-governance": { graph: childGraph() } }, federation(), profile)
  assert.deepEqual(codes(clash.problems), ["federation/slug-collision"])
  assert.match(clash.problems[0].message, /it-governance:identity\/sso/)
})

test("an empty preview is a warning, never a silent portal", () => {
  const result = federateGraph(
    parentGraph(),
    { "it-governance": { graph: childGraph() } },
    federation({ ...ENTRY, preview: { property: "visibility", equals: "public" } }),
    profile,
  )
  assert.deepEqual(codes(result.warnings), ["federation/preview-empty"])
  assert.equal(result.graph.nodes.find((node) => node.slug === PORTAL).subgraph.previewed, 0)
  assert.equal(result.graph.stats.federatedNodes, 0)
})

test("a pinned head that drifted is a warning naming both heads; no pin, no check", () => {
  const drifted = federateGraph(
    parentGraph(),
    { "it-governance": { graph: childGraph() } },
    federation({ ...ENTRY, pin: "abc123" }),
    profile,
  )
  assert.deepEqual(codes(drifted.warnings), ["federation/pin-drift"])
  assert.match(drifted.warnings[0].message, /it-governance.*abc123.*def456/)
  assert.deepEqual(drifted.problems, [])
  assert.equal(drifted.graph.stats.federatedNodes, 2)

  const unpinned = federateGraph(parentGraph(), { "it-governance": { graph: childGraph() } }, federation(), profile)
  assert.deepEqual(unpinned.warnings, [])
  assert.equal(unpinned.graph.nodes.find((node) => node.slug === PORTAL).subgraph.source_head, "def456")
})

test("an unreachable child leaves a marked, empty portal and a warning naming the location", () => {
  const result = federateGraph(
    parentGraph(),
    { "it-governance": { error: "HTTP 503", location: ENTRY.graph } },
    federation(),
    profile,
  )
  assert.deepEqual(codes(result.warnings), ["federation/child-unreachable"])
  assert.match(result.warnings[0].message, /it-governance.*okf-graph\.json.*HTTP 503/)
  const portal = result.graph.nodes.find((node) => node.slug === PORTAL)
  assert.deepEqual(portal.subgraph, {
    id: "it-governance",
    graph: "/static/okf-subgraphs/it-governance.json",
    notes: 0,
    previewed: 0,
  })
  assert.deepEqual(result.subgraphs, [])
})

test("returns the absolutised child graph as the subgraph copy", () => {
  const result = federateGraph(parentGraph(), { "it-governance": { graph: childGraph() } }, federation(), profile)
  assert.equal(result.subgraphs.length, 1)
  assert.equal(result.subgraphs[0].id, "it-governance")
  assert.deepEqual(result.subgraphs[0].graph.federatedFrom, {
    site: "https://cern.example",
    node: PORTAL,
    title: "CERN",
  })
  assert.equal(result.subgraphs[0].graph.nodes[0].url, "https://cern.zetesis.xyz/identity/sso")
})

test("absolutiseChildGraph addresses every note on the child site and drops nested portals", () => {
  const child = childGraph()
  child.nodes[0].subgraph = { id: "nested" }
  child.nodes[1].url = "https://elsewhere.example/gms"
  const before = structuredClone(child)
  const copy = absolutiseChildGraph(child, "https://cern.zetesis.xyz", { site: "https://cern.example", node: PORTAL })
  assert.deepEqual(child, before)
  assert.deepEqual(
    copy.nodes.map((node) => node.url),
    [
      "https://cern.zetesis.xyz/identity/sso",
      "https://elsewhere.example/gms",
      "https://cern.zetesis.xyz/security/oc5",
      "https://cern.zetesis.xyz/sources/foo",
    ],
  )
  assert.equal("subgraph" in copy.nodes[0], false)
  assert.deepEqual(copy.federatedFrom, { site: "https://cern.example", node: PORTAL })
  assert.equal(copy.source_head, "def456")
})
