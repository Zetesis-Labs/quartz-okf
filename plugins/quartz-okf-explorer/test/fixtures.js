// Shaped like the graph cern-graph publishes: a root with a portal, a previewed
// (federated) note, declared and derived edges, and edges the index must drop.
export const RAW_ROOT = {
  schema: "okf-graph/v1",
  site: "Fixture site",
  types: ["organisation", "graph", "topic", "role", "source"],
  edgeLabels: ["Governs", "Supervised by", "Contains", "Part of", "Cites", "About"],
  display: {
    typeColors: { role: "#d946ef", committee: "#3b82f6" },
    typeLabels: { role: "Executive role" },
    edgeColors: { Contains: "#9a6fbf" },
  },
  nodes: [
    { slug: "org", title: "The organisation", type: "organisation", description: "Root." },
    {
      slug: "topics/it",
      title: "IT topic",
      type: "graph",
      subgraph: { id: "it", title: "IT graph", mount: "/it", graph: "/static/okf-subgraphs/it.json", notes: 3, previewed: 1 },
    },
    { slug: "it/roles/cio", title: "The CIO role", type: "role", federated: "it", url: "/it/roles/cio", properties: { status: "current" } },
    { slug: "sources/council", title: "Council minutes", type: "source", label: "CM-1", properties: { kind: "governance-document" } },
    { slug: "boards/council", title: "The Council", type: "committee" },
  ],
  edges: [
    { source: "boards/council", target: "org", label: "Governs" },
    { source: "org", target: "boards/council", label: "Supervised by", derived: true },
    { source: "topics/it", target: "it/roles/cio", label: "Contains", federated: "it" },
    { source: "it/roles/cio", target: "topics/it", label: "Part of", derived: true, federated: "it" },
    { source: "org", target: "sources/council", label: "Cites" },
    { source: "org", target: "missing/note", label: "About" },
    { source: "org", target: null, label: "About" },
  ],
}

export const RAW_CHILD = {
  schema: "okf-graph/v1",
  site: "IT graph",
  types: ["role", "service", "topic"],
  edgeLabels: ["Runs", "Run by", "Part of", "Contains"],
  federatedFrom: { site: "https://root.example", node: "topics/it", title: "Fixture site" },
  display: {
    typeColors: { role: "#111111", service: "#10b981" },
    typeLabels: { service: "Service" },
    edgeColors: { Runs: "#a855f7" },
    typeOrder: ["service", "role"],
    modes: [{ id: "ops", label: "Operations", edges: ["Runs"] }],
    tooltip: { service: "{indeg|integration|integrations}" },
  },
  nodes: [
    { slug: "roles/cio", title: "The CIO role", type: "role", url: "/it/roles/cio" },
    { slug: "compute/batch", title: "The batch service", type: "service", url: "/it/compute/batch" },
    { slug: "topics/grid", title: "Grid topic", type: "topic", url: "/it/topics/grid",
      subgraph: { id: "grid", title: "Grid graph", mount: "/it/grid", graph: "/static/okf-subgraphs/grid.json", notes: 1, previewed: 0 } },
  ],
  edges: [
    { source: "roles/cio", target: "compute/batch", label: "Runs" },
    { source: "compute/batch", target: "roles/cio", label: "Run by", derived: true },
  ],
}

export const stubT = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key)
