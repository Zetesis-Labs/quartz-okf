import assert from "node:assert/strict"
import test from "node:test"
import { convertWikilinks, parseBodyLinks, parseTopologyEdges } from "../lib/topology.ts"

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

test("ignores fenced Topology examples entirely", () => {
  const doc = [
    "# Convention",
    "",
    "```markdown",
    "# Topology",
    "",
    "* **Part of**: [[pizarro]]",
    "* **Uses**: [[cnpg]], [[eso]]",
    "```",
    "",
    "More prose.",
  ].join("\n")
  assert.deepEqual(parseTopologyEdges(doc), [])
})

test("skips fenced examples and inline code inside a real Topology section", () => {
  const doc = [
    "# Topology",
    "",
    "* **Uses**: [[real-target]] (see `[[not-an-edge]]`)",
    "",
    "```markdown",
    "* **Uses**: [[example-target]]",
    "```",
    "",
    "# Next section",
  ].join("\n")
  assert.deepEqual(
    parseTopologyEdges(doc).map((edge) => `${edge.label}:${edge.target}`),
    ["Uses:real-target"],
  )
})

test("parses exported standard-link topology bullets like authored wikilinks", () => {
  const doc = [
    "# Topology",
    "",
    "* **Uses**: [Talos](/docs/technologies/talos), [ZFS](/docs/technologies/zfs.md)",
    "* **About**: [Convention](/okf/okf-convention#rules)",
    "* **Watches**: [external](https://example.com/page), ![diagram](/static/diagram.png)",
  ].join("\n")
  assert.deepEqual(
    parseTopologyEdges(doc).map((edge) => `${edge.label}:${edge.target}`),
    // Since 006 a fragment is part of the target: it may address a row of that note, and
    // the resolver falls back to the note itself when no row answers to it.
    ["Uses:docs/technologies/talos", "Uses:docs/technologies/zfs", "About:okf/okf-convention#rules"],
  )
})

test("la topología termina en el primer encabezado, aunque sea de nivel inferior", () => {
  // La convención escribe `# Topology` y el cuerpo en `##`. Leído como capítulo, el cuerpo
  // queda dentro y cualquier viñeta en negrita de la prosa se vuelve una relación inventada.
  const source = [
    "# Topology",
    "",
    "* **Cites**: [[libros/Una-obra]]",
    "",
    "## Qué leer",
    "",
    "- **Obra de referencia**: [[libros/Otra-obra]], leída con la corrección de arriba.",
  ].join("\n")
  const edges = parseTopologyEdges(source)
  assert.deepEqual(edges.map((e) => e.label), ["Cites"])
})

test("convertWikilinks keeps digits outside code spans and restores every span in place", () => {
  const source = "v1.3 of 2026-06-17: `[[not-a-link]]` and `x = 42` then [[a]] and 7 more."
  const result = convertWikilinks(source, (target) => (target === "a" ? "a" : null))
  assert.equal(result.content, "v1.3 of 2026-06-17: `[[not-a-link]]` and `x = 42` then [a](/a) and 7 more.")
  assert.equal(result.converted, 1)
  assert.equal(result.unresolved, 0)
})

test("keeps the fragment of a wikilink so a row target survives parsing", () => {
  const source = `# Topology

* **Part of**: [[standards/arm#AC001]], [[standards/arm#AC002|Agents]]
* **Uses**: [[tools/okf]]
`
  assert.deepEqual(parseTopologyEdges(source), [
    { label: "Part of", target: "standards/arm#AC001", alias: undefined },
    { label: "Part of", target: "standards/arm#AC002", alias: "Agents" },
    { label: "Uses", target: "tools/okf", alias: undefined },
  ])
})

test("keeps the fragment of an exported markdown link", () => {
  const source = `# Topology

* **Part of**: [AC001](/standards/arm.md#ac001)
`
  assert.deepEqual(parseTopologyEdges(source), [
    { label: "Part of", target: "standards/arm#ac001", alias: "AC001" },
  ])
})

test("converts a fragment-bearing wikilink into a link that lands on the row", () => {
  const result = convertWikilinks("See [[arm#AC001]] and [[arm#AC002|AC002]].", (target) =>
    target === "arm" ? "standards/arm.md" : null,
  )
  assert.equal(
    result.content,
    "See [arm](/standards/arm.md#ac001) and [AC002](/standards/arm.md#ac002).",
  )
  assert.equal(result.converted, 2)
})

test("an unresolved fragment-bearing wikilink keeps its fragment", () => {
  const result = convertWikilinks("[[missing#AC001]]", () => null)
  assert.equal(result.content, "[missing](/missing.md#ac001)")
  assert.equal(result.unresolved, 1)
})

test("reads the body's links to rows, and leaves the rest of the prose alone", () => {
  const source = `---
type: report
---

# Topology

* **About**: [[standards/arm]]

# Análisis

El componente [[standards/arm#AC001]] es el que nos ocupa, y también
[AC002](/standards/arm.md#ac002). La nota [[otra-nota]] no declara nada, ni
\`[[standards/arm#AC999]]\` dentro de código, ni lo de abajo:

\`\`\`markdown
[[standards/arm#AC998]]
\`\`\`

Repetir [[standards/arm#AC001]] no añade una segunda relación.
`
  assert.deepEqual(parseBodyLinks(source), [
    "standards/arm#AC001",
    "standards/arm#ac002",
  ])
})
