import fs from "node:fs/promises"
import path from "node:path"
import {
  PROFILE,
  buildGraph,
  isReserved,
  mergeProfile,
  validateDocument,
} from "../../lib/index.js"
import { stringifyFrontmatter } from "../../lib/frontmatter.js"

const DEFAULTS = {
  strict: true,
  injectTypeTag: true,
  typeTagPrefix: "type",
  requireFolderNoteAlias: true,
  emitGraph: true,
  graphOutput: "static/okf-graph.json",
  emitRaw: true,
  rawOutput: "raw",
}

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function relPathOf(file) {
  const filePath = String(file.data?.filePath ?? file.path ?? "")
  const marker = filePath.lastIndexOf("content/")
  return marker >= 0 ? filePath.slice(marker + "content/".length) : filePath
}

function isAuthoredFile(file) {
  const slug = String(file.data.slug ?? "")
  return Boolean(file.data.filePath) && !slug.startsWith("tags/")
}

function titleFromPath(filePath) {
  return filePath
    .split("/")
    .at(-1)
    .replace(/\.md$/, "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toDocument(file) {
  const filePath = relPathOf(file)
  const reserved = isReserved(filePath)
  let frontmatter = file.data.frontmatter ?? null
  // Same fallback the exporter applies: untyped non-reserved documents become
  // generic concepts so both pipelines expose an identical node set.
  if (!reserved && !frontmatter?.type) {
    frontmatter = {
      ...frontmatter,
      type: "concept",
      title: frontmatter?.title ?? titleFromPath(filePath),
      description:
        frontmatter?.description ?? `Repository documentation imported from ${filePath}.`,
      tags: frontmatter?.tags ?? ["documentation", "fleet"],
      okf_generated_frontmatter: true,
    }
  }
  return {
    id: String(file.data.slug ?? "").replace(/\/index$/, ""),
    path: filePath,
    source: String(file.value ?? ""),
    body: String(file.value ?? ""),
    frontmatter,
    parseError: null,
    reserved,
  }
}

function profileFromOptions(options) {
  const base = mergeProfile(PROFILE, options.profile)
  return {
    ...base,
    types: options.types ?? base.types,
    edgeLabels: options.edgeLabels ?? base.edgeLabels,
    topologyHeading: options.topologyHeading ?? base.topologyHeading,
    ruleLevels: {
      ...base.ruleLevels,
      // Quartz turns authored README files into frontmatter-bearing index pages.
      // Bundle indexes are generated and checked separately by okf-export.
      "core/index-frontmatter": "off",
      "core/log-frontmatter": "off",
      "core/log-date": "off",
      "profile/folder-note-alias": options.requireFolderNoteAlias ? "error" : "off",
    },
  }
}

export const OkfTransformer = (userOptions) => {
  const options = { ...DEFAULTS, ...userOptions }
  const profile = profileFromOptions(options)
  return {
    name: "OkfTransformer",
    markdownPlugins() {
      return [
        () => (_tree, file) => {
          const document = validateDocument(toDocument(file), { profile })
          const type = document.frontmatter?.type
          if (type && options.injectTypeTag && file.data.frontmatter) {
            const tag = `${options.typeTagPrefix}/${type}`
            const tags = asArray(file.data.frontmatter.tags).map(String)
            if (!tags.includes(tag)) file.data.frontmatter.tags = [...tags, tag]
          }
          file.data.okf = document
        },
      ]
    },
  }
}

async function emitRawFiles(context, files, options) {
  if (!options.emitRaw) return []
  const emitted = []
  for (const file of files.filter(isAuthoredFile)) {
    const slug = String(file.data.slug ?? "")
    if (!slug) continue
    const outputPath = path.join(context.argv.output, options.rawOutput, `${slug}.md`)
    const frontmatter = file.data.frontmatter
    const body = String(file.value ?? "")
    const content = frontmatter
      ? `---\n${stringifyFrontmatter(frontmatter)}\n---\n\n${body.replace(/^\s+/, "")}`
      : body
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, content)
    emitted.push(outputPath)
  }
  return emitted
}

async function emitAll(context, content, options) {
  const profile = profileFromOptions(options)
  const files = content.map(([, file]) => file).filter((file) => file?.data)
  const documents = files
    .filter(isAuthoredFile)
    .map((file) => file.data.okf ?? validateDocument(toDocument(file), {
      profile,
    }))

  const violations = documents.flatMap((document) =>
    (document.violations ?? []).map((violation) => ({ file: document.path, ...violation })),
  )
  const errors = violations.filter((violation) => violation.level === "error")
  for (const violation of violations) {
    const log = violation.level === "error" ? console.error : console.warn
    log(
      `[okf] ${violation.level.toUpperCase()}: ${violation.file}: [${violation.rule}] ${violation.message}`,
    )
  }
  if (errors.length && options.strict) {
    throw new Error(`[okf] build failed: ${errors.length} OKF conformance error(s)`)
  }

  const emitted = await emitRawFiles(context, files, options)
  if (!options.emitGraph) return emitted
  const graph = buildGraph(documents, {
    profile,
    site: context.cfg?.configuration?.pageTitle,
  })
  const graphPath = path.join(context.argv.output, options.graphOutput)
  await fs.mkdir(path.dirname(graphPath), { recursive: true })
  await fs.writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`)
  emitted.push(graphPath)

  const alternates = Object.fromEntries(
    files
      .filter(isAuthoredFile)
      .map((file) => [
        String(file.data.slug ?? ""),
        `/${options.rawOutput}/${String(file.data.slug ?? "")}.md`,
      ]),
  )
  const alternatesPath = path.join(context.argv.output, "static/okf-alternates.json")
  await fs.mkdir(path.dirname(alternatesPath), { recursive: true })
  await fs.writeFile(alternatesPath, `${JSON.stringify(alternates, null, 2)}\n`)
  emitted.push(alternatesPath)

  console.log(
    `[okf] knowledge graph: ${graph.stats.notes} typed notes, ${graph.stats.edges} edges (${graph.stats.unresolvedEdges} unresolved)`,
  )
  return emitted
}

export const OkfEmitter = (userOptions) => {
  const options = { ...DEFAULTS, ...userOptions }
  return {
    name: "OkfEmitter",
    emit: (context, content) => emitAll(context, content, options),
    partialEmit: (context, content) => emitAll(context, content, options),
  }
}
