import type { HudEdge, HudModel, HudNode, RawGraph } from "./types.ts"

/**
 * okf-graph/v1 → the model the canvas reads. The bundle already resolves aliases, derives
 * inverses and marks edges `derived`; here nodes are keyed by slug and edges to unknown or
 * unresolved targets are dropped.
 */
export function indexGraph(raw: RawGraph): HudModel {
  const nodes = new Map<string, HudNode>()
  for (const n of raw.nodes || []) {
    const id = n.slug || n.id || ""
    nodes.set(id, {
      id,
      type: n.type || "unknown",
      title: n.title || id,
      label: n.label || n.title || id,
      desc: n.description || n.desc || "",
      url: n.url || "/" + id,
      aliases: n.aliases || [],
      properties: n.properties || {},
      subgraph: n.subgraph || null,
      federated: n.federated || null,
      row: n.row || null,
      counts: {},
      indeg: 0,
    })
  }
  const edges: HudEdge[] = []
  for (const e of raw.edges || []) {
    if (!e.target) continue
    const source = nodes.get(e.source)
    const target = nodes.get(e.target)
    if (!source || !target) continue
    edges.push({ s: e.source, t: e.target, k: e.label, derived: Boolean(e.derived) })
    source.counts[e.label] = (source.counts[e.label] || 0) + 1
    target.indeg += 1
  }
  return {
    nodes,
    edges,
    title: raw.site || "",
    federatedFrom: raw.federatedFrom || null,
    display: raw.display || null,
    types: raw.types || [],
    edgeLabels: raw.edgeLabels || [...new Set(edges.map((e) => e.k))],
  }
}
