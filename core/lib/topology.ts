import { anchorSlug } from "./anchor.ts"
import type { TopologyEdge } from "./types.ts"

export const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]+))?\]\]/g

/** A target and the fragment it carries, as written: `note#ID` addresses a row of `note`. */
function withFragment(target: string, fragment: string | undefined): string {
  const value = target.trim()
  const anchor = fragment?.trim()
  return anchor ? `${value}#${anchor}` : value
}

// Lines inside fenced code are documentation examples, not structure: a
// fenced `# Topology` must neither open a section nor contribute edges.
export function fencedLineMask(lines: string[]): boolean[] {
  const mask: boolean[] = new Array(lines.length).fill(false)
  let fence: string | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const marker = lines[index].match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      mask[index] = true
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null
    } else if (marker) {
      mask[index] = true
      fence = marker[1]
    }
  }
  return mask
}

export function extractSection(source: string, heading: string, stopAtAnyHeading = false): string[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  const fenced = fencedLineMask(lines)
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const headingRe = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, "i")
  let start = -1
  let level = 0
  for (let index = 0; index < lines.length; index += 1) {
    if (fenced[index]) continue
    const match = lines[index].match(headingRe)
    if (match) {
      start = index + 1
      level = match[1].length
      break
    }
  }
  if (start < 0) return []
  const section: string[] = []
  for (let index = start; index < lines.length; index += 1) {
    if (fenced[index]) continue
    const nextHeading = lines[index].match(/^(#{1,6})\s+/)
    // La topología es un bloque de declaraciones, no un capítulo: termina en el primer
    // encabezado que venga, sea del nivel que sea. Por semántica de Markdown un `#` contiene
    // a los `##` que le siguen, y la convención escribe `# Topology` seguido del cuerpo en
    // `##`: leerla como capítulo se traga la nota entera y convierte cualquier viñeta en
    // negrita de la prosa en una relación tipada inventada.
    if (nextHeading && (stopAtAnyHeading || nextHeading[1].length <= level)) break
    section.push(lines[index])
  }
  return section
}

// Standard internal markdown links are the exported (bundle) spelling of
// wikilinks; parsing both keeps topology hygiene meaningful on the bundle.
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g

export function markdownLinkTarget(url: string): string | undefined {
  if (!url.startsWith("/") || url.startsWith("//")) return undefined
  const [path, fragment] = url.slice(1).split("#")
  const target = path.replace(/\.md$/i, "")
  return target ? withFragment(target, fragment) : undefined
}

export interface WikilinkRef {
  target: string
  alias?: string
}

/** Every wikilink of a fragment of prose, with the fragment kept in the target. */
export function wikilinkRefs(value: string): WikilinkRef[] {
  return [...value.matchAll(WIKILINK_RE)].map((match) => ({
    target: withFragment(match[1], match[2]),
    alias: match[3]?.trim(),
  }))
}

/**
 * The links the prose makes to a row of a catalogue. A link to a note is prose — the
 * relations between notes are declared in `# Topology`, not guessed from a paragraph — but
 * a link that names an entry of a catalogue is unambiguous: it cites that entry.
 */
export function parseBodyLinks(source: string, heading = "Topology"): string[] {
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  const fenced = fencedLineMask(lines)
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const headingRe = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, "i")
  const targets: string[] = []
  let inTopology = false
  for (const [index, line] of lines.entries()) {
    if (fenced[index]) continue
    if (headingRe.test(line)) {
      inTopology = true
      continue
    }
    if (inTopology && /^#{1,6}\s+/.test(line)) inTopology = false
    if (inTopology) continue
    const value = line.replace(/`[^`\n]*`/g, "")
    for (const link of wikilinkRefs(value)) {
      if (link.target.includes("#")) targets.push(link.target)
    }
    for (const link of value.matchAll(MARKDOWN_LINK_RE)) {
      if (link.index > 0 && value[link.index - 1] === "!") continue
      const target = markdownLinkTarget(link[2])
      if (target?.includes("#")) targets.push(target)
    }
  }
  return [...new Set(targets)]
}

export function parseTopologyEdges(source: string, heading = "Topology"): TopologyEdge[] {
  const edges: TopologyEdge[] = []
  for (const line of extractSection(source, heading, true)) {
    if (!/^\s*[*-]\s+/.test(line)) continue
    const matches = [...line.matchAll(/\*\*([^*]+?)\*\*\s*:/g)]
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]
      const start = match.index + match[0].length
      const end = matches[index + 1]?.index ?? line.length
      const value = line.slice(start, end).replace(/`[^`\n]*`/g, "")
      for (const wikilink of wikilinkRefs(value)) {
        edges.push({ label: match[1].trim(), target: wikilink.target, alias: wikilink.alias })
      }
      for (const link of value.matchAll(MARKDOWN_LINK_RE)) {
        if (link.index > 0 && value[link.index - 1] === "!") continue
        if (value[link.index - 1] === "[") continue
        const target = markdownLinkTarget(link[2])
        if (!target) continue
        edges.push({ label: match[1].trim(), target, alias: link[1].trim() || undefined })
      }
    }
  }
  return edges
}

export interface WikilinkConversion {
  content: string
  converted: number
  unresolved: number
}

export function convertWikilinks(
  source: string,
  resolve: (target: string) => string | null | undefined,
): WikilinkConversion {
  let converted = 0
  let unresolved = 0
  // Mask fenced and inline code so wikilink examples inside code (e.g. the
  // `[[slug]]` syntax shown in documentation) are never rewritten into links. The
  // placeholder wraps the index in a private-use character: bare digits would make
  // every number in the note a code span when the mask is lifted.
  const codeSpans: string[] = []
  const masked = source.replace(/(```[\s\S]*?```|`[^`\n]*`)/g, (span) => {
    codeSpans.push(span)
    return `\uE000${codeSpans.length - 1}\uE000`
  })
  const replaced = masked.replace(
    WIKILINK_RE,
    (_all, targetValue: string, fragmentValue: string | undefined, aliasValue?: string) => {
      const target = targetValue.trim()
      const text = (aliasValue ?? targetValue).trim()
      const anchor = fragmentValue?.trim() ? `#${anchorSlug(fragmentValue)}` : ""
      const resolved = resolve(target)
      if (!resolved) {
        unresolved += 1
        return `[${text}](/${target.replace(/\.md$/i, "")}.md${anchor})`
      }
      converted += 1
      return `[${text}](/${resolved}${anchor})`
    },
  )
  const content = replaced.replace(/\uE000(\d+)\uE000/g, (_m, index: string) => codeSpans[Number(index)])
  return { content, converted, unresolved }
}
