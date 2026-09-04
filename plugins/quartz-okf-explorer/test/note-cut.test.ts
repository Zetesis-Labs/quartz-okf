import assert from "node:assert/strict"
import test from "node:test"
import { cutFragment } from "../lib/note-cut.ts"

// A document just wide enough for the cut: ids, parents, tag names and outer HTML.
function el(tagName, { id = null, text = "", children = [] } = {}) {
  const node = {
    tagName,
    id,
    children,
    parentElement: null,
    get outerHTML() {
      const attribute = node.id ? ` id="${node.id}"` : ""
      const inner = node.children.length ? node.children.map((child) => child.outerHTML).join("") : text
      return `<${tagName.toLowerCase()}${attribute}>${inner}</${tagName.toLowerCase()}>`
    },
    closest(selector) {
      let current = node
      while (current) {
        if (current.tagName.toLowerCase() === selector) return current
        current = current.parentElement
      }
      return null
    },
    querySelector(selector) {
      for (const child of node.children) {
        if (child.tagName.toLowerCase() === selector) return child
        const deeper = child.querySelector(selector)
        if (deeper) return deeper
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
  return { getElementById: (id) => index.get(id) ?? null }
}

const catalogue = () =>
  el("ARTICLE", {
    children: [
      el("H1", { id: "entries", text: "Entries" }),
      el("TABLE", {
        children: [
          el("THEAD", { children: [el("TR", { text: "Code Name" })] }),
          el("TBODY", {
            children: [
              el("TR", { id: "ac001", text: "AC001 Student Recruitment" }),
              el("TR", { id: "ac002", text: "AC002 Agent Management" }),
            ],
          }),
        ],
      }),
      el("H2", { id: "notes", text: "Notes" }),
      el("P", { text: "First note." }),
      el("H3", { id: "detail", text: "Detail" }),
      el("P", { text: "Deeper." }),
      el("H2", { id: "after", text: "After" }),
      el("P", { text: "Out of the section." }),
    ],
  })

test("a row is cut to its table's header and that row alone", () => {
  const html = cutFragment(documentOf(catalogue()), "ac002")
  assert.equal(
    html,
    '<table><thead><tr>Code Name</tr></thead><tbody><tr id="ac002">AC002 Agent Management</tr></tbody></table>',
  )
})

test("a heading is cut to its section, down to the next heading of its level or above", () => {
  const html = cutFragment(documentOf(catalogue()), "notes")
  assert.ok(html.includes("First note."))
  assert.ok(html.includes("Deeper."), "a deeper heading stays inside the section")
  assert.ok(!html.includes("Out of the section."))
  assert.ok(!html.includes("After"))
})

test("any other anchored element is cut to itself, and an unknown fragment cuts nothing", () => {
  const document = documentOf(catalogue())
  assert.equal(cutFragment(document, "missing"), null)
  const table = el("TABLE", { children: [el("TBODY", { children: [el("TR", { id: "row", text: "x" })] })] })
  assert.equal(
    cutFragment(documentOf(el("ARTICLE", { children: [table] })), "row"),
    "<table><tbody><tr id=\"row\">x</tr></tbody></table>",
  )
})
