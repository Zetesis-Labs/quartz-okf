export const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g

export function extractSection(source, heading) {
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const headingRe = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, "i")
  let start = -1
  let level = 0
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(headingRe)
    if (match) {
      start = index + 1
      level = match[1].length
      break
    }
  }
  if (start < 0) return []
  const section = []
  for (let index = start; index < lines.length; index += 1) {
    const nextHeading = lines[index].match(/^(#{1,6})\s+/)
    if (nextHeading && nextHeading[1].length <= level) break
    section.push(lines[index])
  }
  return section
}

export function parseTopologyEdges(source, heading = "Topology") {
  const edges = []
  for (const line of extractSection(source, heading)) {
    if (!/^\s*[*-]\s+/.test(line)) continue
    const matches = [...line.matchAll(/\*\*([^*]+?)\*\*\s*:/g)]
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]
      const start = match.index + match[0].length
      const end = matches[index + 1]?.index ?? line.length
      const value = line.slice(start, end)
      for (const wikilink of value.matchAll(WIKILINK_RE)) {
        edges.push({
          label: match[1].trim(),
          target: wikilink[1].trim(),
          alias: wikilink[2]?.trim(),
        })
      }
    }
  }
  return edges
}

export function convertWikilinks(source, resolve) {
  let converted = 0
  let unresolved = 0
  // Mask fenced and inline code so wikilink examples inside code (e.g. the
  // `[[slug]]` syntax shown in documentation) are never rewritten into links.
  const codeSpans = []
  const masked = source.replace(/(```[\s\S]*?```|`[^`\n]*`)/g, (span) => {
    codeSpans.push(span)
    return `${codeSpans.length - 1}`
  })
  const replaced = masked.replace(WIKILINK_RE, (_all, targetValue, aliasValue) => {
    const target = targetValue.trim()
    const text = (aliasValue ?? targetValue).trim()
    const resolved = resolve(target)
    if (!resolved) {
      unresolved += 1
      return `[${text}](/${target.replace(/\.md$/i, "")}.md)`
    }
    converted += 1
    return `[${text}](/${resolved})`
  })
  const content = replaced.replace(/(\d+)/g, (_m, index) => codeSpans[Number(index)])
  return { content, converted, unresolved }
}
