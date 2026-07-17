#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { gitChangedFiles, gitHead } from "../lib/git.js"
import { loadDocuments } from "../lib/files.js"

const repo = path.resolve(process.argv[2] ?? ".")
let state = {}
try {
  state = JSON.parse(await fs.readFile(path.join(repo, "okf/state.json"), "utf8"))
} catch {
  // A missing state intentionally produces an empty impact baseline.
}
const fromHead = process.argv[3] ?? state.last_maintained_head
if (!fromHead) {
  console.error("[okf] no last_maintained_head; pass a baseline commit")
  process.exit(2)
}
const changes = gitChangedFiles(repo, fromHead)
const changedPaths = changes.flatMap((change) => change.paths)
const infraPaths = changedPaths.filter(
  (filePath) =>
    !filePath.endsWith(".md") &&
    !filePath.startsWith("okf/") &&
    !filePath.startsWith(".codex/") &&
    !filePath.startsWith(".agents/") &&
    !filePath.startsWith(".github/"),
)
const documents = (await loadDocuments(repo)).filter(
  (document) => !document.reserved && document.frontmatter?.type,
)
const scored = new Map()
for (const changedPath of infraPaths) {
  const changedDirectory = path.posix.dirname(changedPath)
  const changedParts = changedDirectory.split("/")
  for (const document of documents) {
    let score = 0
    const documentDirectory = path.posix.dirname(document.path)
    if (
      changedDirectory === documentDirectory ||
      changedDirectory.startsWith(`${documentDirectory}/`) ||
      documentDirectory.startsWith(`${changedDirectory}/`)
    ) {
      score += 10
    }
    for (const part of changedParts.filter((item) => item.length > 3)) {
      if (
        document.path.toLowerCase().includes(part.toLowerCase()) ||
        document.body.toLowerCase().includes(part.toLowerCase())
      ) {
        score += 1
      }
    }
    if (score > 0) scored.set(document.path, (scored.get(document.path) ?? 0) + score)
  }
}
const budget =
  infraPaths.length <= 3
    ? Math.min(2, Math.max(1, infraPaths.length))
    : infraPaths.length <= 10
      ? 4
      : Math.min(8, Math.ceil(infraPaths.length / 3))
const candidates = [...scored.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, budget)
  .map(([file, score]) => ({ file, score }))

console.log("# OKF impact plan")
console.log("")
console.log(`Baseline: \`${fromHead}\``)
console.log(`Target: \`${gitHead(repo)}\``)
console.log(`Infrastructure files changed: ${infraPaths.length}`)
console.log(`Diff budget: at most ${budget} knowledge notes`)
console.log("")
console.log("## Changes")
console.log("")
for (const change of changes) console.log(`* ${change.status}: ${change.paths.join(" → ")}`)
console.log("")
console.log("## Candidate notes")
console.log("")
if (candidates.length) {
  for (const candidate of candidates) console.log(`* ${candidate.file} (impact score ${candidate.score})`)
} else {
  console.log("* No existing note matched; inspect the nearest structural scope before creating one.")
}
