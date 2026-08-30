import { PROFILE } from "../profile.js"
import { deriveInverseEdges } from "./graph.js"

const DEFAULT_EDGE = "Contains"
const DEFAULT_SUBGRAPHS_PATH = "/static/okf-subgraphs"

export function subgraphId(entry) {
  if (entry?.id) return String(entry.id)
  return String(entry?.node ?? "").split("/").filter(Boolean).at(-1) ?? ""
}

function nameOf(entry) {
  return subgraphId(entry) || "(unnamed)"
}

function problem(id, code, message) {
  return { id, code, message: `${id}: ${message}` }
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))
}

function readProperty(properties, propertyPath) {
  return String(propertyPath)
    .split(".")
    .reduce((value, key) => (value == null ? value : value[key]), properties ?? {})
}

function canonicalSite(value) {
  const text = String(value ?? "").trim()
  if (!text) return undefined
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
  return withScheme.replace(/\/+$/, "")
}

function isAbsolute(url) {
  return /^https?:\/\//i.test(String(url ?? ""))
}

export function validateFederationConfig(federation, profile = PROFILE, localSlugs = []) {
  const problems = []
  const slugs = new Set(localSlugs)
  const labels = new Set(profile.edgeLabels ?? [])
  const seen = new Set()
  for (const entry of federation?.subgraphs ?? []) {
    const id = nameOf(entry)
    if (!entry.node) {
      problems.push(problem(id, "federation/node-required", "declare the portal note in `node`"))
    } else if (!slugs.has(entry.node)) {
      problems.push(
        problem(id, "federation/node-unknown", `node "${entry.node}" is not a note of this corpus`),
      )
    }
    if (!entry.graph) {
      problems.push(problem(id, "federation/graph-required", "declare the child's graph location in `graph`"))
    }
    if (!entry.preview?.property || entry.preview.equals === undefined) {
      problems.push(problem(id, "federation/preview-required", "declare `preview.property` and `preview.equals`"))
    }
    const edge = entry.edge ?? DEFAULT_EDGE
    if (!labels.has(edge)) {
      problems.push(problem(id, "federation/edge-unknown", `edge "${edge}" is not one of this corpus' edgeLabels`))
    }
    if (seen.has(id)) problems.push(problem(id, "federation/id-duplicate", "two subgraphs resolve to this id"))
    seen.add(id)
  }
  return problems
}

export function absolutiseChildGraph(childGraph, site, parentRef) {
  const origin = canonicalSite(site)
  return {
    ...childGraph,
    federatedFrom: parentRef,
    nodes: (childGraph.nodes ?? []).map(({ subgraph: _nested, ...node }) => ({
      ...node,
      url: isAbsolute(node.url) ? node.url : `${origin}/${node.slug}`,
    })),
  }
}

function openNotesOf(childGraph, preview) {
  return (childGraph.nodes ?? []).filter(
    (node) => readProperty(node.properties, preview.property) === preview.equals,
  )
}

function federateEntry({ entry, id, child, portal, bySlug, graph, profile, subgraphsPath }) {
  const copyPath = `${subgraphsPath}/${id}.json`
  const problems = []
  const warnings = []
  if (!child?.graph) {
    warnings.push({
      id,
      code: "federation/child-unreachable",
      message: `${id}: cannot load ${child?.location ?? entry.graph}: ${child?.error ?? "no graph provided"}`,
    })
    portal.subgraph = { id, graph: copyPath, notes: 0, previewed: 0 }
    return { problems, warnings, nodes: [], edges: [], declared: 0, derived: 0 }
  }
  const site = canonicalSite(entry.site ?? child.graph.baseUrl)
  if (!site) {
    problems.push(problem(id, "federation/site-required", "declare `site`: the child graph publishes no baseUrl"))
    return { problems, warnings, nodes: [], edges: [], declared: 0, derived: 0 }
  }
  const open = openNotesOf(child.graph, entry.preview)
  if (!open.length) {
    warnings.push({
      id,
      code: "federation/preview-empty",
      message: `${id}: no child note has ${entry.preview.property} = ${JSON.stringify(entry.preview.equals)}`,
    })
  }
  if (entry.pin && child.graph.source_head && entry.pin !== child.graph.source_head) {
    warnings.push({
      id,
      code: "federation/pin-drift",
      message: `${id}: pinned ${entry.pin} but the child publishes ${child.graph.source_head}`,
    })
  }
  const prefix = (slug) => `${id}:${slug}`
  const collisions = open.map((node) => prefix(node.slug)).filter((slug) => bySlug.has(slug))
  if (collisions.length) {
    problems.push(
      problem(id, "federation/slug-collision", `prefixed slug already exists in this corpus: ${collisions.join(", ")}`),
    )
    return { problems, warnings, nodes: [], edges: [], declared: 0, derived: 0 }
  }
  portal.subgraph = compact({
    id,
    title: child.graph.site,
    site,
    graph: copyPath,
    source_head: child.graph.source_head,
    notes: child.graph.stats?.notes ?? (child.graph.nodes ?? []).length,
    previewed: open.length,
  })
  const nodes = open.map(({ subgraph: _nested, ...node }) => ({
    ...node,
    slug: prefix(node.slug),
    federated: id,
    url: isAbsolute(node.url) ? node.url : `${site}/${node.slug}`,
  }))
  const edge = entry.edge ?? DEFAULT_EDGE
  const portalEdges = open.map((node) =>
    compact({ source: entry.node, target: prefix(node.slug), label: edge, iri: profile.edgeIris?.[edge], federated: id }),
  )
  const openSet = new Set(open.map((node) => node.slug))
  const childEdges = (child.graph.edges ?? [])
    .filter((item) => item.target && openSet.has(item.source) && openSet.has(item.target))
    .map((item) =>
      compact({
        source: prefix(item.source),
        target: prefix(item.target),
        label: item.label,
        iri: item.iri,
        derived: item.derived ? true : undefined,
        federated: id,
      }),
    )
  const derived = deriveInverseEdges(portalEdges, profile).map((item) => ({ ...item, federated: id }))
  return {
    problems,
    warnings,
    nodes,
    edges: [...portalEdges, ...childEdges, ...derived],
    declared: portalEdges.length + childEdges.filter((item) => !item.derived).length,
    derived: derived.length + childEdges.filter((item) => item.derived).length,
    subgraph: {
      id,
      graph: absolutiseChildGraph(child.graph, site, compact({ site: graph.baseUrl, node: entry.node, title: graph.site })),
    },
  }
}

export function federateGraph(graph, children, federation, profile = PROFILE, options = {}) {
  const subgraphsPath = options.subgraphsPath ?? DEFAULT_SUBGRAPHS_PATH
  const nodes = graph.nodes.map((node) => ({ ...node }))
  const bySlug = new Map(nodes.map((node) => [node.slug, node]))
  const problems = validateFederationConfig(federation, profile, [...bySlug.keys()])
  const invalid = new Set(problems.map((item) => item.id))
  const warnings = []
  const addedNodes = []
  const addedEdges = []
  const subgraphs = []
  let declared = 0
  let derived = 0
  for (const entry of federation?.subgraphs ?? []) {
    const id = nameOf(entry)
    if (invalid.has(id)) continue
    const result = federateEntry({
      entry,
      id,
      child: children?.[id],
      portal: bySlug.get(entry.node),
      bySlug,
      graph,
      profile,
      subgraphsPath,
    })
    problems.push(...result.problems)
    warnings.push(...result.warnings)
    addedNodes.push(...result.nodes)
    addedEdges.push(...result.edges)
    declared += result.declared
    derived += result.derived
    if (result.subgraph) subgraphs.push(result.subgraph)
  }
  const stats = graph.stats ?? {}
  return {
    graph: {
      ...graph,
      stats: {
        ...stats,
        notes: (stats.notes ?? 0) + addedNodes.length,
        edges: (stats.edges ?? 0) + addedEdges.length,
        declaredEdges: (stats.declaredEdges ?? 0) + declared,
        derivedEdges: (stats.derivedEdges ?? 0) + derived,
        federatedNodes: addedNodes.length,
        federatedEdges: addedEdges.length,
      },
      nodes: [...nodes, ...addedNodes],
      edges: [...graph.edges.map((edge) => ({ ...edge })), ...addedEdges],
    },
    subgraphs,
    problems,
    warnings,
  }
}
