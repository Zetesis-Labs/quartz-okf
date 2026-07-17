#!/usr/bin/env node
import path from "node:path"
import process from "node:process"
import { loadDocuments } from "../lib/files.js"

function usage() {
  console.error("usage: okf-check [bundle] [--format text|json] [--rule name=off|warn|error]")
}

const args = process.argv.slice(2)
let target = "."
let format = "text"
const ruleLevels = {}
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === "--format") format = args[++index]
  else if (arg === "--rule") {
    const [name, level] = String(args[++index]).split("=")
    if (!name || !["off", "warn", "error"].includes(level)) {
      usage()
      process.exit(2)
    }
    ruleLevels[name] = level
  } else if (arg.startsWith("-")) {
    usage()
    process.exit(2)
  } else target = arg
}

const root = path.resolve(target)
const documents = await loadDocuments(root, { ruleLevels })
const violations = documents.flatMap((document) =>
  document.violations.map((violation) => ({ file: document.path, ...violation })),
)
const errors = violations.filter((violation) => violation.level === "error")
const warnings = violations.filter((violation) => violation.level === "warn")

if (format === "json") {
  console.log(
    JSON.stringify(
      {
        bundle: root,
        ok: errors.length === 0,
        stats: { documents: documents.length, errors: errors.length, warnings: warnings.length },
        violations,
      },
      null,
      2,
    ),
  )
} else {
  for (const item of violations) {
    const output = item.level === "error" ? console.error : console.warn
    output(`[okf] ${item.level.toUpperCase()}: ${item.file}: [${item.rule}] ${item.message}`)
  }
  console.log(
    `[okf] checked ${documents.length} markdown files: ${errors.length} error(s), ${warnings.length} warning(s)`,
  )
}
process.exitCode = errors.length ? 1 : 0
