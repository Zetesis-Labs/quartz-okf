#!/usr/bin/env node
import process from "node:process"
import { mountSubgraphs } from "../mount.ts"

const args = process.argv.slice(2)
let cacheRoot
const positional = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--cache") cacheRoot = args[++index]
  else positional.push(args[index])
}
if (positional.length !== 3) {
  console.error("usage: okf-federate <parent-repository> <content-dir> <artifacts-dir> [--cache <dir>]")
  process.exit(2)
}

const [parentRoot, contentOut, artifactsOut] = positional
try {
  const result = await mountSubgraphs(parentRoot, contentOut, artifactsOut, { cacheRoot })
  console.log(`[okf] federation: ${result.mounted.length} subgraph(s) mounted`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
