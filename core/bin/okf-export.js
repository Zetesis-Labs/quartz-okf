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
// okf.config.js at its repository root. Absent that, the toolkit stays generic.
async function loadConsumerBranding(repo) {
  const configPath = path.join(path.resolve(repo), "okf.config.js")
  try {
    await fs.access(configPath)
  } catch {
    return REFERENCE_BRANDING
  }
  const config = await import(pathToFileURL(configPath).href)
  return { ...REFERENCE_BRANDING, ...(config.branding ?? config.default?.branding ?? {}) }
}

const branding = await loadConsumerBranding(positional[0])
const result = await exportBundle(positional[0], positional[1], { trackedOnly, branding })
console.log(
  `[okf] exported ${result.graph.stats.notes} concepts and ${result.graph.stats.edges} edges to ${result.output}`,
)
console.log(
  `[okf] wikilinks: ${result.converted} resolved, ${result.unresolvedLinks} unresolved; stale=${result.manifest.stale}`,
)
