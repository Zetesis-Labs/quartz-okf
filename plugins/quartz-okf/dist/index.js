import fs from "node:fs/promises"
import path from "node:path"
import {
  PROFILE,
  buildGraph,
  federateGraph,
  isReserved,
  mergeProfile,
  subgraphId,
  validateDocument,
  validateFederationConfig,
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
  federation: null,
  fetchBundle: null,
  subgraphsOutput: "static/okf-subgraphs",
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

// Quartz's baseUrl is a bare host ("cern.zetesis.xyz"); the graph publishes a full
// origin so other corpora can address this one's notes without guessing the scheme.
function canonicalOrigin(baseUrl) {
  const value = String(baseUrl ?? "").trim()
  if (!value) return undefined
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return withScheme.replace(/\/+$/, "")
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

async function defaultFetchBundle(location, { contentRoot }) {
  if (/^https?:\/\//i.test(location)) {
    const response = await fetch(location)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
  return JSON.parse(await fs.readFile(path.resolve(contentRoot, location), "utf8"))
}

function federationFailure(items) {
  return new Error(
    `[okf] federation: ${items.map((item) => `[${item.code}] ${item.message}`).join("; ")}`,
  )
}

async function fetchChildren(entries, fetchBundle, contentRoot) {
  const children = {}
  await Promise.all(
    entries.map(async (entry) => {
      const id = subgraphId(entry)
      try {
        children[id] = { graph: await fetchBundle(entry.graph, { contentRoot }), location: entry.graph }
      } catch (error) {
        children[id] = { error: error?.message ?? String(error), location: entry.graph }
      }
    }),
  )
  return children
}

async function federate(context, graph, profile, options) {
  const entries = options.federation?.subgraphs ?? []
  if (!entries.length) return { graph, subgraphs: [] }
  const reported = new Set()
  const warn = (item) => {
    const key = `${item.code}\n${item.message}`
    if (reported.has(key)) return
    reported.add(key)
    console.warn(`[okf] federation WARN [${item.code}] ${item.message}`)
  }
  const problems = validateFederationConfig(options.federation, profile, graph.nodes.map((node) => node.slug))
  if (problems.length && options.strict) throw federationFailure(problems)
  problems.forEach(warn)
  const invalid = new Set(problems.map((item) => item.id))
  const valid = entries.filter((entry) => !invalid.has(subgraphId(entry) || "(unnamed)"))
  const contentRoot = path.resolve(context.argv?.directory ?? "content")
  const children = await fetchChildren(valid, options.fetchBundle ?? defaultFetchBundle, contentRoot)
  const unreachable = Object.entries(children)
    .filter(([, child]) => !child.graph)
    .map(([id, child]) => ({
      id,
      code: "federation/child-unreachable",
      message: `${id}: cannot load ${child.location}: ${child.error}`,
    }))
  if (unreachable.length && options.strict) throw federationFailure(unreachable)
  const result = federateGraph(graph, children, options.federation, profile, {
    subgraphsPath: `/${options.subgraphsOutput}`,
  })
  if (result.problems.length && options.strict) throw federationFailure(result.problems)
  result.problems.forEach(warn)
  result.warnings.forEach(warn)
  for (const entry of valid) {
    const id = subgraphId(entry)
    if (!children[id]?.graph) continue
    const marker = result.graph.nodes.find((node) => node.slug === entry.node)?.subgraph
    if (!marker) continue
    console.log(
      `[okf] federation: ${id} ← ${marker.notes} notes, ${marker.previewed} previewed (${String(marker.source_head ?? "unknown").slice(0, 7)})`,
    )
  }
  return result
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
  const local = buildGraph(documents, {
    profile,
    site: context.cfg?.configuration?.pageTitle,
    baseUrl: canonicalOrigin(context.cfg?.configuration?.baseUrl),
  })
  const { graph, subgraphs } = await federate(context, local, profile, options)
  const graphPath = path.join(context.argv.output, options.graphOutput)
  await fs.mkdir(path.dirname(graphPath), { recursive: true })
  await fs.writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`)
  emitted.push(graphPath)
  for (const subgraph of subgraphs) {
    const copyPath = path.join(context.argv.output, options.subgraphsOutput, `${subgraph.id}.json`)
    await fs.mkdir(path.dirname(copyPath), { recursive: true })
    await fs.writeFile(copyPath, `${JSON.stringify(subgraph.graph, null, 2)}\n`)
    emitted.push(copyPath)
  }

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
