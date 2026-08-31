// Hierarchical mermaid diagrams generated from the typed graph. Recipes are
// edge selections, not domain knowledge: which note gets which recipe is
// decided by type (cluster, network) or by an explicit `diagram:` frontmatter
// opt-in on the note.

import type { GraphEdge, GraphNode, OkfGraph } from "./types.ts"

const TYPE_STROKE: Readonly<Record<string, string>> = Object.freeze({
  application: "#c060b8",
  service: "#008300",
  component: "#76b041",
  cluster: "#2a78d6",
  node: "#a3459c",
  router: "#0891b2",
  network: "#1baf7a",
  datastore: "#eb6834",
  technology: "#4a3aa7",
})

const BEGIN_MARKER = "<!-- okf-diagram:auto -->"
const END_MARKER = "<!-- /okf-diagram:auto -->"

type LinkedEdge = GraphEdge & { target: string }

interface GraphIndex {
  nodes: Map<string, GraphNode>
  edges: LinkedEdge[]
  targetsOf(source: string, labelName: string): string[]
  sourcesOf(target: string, labelName: string): string[]
}

function mermaidId(slug: string): string {
  return `n_${slug.replace(/[^a-zA-Z0-9]/g, "_")}`
}

function label(node: GraphNode): string {
  return String(node.title ?? node.slug).replaceAll('"', "'")
}

function byTypeThenTitle(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort(
    (left, right) =>
      String(left.type).localeCompare(String(right.type)) ||
      label(left).localeCompare(label(right)),
  )
}

function indexGraph(graph: OkfGraph): GraphIndex {
  const nodes = new Map(graph.nodes.map((node) => [node.slug, node]))
  const edges = graph.edges.filter((edge): edge is LinkedEdge => Boolean(edge.target) && nodes.has(edge.target as string))
  return {
    nodes,
    edges,
    targetsOf(source, labelName) {
      return [...new Set(edges.filter((edge) => edge.source === source && edge.label === labelName).map((edge) => edge.target))]
    },
    sourcesOf(target, labelName) {
      return [...new Set(edges.filter((edge) => edge.target === target && edge.label === labelName).map((edge) => edge.source))]
    },
  }
}

function nodesOf(index: GraphIndex, slugs: Iterable<string>): GraphNode[] {
  const found: GraphNode[] = []
  for (const slug of slugs) {
    const node = index.nodes.get(slug)
    if (node) found.push(node)
  }
  return found
}

function classLines(index: GraphIndex, memberSlugs: Iterable<string>, externalSlugs: Set<string>): string[] {
  const lines: string[] = []
  const byType = new Map<string, string[]>()
  for (const slug of new Set([...memberSlugs, ...externalSlugs])) {
    const type = index.nodes.get(slug)?.type
    if (!type || !TYPE_STROKE[type]) continue
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)?.push(mermaidId(slug))
  }
  for (const [type, ids] of [...byType.entries()].sort()) {
    lines.push(`  classDef okf_${type} stroke:${TYPE_STROKE[type]},stroke-width:2px,fill:transparent`)
    lines.push(`  class ${ids.sort().join(",")} okf_${type}`)
  }
  const externals = [...externalSlugs]
  if (externals.length > 0) {
    lines.push("  classDef okf_external stroke-dasharray:4 3")
    lines.push(`  class ${externals.map(mermaidId).sort().join(",")} okf_external`)
  }
  return lines
}

function peerPairs(index: GraphIndex, scopeSlugs: Set<string>): [string, string][] {
  const pairs = new Map<string, [string, string]>()
  for (const edge of index.edges) {
    if (edge.label !== "Peers with") continue
    if (!scopeSlugs.has(edge.source) && !scopeSlugs.has(edge.target)) continue
    const [a, b] = [edge.source, edge.target].sort()
    pairs.set(`${a}\n${b}`, [a, b])
  }
  return [...pairs.values()].sort((a, b) => a.join().localeCompare(b.join()))
}

const STATE_ARROWS: [string, string][] = [
  ["State in", "-->"],
  ["Backed by", "-.->"],
]

function clusterRecipe(index: GraphIndex, scopeSlug: string): string | null {
  const scope = index.nodes.get(scopeSlug)
  if (!scope) return null
  const children = index.targetsOf(scopeSlug, "Contains")
  if (children.length === 0) return null
  const nested = new Map<string, string[]>()
  for (const child of children) {
    const grandchildren = index
      .targetsOf(child, "Contains")
      .filter((slug) => slug !== scopeSlug && !children.includes(slug))
    if (grandchildren.length > 0) nested.set(child, grandchildren)
  }
  const members = new Set([scopeSlug, ...children, ...[...nested.values()].flat()])

  const arrows: string[] = []
  const externals = new Set<string>()
  const external = (slug: string): void => {
    if (!members.has(slug)) externals.add(slug)
  }
  for (const member of members) {
    if (member === scopeSlug) continue
    for (const [edgeLabel, arrow] of STATE_ARROWS) {
      for (const target of index.targetsOf(member, edgeLabel)) {
        if (target === scopeSlug) continue
        external(target)
        arrows.push(`  ${mermaidId(member)} ${arrow}|${edgeLabel}| ${mermaidId(target)}`)
      }
    }
  }
  for (const target of index.targetsOf(scopeSlug, "Runs on")) {
    if (members.has(target)) continue
    external(target)
    arrows.push(`  ${mermaidId(scopeSlug)} -->|Runs on| ${mermaidId(target)}`)
  }
  for (const [a, b] of peerPairs(index, new Set([scopeSlug]))) {
    external(a === scopeSlug ? b : a)
    arrows.push(`  ${mermaidId(a)} <-->|Peers with| ${mermaidId(b)}`)
  }

  const lines = ["flowchart TB"]
  lines.push(`  subgraph ${mermaidId(scopeSlug)}["${label(scope)}"]`)
  lines.push("    direction TB")
  for (const child of byTypeThenTitle(nodesOf(index, children))) {
    const grandchildren = nested.get(child.slug)
    if (grandchildren) {
      lines.push(`    subgraph ${mermaidId(child.slug)}["${label(child)}"]`)
      lines.push("      direction TB")
      for (const grandchild of byTypeThenTitle(nodesOf(index, grandchildren))) {
        lines.push(`      ${mermaidId(grandchild.slug)}["${label(grandchild)}"]`)
      }
      lines.push("    end")
    } else {
      lines.push(`    ${mermaidId(child.slug)}["${label(child)}"]`)
    }
  }
  lines.push("  end")
  for (const node of byTypeThenTitle(nodesOf(index, externals))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  lines.push(...classLines(index, members, externals))
  return `${lines.join("\n")}\n`
}

function networkRecipe(index: GraphIndex, scopeSlug: string): string | null {
  const scope = index.nodes.get(scopeSlug)
  if (!scope) return null
  const members = index.sourcesOf(scopeSlug, "Member of")
  if (members.length === 0) return null
  const inScope = new Set([scopeSlug, ...members])

  const arrows: string[] = []
  const externals = new Set<string>()
  for (const [a, b] of peerPairs(index, inScope)) {
    if (!inScope.has(a)) externals.add(a)
    if (!inScope.has(b)) externals.add(b)
    arrows.push(`  ${mermaidId(a)} <-->|Peers with| ${mermaidId(b)}`)
  }
  for (const source of index.sourcesOf(scopeSlug, "Reached via")) {
    if (!inScope.has(source)) externals.add(source)
    arrows.push(`  ${mermaidId(scopeSlug)} -.->|Reached via| ${mermaidId(source)}`)
  }

  const lines = ["flowchart TB"]
  lines.push(`  subgraph ${mermaidId(scopeSlug)}["${label(scope)}"]`)
  lines.push("    direction TB")
  for (const node of byTypeThenTitle(nodesOf(index, members))) {
    lines.push(`    ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push("  end")
  for (const node of byTypeThenTitle(nodesOf(index, externals))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  lines.push(...classLines(index, inScope, externals))
  return `${lines.join("\n")}\n`
}

function backupFlowRecipe(index: GraphIndex): string | null {
  const datastores = [...index.nodes.values()].filter((node) => node.type === "datastore")
  if (datastores.length === 0) return null
  const backupTargets = new Set(
    index.edges.filter((edge) => edge.label === "Backed by").map((edge) => edge.target),
  )
  const groups = new Map<string, string[]>()
  const ungrouped: string[] = []
  for (const datastore of datastores) {
    const owners = index.sourcesOf(datastore.slug, "Contains")
    const owner =
      owners.find((slug) => index.nodes.get(slug)?.type === "cluster") ??
      owners.find((slug) => index.nodes.get(slug)?.type === "node") ??
      owners[0]
    if (owner) {
      if (!groups.has(owner)) groups.set(owner, [])
      groups.get(owner)?.push(datastore.slug)
    } else {
      ungrouped.push(datastore.slug)
    }
  }
  const memberSet = new Set(datastores.map((node) => node.slug))
  const arrows: string[] = []
  const externals = new Set<string>()
  for (const datastore of datastores) {
    for (const [edgeLabel, arrow] of STATE_ARROWS) {
      for (const target of index.targetsOf(datastore.slug, edgeLabel)) {
        if (!memberSet.has(target) && !groups.has(target)) externals.add(target)
        arrows.push(`  ${mermaidId(datastore.slug)} ${arrow}|${edgeLabel}| ${mermaidId(target)}`)
      }
    }
  }
  const unprotected = datastores
    .map((node) => node.slug)
    .filter(
      (slug) =>
        index.targetsOf(slug, "Backed by").length === 0 && !backupTargets.has(slug),
    )

  const lines = ["flowchart TB"]
  for (const [owner, slugs] of [...groups.entries()].sort()) {
    const ownerNode = index.nodes.get(owner)
    if (!ownerNode) continue
    lines.push(`  subgraph ${mermaidId(owner)}["${label(ownerNode)}"]`)
    lines.push("    direction TB")
    for (const node of byTypeThenTitle(nodesOf(index, slugs))) {
      lines.push(`    ${mermaidId(node.slug)}["${label(node)}"]`)
    }
    lines.push("  end")
  }
  for (const node of byTypeThenTitle(nodesOf(index, ungrouped))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  for (const node of byTypeThenTitle(nodesOf(index, externals))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  const shown = new Set([...memberSet, ...groups.keys()])
  lines.push(...classLines(index, shown, externals))
  if (unprotected.length > 0) {
    lines.push("  classDef okf_unprotected stroke:#e34948,stroke-width:3px")
    lines.push(`  class ${unprotected.map(mermaidId).sort().join(",")} okf_unprotected`)
  }
  return `${lines.join("\n")}\n`
}

function fleetMapRecipe(index: GraphIndex): string | null {
  const hosted = new Map<string, Set<string>>()
  for (const edge of index.edges) {
    if (edge.label !== "Runs on") continue
    if (!hosted.has(edge.target)) hosted.set(edge.target, new Set())
    hosted.get(edge.target)?.add(edge.source)
  }
  if (hosted.size === 0) return null
  const guests = new Set([...hosted.values()].flatMap((set) => [...set]))
  const roots = [...hosted.keys()].filter((slug) => !guests.has(slug)).sort()
  const shown = new Set<string>()

  const renderHost = (slug: string, indent: string): string[] => {
    const node = index.nodes.get(slug)
    if (!node) return []
    const lines: string[] = []
    shown.add(slug)
    const children = [...(hosted.get(slug) ?? [])]
    if (children.length === 0) {
      lines.push(`${indent}${mermaidId(slug)}["${label(node)}"]`)
      return lines
    }
    lines.push(`${indent}subgraph ${mermaidId(slug)}["${label(node)}"]`)
    lines.push(`${indent}  direction TB`)
    for (const child of byTypeThenTitle(nodesOf(index, children))) {
      lines.push(...renderHost(child.slug, `${indent}  `))
    }
    lines.push(`${indent}end`)
    return lines
  }

  const lines = ["flowchart TB"]
  for (const root of roots) lines.push(...renderHost(root, "  "))

  const arrows: string[] = []
  const externals = new Set<string>()
  for (const [a, b] of peerPairs(index, shown)) {
    for (const end of [a, b]) {
      if (!shown.has(end)) {
        externals.add(end)
        shown.add(end)
      }
    }
    arrows.push(`  ${mermaidId(a)} <-->|Peers with| ${mermaidId(b)}`)
  }
  for (const node of byTypeThenTitle(nodesOf(index, externals))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  lines.push(...classLines(index, shown, externals))
  return `${lines.join("\n")}\n`
}

function exposureRecipe(index: GraphIndex): string | null {
  const reached = index.edges.filter((edge) => edge.label === "Reached via")
  if (reached.length === 0) return null
  const shown = new Set<string>()
  const arrows: string[] = []
  for (const edge of reached) {
    shown.add(edge.source)
    shown.add(edge.target)
    arrows.push(`  ${mermaidId(edge.target)} -->|Reached via| ${mermaidId(edge.source)}`)
  }
  const lines = ["flowchart LR"]
  for (const node of byTypeThenTitle(nodesOf(index, shown))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...[...new Set(arrows)].sort())
  lines.push(...classLines(index, shown, new Set()))
  return `${lines.join("\n")}\n`
}

export type Recipe = (graph: OkfGraph, scopeSlug: string) => string | null

export const RECIPES: Readonly<Record<string, Recipe>> = Object.freeze({
  cluster: (graph, scopeSlug) => clusterRecipe(indexGraph(graph), scopeSlug),
  network: (graph, scopeSlug) => networkRecipe(indexGraph(graph), scopeSlug),
  "backup-flow": (graph) => backupFlowRecipe(indexGraph(graph)),
  "fleet-map": (graph) => fleetMapRecipe(indexGraph(graph)),
  exposure: (graph) => exposureRecipe(indexGraph(graph)),
})

export const RECIPE_BY_TYPE: Readonly<Record<string, string>> = Object.freeze({
  cluster: "cluster",
  network: "network",
})

export function buildScopeDiagram(graph: OkfGraph, scopeSlug: string): string | null {
  return RECIPES.cluster(graph, scopeSlug)
}

export function weaveDiagram(source: string, mermaid: string): string {
  const block = `${BEGIN_MARKER}\n\`\`\`mermaid\n${mermaid}\`\`\`\n${END_MARKER}`
  const begin = source.indexOf(BEGIN_MARKER)
  const end = source.indexOf(END_MARKER)
  if (begin >= 0 && end > begin) {
    return `${source.slice(0, begin)}${block}${source.slice(end + END_MARKER.length)}`
  }
  const trimmed = source.replace(/\s+$/, "")
  return `${trimmed}\n\n# Structure\n\n${block}\n`
}
