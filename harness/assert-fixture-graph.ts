#!/usr/bin/env node
// The smoke build's assertion: the fixture must produce exactly this graph. A change in
// the engine's output shows up here, in this repository, and not as a surprise in a
// consumer that pinned the commit.
//
// Usage: node harness/assert-fixture-graph.ts [fixture-root]
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "fixture"))
const read = async (file: string) => JSON.parse(await fs.readFile(path.join(root, file), "utf8"))

interface Node {
  slug: string
  type: string
  title: string
}
interface Expected {
  nodes: Node[]
  edges: [string, string, string][]
  stats: Record<string, number>
  types: string[]
  edgeLabels: string[]
}

const expected = (await read("expected-graph.json")) as Expected
const built = (await read("public/static/okf-graph.json")) as {
  nodes: Node[]
  edges: { source: string; label: string; target: string }[]
  stats: Record<string, number>
  types: string[]
  edgeLabels: string[]
}

const bySlug = (left: Node, right: Node) => left.slug.localeCompare(right.slug)
const nodes = built.nodes.map((node) => ({ slug: node.slug, type: node.type, title: node.title })).sort(bySlug)
const edges = built.edges.map((edge) => [edge.source, edge.label, edge.target]).sort()

assert.deepEqual(nodes, expected.nodes, "the fixture's nodes changed")
assert.deepEqual(edges, expected.edges.map((edge) => [...edge]), "the fixture's edges changed")
assert.deepEqual(built.stats, expected.stats, "the fixture's counts changed")
assert.deepEqual(built.types, expected.types, "the profile's types changed")
assert.deepEqual(built.edgeLabels, expected.edgeLabels, "the profile's edge labels changed")

// A wikilink inside a code span is prose: it must reach the page as text and never
// become an edge. This is the regression 003 shipped and a consumer's build caught.
const page = await fs.readFile(path.join(root, "public/concepts/graph.html"), "utf8")
assert.ok(page.includes("[[concepts/format]]"), "the wikilink inside a code span was rewritten")

// What a table states holds for every row of it, and an annotating note may say what an
// entry means here — the catalogue's own wording is not always the useful one.
const rows = built.nodes.filter((node) => (node as { row?: unknown }).row) as ({ slug: string; description?: string; properties?: Record<string, unknown> })[]
assert.deepEqual(
  rows.map((node) => node.properties?.rank),
  ["mid", "leaf", "leaf"],
  "the value each table states did not reach its rows",
)
assert.equal(
  rows.find((node) => node.slug === "standards/arm#ac001")?.description,
  "What this corpus decided to do with it.",
  "the annotating note did not rewrite the entry's description",
)

// A row node promises a URL that lands on its row: the rendered page must carry the anchor.
const catalogue = await fs.readFile(path.join(root, "public/standards/arm.html"), "utf8")
assert.ok(catalogue.includes('data-okf-catalog'), "the catalogue table was not marked")
assert.ok(catalogue.includes('id="ac001"'), "the row anchor was not written")
assert.ok(
  catalogue.includes('data-okf-node="standards/arm#ac001"'),
  "the row does not name the node it stands for",
)

// The whole design rests on one equality: the anchor the toolkit writes is the one Quartz
// derives for `[[note#ID]]`. A build is the only place that can prove it.
const analysis = await fs.readFile(path.join(root, "public/analysis/gap.html"), "utf8")
assert.ok(
  analysis.includes('href="../standards/arm#ac001"'),
  "a wikilink with a fragment does not point at the row's anchor",
)

console.log(`[okf] fixture graph as expected: ${nodes.length} nodes, ${edges.length} edges`)
