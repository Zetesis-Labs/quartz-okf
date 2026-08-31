import { PROFILE } from "./reference-profile.ts"
import { buildResolver } from "./resolver.ts"
import type {
  Frontmatter,
  GraphEdge,
  GraphNode,
  GraphPropertyGroup,
  OkfGraph,
  Profile,
  UnresolvedEdge,
  ValidatedDocument,
} from "./types.ts"

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"])

function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {
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
      const next = current[segment]
      if (next === null || typeof next !== "object" || Array.isArray(next)) {
        throw new Error(`conflicting profile graphPath at "${path.slice(0, index + 1).join(".")}"`)
      }
      current = next as Record<string, unknown>
    }
  }
}

function projectProperties(frontmatter: Frontmatter, profile: Profile): Record<string, unknown> | undefined {
  const properties: Record<string, unknown> = {}
  for (const group of profile.propertyGroups ?? []) {
    if (!(group.appliesTo ?? []).includes(frontmatter.type ?? "")) continue
    for (const field of group.fields ?? []) {
      const value = frontmatter[field.source]
      if (value === undefined || value === null || value === "") continue
      setPath(properties, field.graphPath, value)
    }
  }
  return Object.keys(properties).length > 0 ? properties : undefined
}

function graphPropertyGroups(profile: Profile): GraphPropertyGroup[] {
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

export function deriveInverseEdges(edges: GraphEdge[], profile: Profile = PROFILE): GraphEdge[] {
  const inverseLabels = profile.inverseLabels ?? {}
  const edgeIris = profile.edgeIris ?? {}
  const declared = new Set(
    edges.filter((edge) => edge.target).map((edge) => `${edge.source}\n${edge.label}\n${edge.target}`),
  )
  const derived: GraphEdge[] = []
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
      iri: edgeIris[inverse],
      derived: true,
    })
  }
  return derived
}

export interface BuildGraphOptions {
  profile?: Profile
  sourceHead?: string
  lastMaintainedHead?: string | null
  stale?: boolean
  site?: string
  baseUrl?: string
}

export function buildGraph(documents: ValidatedDocument[], options: BuildGraphOptions = {}): OkfGraph {
  const profile = options.profile ?? PROFILE
  const resolve = buildResolver(documents)
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const unresolved: UnresolvedEdge[] = []
  for (const document of documents) {
    const type = document.frontmatter?.type
    if (document.reserved || !type) continue
    const frontmatter = document.frontmatter ?? {}
    const node: GraphNode = {
      slug: document.id,
      title: frontmatter.title ?? document.id.split("/").at(-1) ?? document.id,
      type,
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
      const graphEdge: GraphEdge = {
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
  const derived = deriveInverseEdges(edges, profile)
  edges.push(...derived)
  return {
    schema: profile.graphSchema,
    okf_version: profile.okfVersion,
    okf_profile: profile.id,
    source_head: options.sourceHead,
    last_maintained_head: options.lastMaintainedHead,
    stale: Boolean(options.stale),
    site: options.site,
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
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
