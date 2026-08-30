import { PROFILE } from "../profile.js"
import { deriveInverseEdges } from "./graph.js"

const DEFAULT_EDGE = "Contains"
const DEFAULT_SUBGRAPHS_PATH = "/static/okf-subgraphs"
const DISPLAY_FALLBACK_KEYS = ["typeColors", "typeLabels", "edgeColors"]

export function subgraphId(entry) {
  if (entry?.id) return String(entry.id)
  return String(entry?.node ?? "").split("/").filter(Boolean).at(-1) ?? ""
}

export function isRemoteRepo(repo) {
  return /^(https?:\/\/|git@|ssh:\/\/|file:\/\/)/i.test(String(repo ?? ""))
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

function isAbsoluteUrl(url) {
  return /^(https?:)?\/\//i.test(String(url ?? ""))
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
    if (!entry.repo) {
      problems.push(problem(id, "federation/repo-required", "declare the child's repository in `repo` (URL or local path)"))
    } else if (isRemoteRepo(entry.repo) && !entry.ref) {
      problems.push(problem(id, "federation/ref-required", `pin the commit of ${entry.repo} in \`ref\``))
    }
    if (!entry.preview?.property || entry.preview.equals === undefined) {
      problems.push(problem(id, "federation/preview-required", "declare `preview.property` and `preview.equals`"))
    }
    const edge = entry.edge ?? DEFAULT_EDGE
    if (!labels.has(edge)) {
      problems.push(problem(id, "federation/edge-unknown", `edge "${edge}" is not one of this corpus' edgeLabels`))
    }
    const taken = [...slugs].filter((slug) => slug === id || slug.startsWith(`${id}/`))
    if (taken.length) {
      problems.push(
        problem(id, "federation/mount-collision", `the mount path /${id}/ is already used by this corpus: ${taken.join(", ")}`),
      )
    }
    if (seen.has(id)) problems.push(problem(id, "federation/id-duplicate", "two subgraphs resolve to this id"))
    seen.add(id)
  }
  return problems
}

export function absolutiseChildGraph(childGraph, urlBase, parentRef) {
  const base = String(urlBase ?? "").replace(/\/+$/, "")
  return {
    ...childGraph,
    federatedFrom: parentRef,
    nodes: (childGraph.nodes ?? []).map(({ subgraph: _nested, ...node }) => ({
      ...node,
      url: isAbsoluteUrl(node.url) ? node.url : `${base}/${node.slug}`,
    })),
  }
}

function openNotesOf(childGraph, preview) {
  return (childGraph.nodes ?? []).filter(
    (node) => readProperty(node.properties, preview.property) === preview.equals,
  )
}

function empty() {
  return { problems: [], warnings: [], nodes: [], edges: [], declared: 0, derived: 0 }
}

function federateEntry({ entry, id, child, portal, graph, profile, subgraphsPath }) {
  const mount = `/${id}`
  const copyPath = `${subgraphsPath}/${id}.json`
  const result = empty()
  if (!child?.graph) {
    result.warnings.push({
      id,
      code: "federation/child-unreachable",
      message: `${id}: cannot mount ${child?.location ?? entry.repo}: ${child?.error ?? "no graph provided"}`,
    })
    portal.subgraph = { id, mount, graph: copyPath, notes: 0, previewed: 0 }
    return result
  }
  const open = openNotesOf(child.graph, entry.preview)
  if (!open.length) {
    result.warnings.push({
      id,
      code: "federation/preview-empty",
      message: `${id}: no child note has ${entry.preview.property} = ${JSON.stringify(entry.preview.equals)}`,
    })
  }
  const head = child.graph.source_head
  if (entry.ref && head && entry.ref !== head) {
    result.warnings.push({
      id,
      code: "federation/ref-drift",
      message: `${id}: pinned ref ${entry.ref} but the mounted head is ${head}`,
    })
  }
  if (entry.ref && child.remoteHead && child.remoteHead !== entry.ref) {
    result.warnings.push({
      id,
      code: "federation/ref-behind",
      message: `${id}: pinned ${entry.ref}, the remote now points at ${child.remoteHead}`,
    })
  }
  portal.subgraph = compact({
    id,
    title: child.graph.site,
    site: child.graph.baseUrl,
    mount,
    graph: copyPath,
    source_head: head,
    notes: child.graph.stats?.notes ?? (child.graph.nodes ?? []).length,
    previewed: open.length,
  })
  const prefix = (slug) => `${id}/${slug}`
  result.nodes = open.map(({ subgraph: _nested, ...node }) => ({
    ...node,
    slug: prefix(node.slug),
    federated: id,
    url: isAbsoluteUrl(node.url) ? node.url : `${mount}/${node.slug}`,
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
  result.edges = [...portalEdges, ...childEdges, ...derived]
  result.declared = portalEdges.length + childEdges.filter((item) => !item.derived).length
  result.derived = derived.length + childEdges.filter((item) => item.derived).length
  const copy = absolutiseChildGraph(child.graph, mount, compact({ site: graph.baseUrl, node: entry.node, title: graph.site }))
  result.subgraph = { id, graph: child.display ? { ...copy, display: child.display } : copy }
  result.display = child.display
  return result
}

function unionDisplay(displays) {
  const present = displays.filter(Boolean)
  if (!present.length) return undefined
  const union = Object.fromEntries(DISPLAY_FALLBACK_KEYS.map((key) => [key, {}]))
  for (const display of present) {
    for (const key of DISPLAY_FALLBACK_KEYS) Object.assign(union[key], display[key] ?? {})
  }
  return union
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
  const displays = []
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
    displays.push(result.display)
  }
  const stats = graph.stats ?? {}
  const display = unionDisplay(displays)
  return {
    graph: {
      ...graph,
      ...(display ? { display } : {}),
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
