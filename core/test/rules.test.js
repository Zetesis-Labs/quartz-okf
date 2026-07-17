import assert from "node:assert/strict"
import test from "node:test"
import { validateDocument, validateDocuments } from "../lib/rules.js"

test("separates core, profile, and hygiene violations", () => {
  const result = validateDocument({
    id: "apps/apps",
    path: "apps/apps.md",
    body: "# Topology\n\n* **Invented**: [[target]]\n",
    frontmatter: { type: "invented", tags: "Not A List" },
    parseError: null,
  })
  assert.deepEqual(
    result.violations.map(({ rule, level }) => [rule, level]),
    [
      ["profile/type-closed", "error"],
      ["profile/folder-note-alias", "error"],
      ["hygiene/title-recommended", "warn"],
      ["hygiene/description-recommended", "warn"],
      ["hygiene/tags-shape", "warn"],
      ["profile/edge-label-closed", "warn"],
    ],
  )
})

test("permits root index metadata but rejects it in nested indexes", () => {
  const root = validateDocument({
    id: "index",
    path: "index.md",
    body: "# Root\n",
    frontmatter: { okf_version: "0.1" },
    parseError: null,
  })
  const nested = validateDocument({
    id: "nested/index",
    path: "nested/index.md",
    body: "# Nested\n",
    frontmatter: { type: "concept" },
    parseError: null,
  })
  assert.equal(root.violations.length, 0)
  assert.equal(nested.violations[0].rule, "core/index-frontmatter")
})

test("can opt into unresolved-edge diagnostics without changing core conformance", () => {
  const documents = validateDocuments(
    [
      {
        id: "service",
        path: "service.md",
        body: "# Topology\n\n* **Uses**: [[pending]]\n",
        frontmatter: { type: "service", title: "Service", description: "Test." },
        parseError: null,
      },
    ],
    { ruleLevels: { "hygiene/unresolved-edge": "warn" } },
  )
  assert.equal(
    documents[0].violations.some((violation) => violation.rule === "hygiene/unresolved-edge"),
    true,
  )
})
