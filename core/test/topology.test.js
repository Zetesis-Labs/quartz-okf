import assert from "node:assert/strict"
import test from "node:test"
import { convertWikilinks, parseTopologyEdges } from "../lib/topology.js"

test("parses multiple typed edge segments from one prose bullet", () => {
  const source = `# Topology

* **State in**: [[pizarro-data]] · **Backed by**: [[restic-offsite|Restic]]
* **Uses**: [[cnpg]], [[zfs]]

# Details

* **Wrong**: [[ignored]]
`
  assert.deepEqual(parseTopologyEdges(source), [
    { label: "State in", target: "pizarro-data", alias: undefined },
    { label: "Backed by", target: "restic-offsite", alias: "Restic" },
    { label: "Uses", target: "cnpg", alias: undefined },
    { label: "Uses", target: "zfs", alias: undefined },
  ])
})

test("converts resolved links and preserves unresolved links as legal broken links", () => {
  const result = convertWikilinks("[A] [[a|Alpha]] and [[missing]].", (target) =>
    target === "a" ? "docs/a.md" : null,
  )
  assert.equal(result.content, "[A] [Alpha](/docs/a.md) and [missing](/missing.md).")
  assert.equal(result.converted, 1)
  assert.equal(result.unresolved, 1)
})

test("does not rewrite wikilinks inside inline or fenced code", () => {
  const result = convertWikilinks(
    "Syntax is `[[slug]]`; real [[pizarro]].\n```\n[[also-code]]\n```\n",
    (target) => (target === "pizarro" ? "tl-pizarro/pizarro" : null),
  )
  assert.ok(result.content.includes("`[[slug]]`"))
  assert.ok(result.content.includes("[[also-code]]"))
  assert.ok(result.content.includes("[pizarro](/tl-pizarro/pizarro)"))
  assert.equal(result.converted, 1)
  assert.equal(result.unresolved, 0)
})
