#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { exportBundle } from "../lib/exporter.js"
import { BRANDING as REFERENCE_BRANDING } from "../profile.js"

const args = process.argv.slice(2)
const trackedOnly = args.includes("--tracked-only")
const positional = args.filter((arg) => arg !== "--tracked-only")
if (positional.length !== 2) {
  console.error("usage: okf-export <repository> <output> [--tracked-only]")
  process.exit(2)
}

// A consumer supplies its own branding (and, later, its own profile) via an
// okf.config file at its repository root. Prefer .mjs so it loads as ESM even
// when the consumer repo has no "type": "module". Absent it, stay generic.
async function loadConsumerBranding(repo) {
  const root = path.resolve(repo)
  for (const name of ["okf.config.mjs", "okf.config.js"]) {
    const configPath = path.join(root, name)
    try {
      await fs.access(configPath)
    } catch {
      continue
    }
    const config = await import(pathToFileURL(configPath).href)
    return { ...REFERENCE_BRANDING, ...(config.branding ?? config.default?.branding ?? {}) }
  }
  return REFERENCE_BRANDING
}

const branding = await loadConsumerBranding(positional[0])
const result = await exportBundle(positional[0], positional[1], { trackedOnly, branding })
console.log(
  `[okf] exported ${result.graph.stats.notes} concepts and ${result.graph.stats.edges} edges to ${result.output}`,
)
console.log(
  `[okf] wikilinks: ${result.converted} resolved, ${result.unresolvedLinks} unresolved; stale=${result.manifest.stale}`,
)
