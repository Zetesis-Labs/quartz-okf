import assert from "node:assert/strict"
import test from "node:test"
import { FOCUS_ATTRIBUTE, focusTarget, withFocus } from "../lib/note-focus.ts"

// A document just wide enough for the focus: ids, parents, tag names and attributes.
function el(tagName, { id = null, children = [] } = {}) {
  const node = {
    tagName,
    id,
    children,
    attributes: {},
    parentElement: null,
    setAttribute(name, value) {
      node.attributes[name] = value
    },
    removeAttribute(name) {
      delete node.attributes[name]
    },
    closest(selector) {
      let current = node
      while (current) {
        if (current.tagName.toLowerCase() === selector) return current
        current = current.parentElement
      }
      return null
    },
  }
  for (const child of children) child.parentElement = node
  return node
}

function documentOf(root) {
  const index = new Map()
  const walk = (node) => {
    if (node.id) index.set(node.id, node)
    for (const child of node.children) walk(child)
  }
  walk(root)
  return { document: { getElementById: (id) => index.get(id) ?? null }, root }
}

const page = () => {
  const anchor = el("SPAN", { id: "de203" })
  const row = el("TR", { children: [el("TD", { children: [anchor] })] })
  const heading = el("H2", { id: "entities" })
  return documentOf(
    el("ARTICLE", {
      children: [heading, el("TABLE", { children: [el("TBODY", { children: [row] })] })],
    }),
  )
}

test("an anchor inside a cell focuses its row, not the cell", () => {
  const { document } = page()
  assert.equal(focusTarget(document, "de203").tagName, "TR")
})

test("an anchor that is not in a table focuses the element itself", () => {
  const { document } = page()
  assert.equal(focusTarget(document, "entities").tagName, "H2")
})

test("an unknown fragment focuses nothing", () => {
  const { document } = page()
  assert.equal(focusTarget(document, "missing"), null)
})

test("withFocus marks only while the page is rendered, so the cache stays clean", () => {
  const { document } = page()
  const row = focusTarget(document, "de203")
  const rendered = withFocus(row, () => (FOCUS_ATTRIBUTE in row.attributes ? "marked" : "bare"))
  assert.equal(rendered, "marked")
  assert.deepEqual(row.attributes, {}, "the mark was left on the cached page")
  assert.equal(withFocus(null, () => "whole note"), "whole note")
})
