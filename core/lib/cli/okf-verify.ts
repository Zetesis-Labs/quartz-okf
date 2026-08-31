#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { readModuleConfig } from "../consumer-config.ts"
import { walk } from "../files.ts"
import { EXPLORER_PAGE, GRAPH_DOCUMENT, matchesGlob, verifySite } from "../verify.ts"
import type { SiteFacts, VerifyFloors } from "../types.ts"

function usage(): never {
  console.error("usage: okf-verify <repo> [--site <dir>] [--json]")
  process.exit(2)
}

const args = process.argv.slice(2)
const json = args.includes("--json")
let site: string | undefined
const positional: string[] = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--site") site = args[++index]
  else if (args[index] !== "--json") positional.push(args[index])
}
if (positional.length > 1) usage()

const root = path.resolve(positional[0] ?? ".")
const siteDir = path.resolve(site ?? path.join(root, "public"))

const exists = async (file: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(file)
    return stat.size > 0 || stat.isDirectory()
  } catch {
    return false
  }
}

async function readGraph(file: string): Promise<{ nodes: number; edges: number } | null> {
  try {
    const document = JSON.parse(await fs.readFile(file, "utf8")) as { nodes?: unknown[]; edges?: unknown[] }
    if (!Array.isArray(document.nodes) || !Array.isArray(document.edges)) return null
    return { nodes: document.nodes.length, edges: document.edges.length }
  } catch {
    return null
  }
}

/** What the explorer's page pulls from `/static`: a blank canvas is otherwise silent. */
async function explorerFacts(pageFile: string, graphInput: string): Promise<SiteFacts["explorer"]> {
  const page = path.join(siteDir, pageFile)
  let html: string
  try {
    html = await fs.readFile(page, "utf8")
  } catch {
    return null
  }
  const referenced = [...html.matchAll(/<script src="\/static\/([^"]+)"/g)].map((match) => match[1])
  const names = [...new Set([...referenced, graphInput.replace(/^\/?static\//, "")])]
  return {
    present: true,
    assets: await Promise.all(
      names.map(async (name) => ({ name, present: await exists(path.join(siteDir, "static", name)) })),
    ),
  }
}

async function pageFacts(): Promise<SiteFacts["page"]> {
  const relative = "index.html"
  try {
    const html = await fs.readFile(path.join(siteDir, relative), "utf8")
    return { path: relative, widget: html.includes('class="okf-explorer'), config: html.includes("data-cfg=") }
  } catch {
    return null
  }
}

async function countPages(globs: string[]): Promise<SiteFacts["counts"]> {
  if (globs.length === 0) return []
  const pages = (await walk(siteDir)).map((file) => file.relative)
  return globs.map((glob) => ({ glob, count: pages.filter((page) => matchesGlob(glob, page)).length }))
}

const config = await readModuleConfig(root)
const floors: VerifyFloors = {
  component: config?.explorer?.injectAccess === false ? false : undefined,
  ...(config?.build?.verify ?? {}),
}
const graphInput = config?.explorer?.graphInput ?? GRAPH_DOCUMENT
const explorerPage = config?.explorer?.output ?? EXPLORER_PAGE

const facts: SiteFacts = {
  index: await exists(path.join(siteDir, "index.html")),
  graph: await readGraph(path.join(siteDir, GRAPH_DOCUMENT)),
  explorer: await explorerFacts(explorerPage, graphInput),
  page: await pageFacts(),
  counts: await countPages((floors.pages ?? []).map((floor) => floor.glob)),
}

const problems = verifySite(facts, floors)

if (json) {
  console.log(JSON.stringify({ site: siteDir, facts, problems }, null, 2))
} else if (problems.length === 0) {
  const counted = facts.counts.map((entry) => `${entry.count} × ${entry.glob}`).join(", ")
  console.log(`[okf] verified ${siteDir}: ${facts.graph?.nodes ?? 0} nodes, ${facts.graph?.edges ?? 0} edges${counted ? `, ${counted}` : ""}`)
} else {
  for (const problem of problems) console.error(`[okf] ${problem.code} — ${problem.message}`)
}

process.exit(problems.length === 0 ? 0 : 1)
