import { PROFILE } from "../profile.js"
import { buildResolver } from "./resolver.js"

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"])

function setPath(target, path, value) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error("profile graphPath must be a non-empty array")
  }
  let current = target
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index]
    if (typeof segment !== "string" || !segment || FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      throw new Error(`unsafe profile graphPath segment "${String(segment)}"`)
    }
    if (index === path.length - 1) {
      current[segment] = value
    } else {
      if (current[segment] === undefined) current[segment] = {}
      if (
        current[segment] === null ||
        typeof current[segment] !== "object" ||
        Array.isArray(current[segment])
      ) {
        throw new Error(`conflicting profile graphPath at "${path.slice(0, index + 1).join(".")}"`)
      }
      current = current[segment]
    }
  }
}

function projectProperties(frontmatter, profile) {
  const properties = {}
  for (const group of profile.propertyGroups ?? []) {
    if (!(group.appliesTo ?? []).includes(frontmatter.type)) continue
    for (const field of group.fields ?? []) {
      const value = frontmatter[field.source]
      if (value === undefined || value === null || value === "") continue
      setPath(properties, field.graphPath, value)
    }
  }
  return Object.keys(properties).length > 0 ? properties : undefined
}

function graphPropertyGroups(profile) {
  return (profile.propertyGroups ?? []).map((group) => ({
    id: group.id,
    label: group.label ?? group.id,
    appliesTo: group.appliesTo ?? [],
    fields: (group.fields ?? []).map((field) => ({
      path: field.graphPath,
      label: field.label ?? field.source,
    })),
  }))
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
    const node = {
      slug: document.id,
      title: frontmatter.title ?? document.id.split("/").at(-1),
      type: frontmatter.type,
      tags: asArray(frontmatter.tags).map(String),
      description: frontmatter.description,
      path: document.path,
    }
    const aliases = asArray(frontmatter.aliases).map(String)
    if (aliases.length > 0) node.aliases = aliases
    const properties = projectProperties(frontmatter, profile)
    if (properties) node.properties = properties
    nodes.push(node)
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
  const inverseLabels = profile.inverseLabels ?? {}
  const declared = new Set(
    edges.filter((edge) => edge.target).map((edge) => `${edge.source}\n${edge.label}\n${edge.target}`),
  )
  const derived = []
  for (const edge of edges) {
    const inverse = inverseLabels[edge.label]
    if (!inverse || !edge.target) continue
    const key = `${edge.target}\n${inverse}\n${edge.source}`
    if (declared.has(key)) continue
    declared.add(key)
    derived.push({
      source: edge.target,
      target: edge.source,
      label: inverse,
      iri: profile.edgeIris[inverse],
      derived: true,
    })
  }
  edges.push(...derived)
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
    propertyGroups: graphPropertyGroups(profile),
    stats: {
      notes: nodes.length,
      edges: edges.length,
      declaredEdges: edges.length - derived.length,
      derivedEdges: derived.length,
      unresolvedEdges: unresolved.length,
    },
    nodes,
    edges,
    unresolved,
  }
}
