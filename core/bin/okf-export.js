#!/usr/bin/env node
import process from "node:process"
import { exportBundle } from "../lib/exporter.js"
import { loadConsumerConfig } from "../lib/consumer-config.js"

const args = process.argv.slice(2)
// Tracked-only is the safe default: local drafts (gitignored or untracked)
// must never leak into a bundle by omission. --tracked-only remains accepted.
const trackedOnly = !args.includes("--include-untracked")
const positional = args.filter(
  (arg) => arg !== "--tracked-only" && arg !== "--include-untracked",
)
if (positional.length !== 2) {
  console.error("usage: okf-export <repository> <output> [--include-untracked]")
  process.exit(2)
}

const consumer = await loadConsumerConfig(positional[0])
const result = await exportBundle(positional[0], positional[1], {
  trackedOnly,
  branding: consumer.branding,
  profile: consumer.profile,
})
console.log(
  `[okf] exported ${result.graph.stats.notes} concepts and ${result.graph.stats.edges} edges to ${result.output}`,
)
console.log(
  `[okf] wikilinks: ${result.converted} resolved, ${result.unresolvedLinks} unresolved; stale=${result.manifest.stale}`,
)
