#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { loadConsumerConfig } from "../lib/consumer-config.js"
import { loadDocuments } from "../lib/files.js"
import { validateDocuments } from "../lib/rules.js"
import { buildGraph } from "../lib/graph.js"
import { buildScopeDiagram, weaveDiagram } from "../lib/diagram.js"

const args = process.argv.slice(2)
const check = args.includes("--check")
const typesArg = args.find((arg) => arg.startsWith("--types="))
const scopeTypes = typesArg ? typesArg.slice("--types=".length).split(",") : ["cluster"]
const positional = args.filter((arg) => arg !== "--check" && !arg.startsWith("--types="))
if (positional.length !== 1) {
  console.error("usage: okf-diagram <repository> [--check] [--types=cluster,...]")
  process.exit(2)
}
const repo = path.resolve(positional[0])

const { profile } = await loadConsumerConfig(repo)
const documents = validateDocuments(await loadDocuments(repo), { profile })
const graph = buildGraph(documents, { profile })

const stale = []
let written = 0
for (const document of documents) {
  if (document.reserved || !scopeTypes.includes(document.frontmatter?.type)) continue
  const mermaid = buildScopeDiagram(graph, document.id)
  if (!mermaid) continue
  const filePath = path.join(repo, document.path)
  const source = await fs.readFile(filePath, "utf8")
  const woven = weaveDiagram(source, mermaid)
  if (woven === source) continue
  if (check) {
    stale.push(document.path)
    continue
  }
  await fs.writeFile(filePath, woven)
  written += 1
  console.log(`[okf] diagram updated: ${document.path}`)
}

if (check && stale.length > 0) {
  console.error(`[okf] stale diagrams (run okf-diagram): ${stale.join(", ")}`)
  process.exit(1)
}
console.log(
  check ? "[okf] diagrams up to date" : `[okf] ${written} diagram(s) written`,
)
