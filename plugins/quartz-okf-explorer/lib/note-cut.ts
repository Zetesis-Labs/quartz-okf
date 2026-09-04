/**
 * A node may be part of a page — a catalog row — so the reading dock shows the piece the
 * fragment names, not the whole article. The interface is the slice of the DOM this needs,
 * which a real `Document` satisfies; the tests supply their own.
 */
export interface CutElement {
  tagName: string
  outerHTML: string
  parentElement: CutElement | null
  children: ArrayLike<CutElement>
  closest(selector: string): CutElement | null
  querySelector(selector: string): CutElement | null
}

export interface CutDocument {
  getElementById(id: string): CutElement | null
}

const HEADING = /^h([1-6])$/i

const headingLevel = (element: CutElement): number | null => {
  const match = HEADING.exec(element.tagName)
  return match ? Number(match[1]) : null
}

function sectionOf(heading: CutElement, level: number): string {
  const siblings = Array.from(heading.parentElement?.children ?? [])
  const start = siblings.indexOf(heading)
  const parts: string[] = []
  for (let index = start; index < siblings.length; index += 1) {
    const element = siblings[index]
    const next = headingLevel(element)
    if (index > start && next !== null && next <= level) break
    parts.push(element.outerHTML)
  }
  return parts.join("")
}

function rowOf(row: CutElement): string {
  const head = row.closest("table")?.querySelector("thead")
  return `<table>${head?.outerHTML ?? ""}<tbody>${row.outerHTML}</tbody></table>`
}

/** The page's fragment as its own document, or null when nothing answers to it. */
export function cutFragment(document: CutDocument, fragment: string): string | null {
  const target = document.getElementById(fragment)
  if (!target) return null
  const row = target.closest("tr")
  if (row) return rowOf(row)
  const level = headingLevel(target)
  if (level !== null) return sectionOf(target, level)
  return target.outerHTML
}
