/**
 * A node may be part of a page — a catalog row — so the reading dock opens the note whole
 * and marks the piece the fragment names, which is what the reader came for. The interface
 * is the slice of the DOM this needs, which a real `Document` satisfies; the tests supply
 * their own.
 */
export interface FocusElement {
  tagName: string
  parentElement: FocusElement | null
  closest(selector: string): FocusElement | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

export interface FocusDocument {
  getElementById(id: string): FocusElement | null
}

/** The attribute the dock scrolls to and paints. */
export const FOCUS_ATTRIBUTE = "data-okf-focus"

/**
 * What the fragment stands for: a row when the anchor sits inside one — a catalogue's
 * anchors live in a cell — and the anchored element itself otherwise.
 */
export function focusTarget(document: FocusDocument, fragment: string): FocusElement | null {
  const target = document.getElementById(fragment)
  if (!target) return null
  return target.closest("tr") ?? target
}

/**
 * Renders `html()` with the fragment's element marked. The mark comes off right after,
 * because the page is cached and the next entry of the same note would inherit it.
 */
export function withFocus(target: FocusElement | null, html: () => string): string {
  if (!target) return html()
  target.setAttribute(FOCUS_ATTRIBUTE, "")
  const rendered = html()
  target.removeAttribute(FOCUS_ATTRIBUTE)
  return rendered
}
