import { PROFILE } from "../profile.js"
import { buildResolver } from "./resolver.js"

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

export function buildGraph(documents, options = {}) {
  const profile = options.profile ?? PROFILE
  const resolve = buildResolver(documents)
  const nodes = []
  const edges = []
  const unresolved = []
  for (const document of documents) {
    if (document.reserved || !document.frontmatter?.type) continue
    const frontmatter = document.frontmatter
    nodes.push({
      slug: document.id,
      title: frontmatter.title ?? document.id.split("/").at(-1),
      type: frontmatter.type,
      tags: asArray(frontmatter.tags).map(String),
      description: frontmatter.description,
      path: document.path,
    })
    for (const edge of document.edges ?? []) {
      const target = resolve(edge.target)
      const graphEdge = {
        source: document.id,
        target,
        label: edge.label,
        iri: profile.edgeIris[edge.label],
      }
      if (!target) {
        graphEdge.targetRaw = edge.target
        unresolved.push({ source: document.id, target: edge.target, label: edge.label })
      }
      edges.push(graphEdge)
    }
  }
  return {
    schema: profile.graphSchema,
    okf_version: profile.okfVersion,
    okf_profile: profile.id,
    source_head: options.sourceHead,
    last_maintained_head: options.lastMaintainedHead,
    stale: Boolean(options.stale),
    site: options.site,
    types: profile.types,
    edgeLabels: profile.edgeLabels,
    stats: {
      notes: nodes.length,
      edges: edges.length,
      unresolvedEdges: unresolved.length,
    },
    nodes,
    edges,
    unresolved,
  }
}
