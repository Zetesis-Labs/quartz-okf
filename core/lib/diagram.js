// Hierarchical mermaid diagrams generated from the typed graph. Recipes are
// edge selections, not domain knowledge: which note gets which recipe is
// decided by type (cluster, network) or by an explicit `diagram:` frontmatter
// opt-in on the note.

const TYPE_STROKE = Object.freeze({
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

function mermaidId(slug) {
  return `n_${slug.replace(/[^a-zA-Z0-9]/g, "_")}`
}

function label(node) {
  return String(node.title ?? node.slug).replaceAll('"', "'")
}

function byTypeThenTitle(nodes) {
  return [...nodes].sort(
    (left, right) =>
      String(left.type).localeCompare(String(right.type)) ||
      label(left).localeCompare(label(right)),
  )
}

class GraphIndex {
  constructor(graph) {
    this.nodes = new Map(graph.nodes.map((node) => [node.slug, node]))
    this.edges = graph.edges.filter((edge) => edge.target && this.nodes.has(edge.target))
  }

  targetsOf(source, labelName) {
    return [
      ...new Set(
        this.edges
          .filter((edge) => edge.source === source && edge.label === labelName)
          .map((edge) => edge.target),
      ),
    ]
  }

  sourcesOf(target, labelName) {
    return [
      ...new Set(
        this.edges
          .filter((edge) => edge.target === target && edge.label === labelName)
          .map((edge) => edge.source),
      ),
    ]
  }
}

function classLines(index, memberSlugs, externalSlugs) {
  const lines = []
  const byType = new Map()
  for (const slug of new Set([...memberSlugs, ...externalSlugs])) {
    const type = index.nodes.get(slug)?.type
    if (!TYPE_STROKE[type]) continue
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type).push(mermaidId(slug))
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

function peerPairs(index, scopeSlugs) {
  const pairs = new Map()
  for (const edge of index.edges) {
    if (edge.label !== "Peers with") continue
    if (!scopeSlugs.has(edge.source) && !scopeSlugs.has(edge.target)) continue
    const key = [edge.source, edge.target].sort().join("\n")
    pairs.set(key, [edge.source, edge.target].sort())
  }
  return [...pairs.values()].sort((a, b) => a.join().localeCompare(b.join()))
}

function clusterRecipe(index, scopeSlug) {
  const scope = index.nodes.get(scopeSlug)
  if (!scope) return null
  const children = index.targetsOf(scopeSlug, "Contains")
  if (children.length === 0) return null
  const nested = new Map()
  for (const child of children) {
    const grandchildren = index
      .targetsOf(child, "Contains")
      .filter((slug) => slug !== scopeSlug && !children.includes(slug))
    if (grandchildren.length > 0) nested.set(child, grandchildren)
  }
  const members = new Set([scopeSlug, ...children, ...[...nested.values()].flat()])

  const arrows = []
  const externals = new Set()
  const external = (slug) => {
    if (!members.has(slug)) externals.add(slug)
  }
  for (const member of members) {
    if (member === scopeSlug) continue
    for (const [edgeLabel, arrow] of [
      ["State in", "-->"],
      ["Backed by", "-.->"],
    ]) {
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
  for (const child of byTypeThenTitle(children.map((slug) => index.nodes.get(slug)))) {
    const grandchildren = nested.get(child.slug)
    if (grandchildren) {
      lines.push(`    subgraph ${mermaidId(child.slug)}["${label(child)}"]`)
      lines.push("      direction TB")
      for (const grandchild of byTypeThenTitle(grandchildren.map((slug) => index.nodes.get(slug)))) {
        lines.push(`      ${mermaidId(grandchild.slug)}["${label(grandchild)}"]`)
      }
      lines.push("    end")
    } else {
      lines.push(`    ${mermaidId(child.slug)}["${label(child)}"]`)
    }
  }
  lines.push("  end")
  for (const node of byTypeThenTitle([...externals].map((slug) => index.nodes.get(slug)))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  lines.push(...classLines(index, members, externals))
  return `${lines.join("\n")}\n`
}

function networkRecipe(index, scopeSlug) {
  const scope = index.nodes.get(scopeSlug)
  if (!scope) return null
  const members = index.sourcesOf(scopeSlug, "Member of")
  if (members.length === 0) return null
  const inScope = new Set([scopeSlug, ...members])

  const arrows = []
  const externals = new Set()
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
  for (const node of byTypeThenTitle(members.map((slug) => index.nodes.get(slug)))) {
    lines.push(`    ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push("  end")
  for (const node of byTypeThenTitle([...externals].map((slug) => index.nodes.get(slug)))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  lines.push(...classLines(index, inScope, externals))
  return `${lines.join("\n")}\n`
}

function backupFlowRecipe(index) {
  const datastores = [...index.nodes.values()].filter((node) => node.type === "datastore")
  if (datastores.length === 0) return null
  const backupTargets = new Set(
    index.edges.filter((edge) => edge.label === "Backed by").map((edge) => edge.target),
  )
  const groups = new Map()
  const ungrouped = []
  for (const datastore of datastores) {
    const owners = index.sourcesOf(datastore.slug, "Contains")
    const owner =
      owners.find((slug) => index.nodes.get(slug)?.type === "cluster") ??
      owners.find((slug) => index.nodes.get(slug)?.type === "node") ??
      owners[0]
    if (owner) {
      if (!groups.has(owner)) groups.set(owner, [])
      groups.get(owner).push(datastore.slug)
    } else {
      ungrouped.push(datastore.slug)
    }
  }
  const memberSet = new Set(datastores.map((node) => node.slug))
  const arrows = []
  const externals = new Set()
  for (const datastore of datastores) {
    for (const [edgeLabel, arrow] of [
      ["State in", "-->"],
      ["Backed by", "-.->"],
    ]) {
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
    lines.push(`  subgraph ${mermaidId(owner)}["${label(ownerNode)}"]`)
    lines.push("    direction TB")
    for (const node of byTypeThenTitle(slugs.map((slug) => index.nodes.get(slug)))) {
      lines.push(`    ${mermaidId(node.slug)}["${label(node)}"]`)
    }
    lines.push("  end")
  }
  for (const node of byTypeThenTitle(ungrouped.map((slug) => index.nodes.get(slug)))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  for (const node of byTypeThenTitle([...externals].map((slug) => index.nodes.get(slug)))) {
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

function fleetMapRecipe(index) {
  const hosted = new Map()
  for (const edge of index.edges) {
    if (edge.label !== "Runs on") continue
    if (!hosted.has(edge.target)) hosted.set(edge.target, new Set())
    hosted.get(edge.target).add(edge.source)
  }
  if (hosted.size === 0) return null
  const guests = new Set([...hosted.values()].flatMap((set) => [...set]))
  const roots = [...hosted.keys()].filter((slug) => !guests.has(slug)).sort()
  const shown = new Set()

  const renderHost = (slug, indent) => {
    const node = index.nodes.get(slug)
    const lines = []
    shown.add(slug)
    const children = [...(hosted.get(slug) ?? [])]
    if (children.length === 0) {
      lines.push(`${indent}${mermaidId(slug)}["${label(node)}"]`)
      return lines
    }
    lines.push(`${indent}subgraph ${mermaidId(slug)}["${label(node)}"]`)
    lines.push(`${indent}  direction TB`)
    for (const child of byTypeThenTitle(children.map((s) => index.nodes.get(s)))) {
      lines.push(...renderHost(child.slug, `${indent}  `))
    }
    lines.push(`${indent}end`)
    return lines
  }

  const lines = ["flowchart TB"]
  for (const root of roots) lines.push(...renderHost(root, "  "))

  const arrows = []
  const externals = new Set()
  for (const [a, b] of peerPairs(index, shown)) {
    for (const end of [a, b]) {
      if (!shown.has(end)) {
        externals.add(end)
        shown.add(end)
      }
    }
    arrows.push(`  ${mermaidId(a)} <-->|Peers with| ${mermaidId(b)}`)
  }
  for (const node of byTypeThenTitle([...externals].map((slug) => index.nodes.get(slug)))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...arrows.sort())
  lines.push(...classLines(index, shown, externals))
  return `${lines.join("\n")}\n`
}

function exposureRecipe(index) {
  const reached = index.edges.filter((edge) => edge.label === "Reached via")
  if (reached.length === 0) return null
  const shown = new Set()
  const arrows = []
  for (const edge of reached) {
    shown.add(edge.source)
    shown.add(edge.target)
    arrows.push(`  ${mermaidId(edge.target)} -->|Reached via| ${mermaidId(edge.source)}`)
  }
  const lines = ["flowchart LR"]
  for (const node of byTypeThenTitle([...shown].map((slug) => index.nodes.get(slug)))) {
    lines.push(`  ${mermaidId(node.slug)}["${label(node)}"]`)
  }
  lines.push(...[...new Set(arrows)].sort())
  lines.push(...classLines(index, shown, new Set()))
  return `${lines.join("\n")}\n`
}

export const RECIPES = Object.freeze({
  cluster: (graph, scopeSlug) => clusterRecipe(new GraphIndex(graph), scopeSlug),
  network: (graph, scopeSlug) => networkRecipe(new GraphIndex(graph), scopeSlug),
  "backup-flow": (graph) => backupFlowRecipe(new GraphIndex(graph)),
  "fleet-map": (graph) => fleetMapRecipe(new GraphIndex(graph)),
  exposure: (graph) => exposureRecipe(new GraphIndex(graph)),
})

export const RECIPE_BY_TYPE = Object.freeze({
  cluster: "cluster",
  network: "network",
})

export function buildScopeDiagram(graph, scopeSlug) {
  return RECIPES.cluster(graph, scopeSlug)
}

export function weaveDiagram(source, mermaid) {
  const block = `${BEGIN_MARKER}\n\`\`\`mermaid\n${mermaid}\`\`\`\n${END_MARKER}`
  const begin = source.indexOf(BEGIN_MARKER)
  const end = source.indexOf(END_MARKER)
  if (begin >= 0 && end > begin) {
    return `${source.slice(0, begin)}${block}${source.slice(end + END_MARKER.length)}`
  }
  const trimmed = source.replace(/\s+$/, "")
  return `${trimmed}\n\n# Structure\n\n${block}\n`
}
