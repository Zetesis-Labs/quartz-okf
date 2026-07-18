// Hierarchical mermaid diagrams generated from the typed graph. A scope note
// (cluster by default) gets a containment picture plus the data-family edges
// that explain where state lives and where it is protected.

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

export function buildScopeDiagram(graph, scopeSlug) {
  const nodes = new Map(graph.nodes.map((node) => [node.slug, node]))
  const scope = nodes.get(scopeSlug)
  if (!scope) return null
  const targetsOf = (source, labelName) =>
    graph.edges
      .filter((edge) => edge.source === source && edge.label === labelName && nodes.has(edge.target))
      .map((edge) => edge.target)

  const children = [...new Set(targetsOf(scopeSlug, "Contains"))]
  if (children.length === 0) return null
  const nested = new Map()
  for (const child of children) {
    const grandchildren = [...new Set(targetsOf(child, "Contains"))].filter(
      (slug) => slug !== scopeSlug && !children.includes(slug),
    )
    if (grandchildren.length > 0) nested.set(child, grandchildren)
  }
  const members = new Set([scopeSlug, ...children, ...[...nested.values()].flat()])

  const arrows = []
  const externals = new Set()
  for (const member of members) {
    if (member === scopeSlug) continue
    for (const [edgeLabel, arrow] of [
      ["State in", "-->"],
      ["Backed by", "-.->"],
    ]) {
      for (const target of new Set(targetsOf(member, edgeLabel))) {
        if (target === scopeSlug) continue
        if (!members.has(target)) externals.add(target)
        arrows.push(`  ${mermaidId(member)} ${arrow}|${edgeLabel}| ${mermaidId(target)}`)
      }
    }
  }
  for (const target of new Set(targetsOf(scopeSlug, "Runs on"))) {
    if (members.has(target)) continue
    externals.add(target)
    arrows.push(`  ${mermaidId(scopeSlug)} -->|Runs on| ${mermaidId(target)}`)
  }

  const lines = ["flowchart TB"]
  lines.push(`  subgraph ${mermaidId(scopeSlug)}["${label(scope)}"]`)
  lines.push("    direction TB")
  for (const child of byTypeThenTitle(children.map((slug) => nodes.get(slug)))) {
    const grandchildren = nested.get(child.slug)
    if (grandchildren) {
      lines.push(`    subgraph ${mermaidId(child.slug)}["${label(child)}"]`)
      lines.push("      direction TB")
      for (const grandchild of byTypeThenTitle(grandchildren.map((slug) => nodes.get(slug)))) {
        lines.push(`      ${mermaidId(grandchild.slug)}["${label(grandchild)}"]`)
      }
      lines.push("    end")
    } else {
      lines.push(`    ${mermaidId(child.slug)}["${label(child)}"]`)
    }
  }
  lines.push("  end")
  for (const external of byTypeThenTitle([...externals].map((slug) => nodes.get(slug)))) {
    lines.push(`  ${mermaidId(external.slug)}["${label(external)}"]`)
  }
  lines.push(...arrows.sort())

  const used = new Map()
  for (const member of members) used.set(member, nodes.get(member).type)
  for (const external of externals) used.set(external, nodes.get(external).type)
  const byType = new Map()
  for (const [slug, type] of used) {
    if (!TYPE_STROKE[type]) continue
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type).push(mermaidId(slug))
  }
  for (const [type, ids] of [...byType.entries()].sort()) {
    lines.push(`  classDef okf_${type} stroke:${TYPE_STROKE[type]},stroke-width:2px,fill:transparent`)
    lines.push(`  class ${ids.sort().join(",")} okf_${type}`)
  }
  if (externals.size > 0) {
    lines.push("  classDef okf_external stroke-dasharray:4 3")
    lines.push(
      `  class ${[...externals].map(mermaidId).sort().join(",")} okf_external`,
    )
  }
  return `${lines.join("\n")}\n`
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
