import fs from "node:fs/promises"
import path from "node:path"
import { markCatalogRows, type HastNode } from "./anchors.ts"
import type { ChildInput, FederatedGraph } from "../../lib/federation.ts"
import { stringifyFrontmatter } from "../../lib/frontmatter.ts"
import {
  PROFILE,
  buildGraph,
  federateGraph,
  isReserved,
  mergeProfile,
  subgraphId,
  validateAnnotations,
  validateDocument,
  validateFederationConfig,
} from "../../lib/index.ts"
import type {
  Document,
  Federation,
  Frontmatter,
  MountRecord,
  OkfGraph,
  Problem,
  Profile,
  ProfileOverlay,
  ValidatedDocument,
} from "../../lib/types.ts"

export interface OkfOptions {
  /** Fail the build on OKF conformance errors. */
  strict?: boolean
  /** Inject a derived `type/<type>` tag so tag pages act as per-type indexes. */
  injectTypeTag?: boolean
  typeTagPrefix?: string
  /** Require folder notes (`<dir>/<dir>.md`) to declare an alias equal to their name. */
  requireFolderNoteAlias?: boolean
  emitGraph?: boolean
  graphOutput?: string
  emitRaw?: boolean
  rawOutput?: string
  /** The consumer's `federation` block; the mount step ran before Quartz. */
  federation?: Federation | null
  /** Where `okf-federate` wrote the manifest and the children's graphs. */
  federationArtifacts?: string
  loadFederation?: ((artifactsDir: string) => Promise<Record<string, ChildInput>>) | null
  subgraphsOutput?: string
  /** Consumer profile overlay merged onto the reference profile. */
  profile?: ProfileOverlay
  types?: string[]
  edgeLabels?: string[]
  topologyHeading?: string
  /** The corpus commit; `OKF_SOURCE_HEAD` from the environment when absent. */
  sourceHead?: string
}

type ResolvedOptions = OkfOptions & typeof DEFAULTS

const DEFAULTS = {
  strict: true,
  injectTypeTag: true,
  typeTagPrefix: "type",
  requireFolderNoteAlias: true,
  emitGraph: true,
  graphOutput: "static/okf-graph.json",
  emitRaw: true,
  rawOutput: "raw",
  federation: null as Federation | null,
  federationArtifacts: "okf-federation",
  loadFederation: null as OkfOptions["loadFederation"],
  subgraphsOutput: "static/okf-subgraphs",
}

// A row is reached by its anchor, so it must be visible when the browser lands on it;
// `--highlight` is Quartz's own token, so the colour follows the site's theme.
const ROW_STYLE = "tr[data-okf-node]:target{background:var(--highlight);scroll-margin-top:2rem}"

function rowStyle(): HastNode {
  return { type: "element", tagName: "style", properties: {}, children: [{ type: "text", value: ROW_STYLE }] }
}

/** The slice of a Quartz vfile this plugin reads. */
export interface QuartzFile {
  data: {
    slug?: string
    filePath?: string
    frontmatter?: Frontmatter
    okf?: ValidatedDocument
  }
  value?: unknown
  path?: string
}

export interface BuildContext {
  argv: { output: string; directory?: string }
  cfg?: { configuration?: { pageTitle?: string; baseUrl?: string } }
}

type Content = [unknown, QuartzFile][]

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function relPathOf(file: QuartzFile): string {
  const filePath = String(file.data?.filePath ?? file.path ?? "")
  const marker = filePath.lastIndexOf("content/")
  return marker >= 0 ? filePath.slice(marker + "content/".length) : filePath
}

function isAuthoredFile(file: QuartzFile): boolean {
  const slug = String(file.data.slug ?? "")
  return Boolean(file.data.filePath) && !slug.startsWith("tags/")
}

// Notes the mount step brought in from another corpus. They speak that corpus'
// vocabulary: the child validated and graphed them, and its graph arrives through the
// federation artifacts, so here they are pages only.
function isMounted(file: QuartzFile): boolean {
  return Boolean(file.data?.frontmatter?.okf_federated)
}

function titleFromPath(filePath: string): string {
  return (filePath.split("/").at(-1) ?? filePath)
    .replace(/\.md$/, "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toDocument(file: QuartzFile): Document {
  const filePath = relPathOf(file)
  const reserved = isReserved(filePath)
  let frontmatter: Frontmatter | null = file.data.frontmatter ?? null
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
function canonicalOrigin(baseUrl: string | undefined): string | undefined {
  const value = String(baseUrl ?? "").trim()
  if (!value) return undefined
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return withScheme.replace(/\/+$/, "")
}

function profileFromOptions(options: ResolvedOptions): Profile {
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

export const OkfTransformer = (userOptions?: OkfOptions) => {
  const options: ResolvedOptions = { ...DEFAULTS, ...userOptions }
  const profile = profileFromOptions(options)
  return {
    name: "OkfTransformer",
    markdownPlugins() {
      return [
        () => (_tree: unknown, file: QuartzFile) => {
          const document: ValidatedDocument = isMounted(file)
            ? { ...toDocument(file), edges: [], violations: [] }
            : validateDocument(toDocument(file), { profile })
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
    htmlPlugins() {
      return [
        () => (tree: HastNode, file: QuartzFile) => {
          const rows = file.data.okf?.rows ?? []
          if (rows.length === 0) return
          for (const problem of markCatalogRows(tree, rows)) {
            console.warn(`[okf] WARN: ${relPathOf(file)}: ${problem}`)
          }
          tree.children = [...(tree.children ?? []), rowStyle()]
        },
      ]
    },
  }
}

async function emitRawFiles(context: BuildContext, files: QuartzFile[], options: ResolvedOptions): Promise<string[]> {
  if (!options.emitRaw) return []
  const emitted: string[] = []
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

async function defaultLoadFederation(artifactsDir: string): Promise<Record<string, ChildInput>> {
  let manifest: { subgraphs?: MountRecord[] }
  try {
    manifest = JSON.parse(await fs.readFile(path.join(artifactsDir, "manifest.json"), "utf8")) as { subgraphs?: MountRecord[] }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return {}
    throw error
  }
  const children: Record<string, ChildInput> = {}
  for (const entry of manifest.subgraphs ?? []) {
    children[entry.id] = {
      graph: JSON.parse(await fs.readFile(path.join(artifactsDir, entry.id, "okf-graph.json"), "utf8")) as OkfGraph,
      display: entry.display,
      remoteHead: entry.remoteHead,
      location: entry.repo,
    }
  }
  return children
}

function federationFailure(items: Problem[]): Error {
  return new Error(
    `[okf] federation: ${items.map((item) => `[${item.code}] ${item.message}`).join("; ")}`,
  )
}

async function federate(
  context: BuildContext,
  graph: OkfGraph,
  profile: Profile,
  options: ResolvedOptions,
): Promise<Pick<FederatedGraph, "graph" | "subgraphs">> {
  const entries = options.federation?.subgraphs ?? []
  if (!entries.length || !options.federation) return { graph, subgraphs: [] }
  const federation = options.federation
  const reported = new Set<string>()
  const warn = (item: Problem): void => {
    const key = `${item.code}\n${item.message}`
    if (reported.has(key)) return
    reported.add(key)
    console.warn(`[okf] federation WARN [${item.code}] ${item.message}`)
  }
  const problems = validateFederationConfig(federation, profile, graph.nodes.map((node) => node.slug))
  if (problems.length && options.strict) throw federationFailure(problems)
  problems.forEach(warn)
  const invalid = new Set(problems.map((item) => item.id))
  const valid = entries.filter((entry) => !invalid.has(subgraphId(entry) || "(unnamed)"))
  const artifactsDir = path.resolve(context.argv?.directory ?? "content", "..", options.federationArtifacts)
  const mounted = await (options.loadFederation ?? defaultLoadFederation)(artifactsDir)
  const children: Record<string, ChildInput> = {}
  for (const entry of valid) {
    const id = subgraphId(entry)
    children[id] = mounted[id] ?? {
      error: "no mount artifacts found: run okf-federate before the build",
      location: entry.repo,
    }
  }
  const unreachable: Problem[] = Object.entries(children)
    .filter(([, child]) => !child.graph)
    .map(([id, child]) => ({
      id,
      code: "federation/child-unreachable",
      message: `${id}: cannot mount ${child.location}: ${child.error}`,
    }))
  if (unreachable.length && options.strict) throw federationFailure(unreachable)
  const result = federateGraph(graph, children, federation, profile, {
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
      `[okf] federation: ${id} ← ${marker.notes} notes, ${marker.previewed} previewed (${String(marker.source_head ?? "unknown").slice(0, 7)}) mounted at ${marker.mount}/`,
    )
  }
  return result
}

async function emitAll(context: BuildContext, content: Content, options: ResolvedOptions): Promise<string[]> {
  const profile = profileFromOptions(options)
  const files = content.map(([, file]) => file).filter((file) => file?.data)
  const documents = files
    .filter(isAuthoredFile)
    .filter((file) => !isMounted(file))
    .map((file) => file.data.okf ?? validateDocument(toDocument(file), { profile }))

  // Whether an annotating table reaches a node, and whether two of them disagree, is a
  // question only the whole corpus answers: validating file by file would let it pass.
  const violations = [
    ...documents.flatMap((document) =>
      (document.violations ?? []).map((violation) => ({ file: document.path, ...violation })),
    ),
    ...validateAnnotations(documents, { profile }).map((problem) => ({
      file: problem.path,
      ...problem.violation,
    })),
  ]
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
    // Quartz builds from a copy of the corpus, outside its repository: the harness
    // hands the commit in through the environment so federating parents can pin it.
    sourceHead: options.sourceHead ?? process.env.OKF_SOURCE_HEAD ?? undefined,
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

export const OkfEmitter = (userOptions?: OkfOptions) => {
  const options: ResolvedOptions = { ...DEFAULTS, ...userOptions }
  return {
    name: "OkfEmitter",
    emit: (context: BuildContext, content: Content) => emitAll(context, content, options),
    partialEmit: (context: BuildContext, content: Content) => emitAll(context, content, options),
  }
}
