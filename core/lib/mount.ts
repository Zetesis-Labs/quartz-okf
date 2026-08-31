import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { loadConsumerConfig, readModuleConfig } from "./consumer-config.ts"
import { exportBundle } from "./exporter.ts"
import { isRemoteRepo, subgraphId, validateFederationConfig } from "./federation.ts"
import { walk } from "./files.ts"
import { gitHead } from "./git.ts"
import type { Branding, Display, ExplorerOptions, Federation, GraphStats, MountRecord, Problem, SubgraphEntry } from "./types.ts"

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"])
// The part of a child's explorer configuration that travels with its graph: what the
// nodes look like and which questions the child asks of itself. Layout stays with the
// site that draws it.
const DISPLAY_KEYS = ["typeColors", "typeLabels", "edgeColors", "typeOrder", "knowledgeTypes", "radius", "tooltip", "modes"] as const

function compact<T extends object>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T
}

// Bundle links are absolute from the bundle root and spelled as files
// (`/identity/gms.md`); mounted under an id they become site URLs inside the mount.
// Site assets and protocol-relative URLs are not bundle links.
export function rewriteBundleLinks(source: string, id: string): string {
  return source.replace(/\]\(\/(?!\/|static\/)([^)\s]*)\)/g, (match, target: string) => {
    if (target === id || target.startsWith(`${id}/`)) return match
    return `](/${id}/${target.replace(/\.md$/i, "")})`
  })
}

export function mountedNote(source: string, id: string): string {
  const rewritten = rewriteBundleLinks(source, id)
  const marker = `okf_federated: ${id}\n`
  if (/^---\r?\n/.test(rewritten)) return rewritten.replace(/^---\r?\n/, `---\n${marker}`)
  return `---\n${marker}---\n\n${rewritten}`
}

export function mountIndex(id: string, branding: Branding = {}, stats: Partial<GraphStats> = {}): string {
  const title = branding.indexTitle ?? branding.bundleTitle ?? id
  const name = branding.bundleTitle ?? title
  const notes = stats.notes ?? 0
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(`${name}: ${notes} notes mounted from its own corpus.`)}`,
    "---",
    "",
    `${name} is maintained as a corpus of its own and mounted here in full: ${notes} notes, their typed relationships and their sources.`,
    "",
    `[Explore its graph](/static/explorer?graph=${id}) · [Browse the notes](/${id}/)`,
    "",
  ].join("\n")
}

export function childCacheDir(cacheRoot: string, id: string, ref: string): string {
  return path.join(cacheRoot, `${id}-${ref}`)
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || `git ${args.join(" ")} failed`)
  }
  return result.stdout.trim()
}

function remoteHeadOf(repo: string): string | undefined {
  return git(process.cwd(), ["ls-remote", repo, "HEAD"]).split(/\s+/)[0] || undefined
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

interface ObtainedChild {
  root: string
  head: string
  remoteHead: string | undefined
}

async function obtainChild(entry: SubgraphEntry, { parentRoot, cacheRoot }: { parentRoot: string; cacheRoot: string }): Promise<ObtainedChild> {
  const repo = entry.repo ?? ""
  if (!isRemoteRepo(repo)) {
    const root = path.resolve(parentRoot, repo)
    if (!(await exists(root))) throw new Error(`repository path does not exist: ${root}`)
    return { root, head: gitHead(root), remoteHead: undefined }
  }
  const ref = entry.ref ?? ""
  const root = childCacheDir(cacheRoot, subgraphId(entry), ref)
  if (!(await exists(path.join(root, ".git")))) {
    await fs.rm(root, { recursive: true, force: true })
    await fs.mkdir(path.dirname(root), { recursive: true })
    git(process.cwd(), ["clone", "--quiet", "--no-checkout", repo, root])
    git(root, ["checkout", "--quiet", ref])
  }
  return { root, head: gitHead(root), remoteHead: remoteHeadOf(repo) }
}

async function displayOf(root: string): Promise<Display | undefined> {
  const explorer: ExplorerOptions | undefined = (await readModuleConfig(root))?.explorer
  if (!explorer) return undefined
  const display: Display = {}
  for (const key of DISPLAY_KEYS) {
    const value = explorer[key]
    if (value !== undefined) Object.assign(display, { [key]: value })
  }
  return display
}

async function federationOf(root: string): Promise<Federation | undefined> {
  return (await readModuleConfig(root))?.federation
}

async function localSlugsOf(contentRoot: string): Promise<string[]> {
  if (!(await exists(contentRoot))) return []
  const files = await walk(contentRoot, { extensions: new Set([".md"]) })
  return files.map((file) =>
    file.relative.replace(/\.md$/i, "").replace(/\/index$/, "").replace(/^index$/, ""),
  )
}

function failure(items: Problem[]): Error {
  return new Error(`[okf] federation: ${items.map((item) => `[${item.code}] ${item.message}`).join("; ")}`)
}

interface MountContext {
  parentRoot: string
  cacheRoot: string
  contentOut: string
  artifactsOut: string
  log: (line: string) => void
}

async function mountOne(entry: SubgraphEntry, { parentRoot, cacheRoot, contentOut, artifactsOut, log }: MountContext): Promise<MountRecord> {
  const id = subgraphId(entry)
  const { root, head, remoteHead } = await obtainChild(entry, { parentRoot, cacheRoot })
  const consumer = await loadConsumerConfig(root)
  const display = await displayOf(root)
  const corpus = path.join(root, entry.content ?? "content")
  const bundle = await fs.mkdtemp(path.join(os.tmpdir(), "okf-bundle-"))
  try {
    const result = await exportBundle(corpus, bundle, {
      trackedOnly: true,
      profile: consumer.profile,
      branding: consumer.branding,
    })
    const errors = result.documents.flatMap((document) =>
      (document.violations ?? [])
        .filter((violation) => violation.level === "error")
        .map((violation) => `${document.path}: [${violation.rule}] ${violation.message}`),
    )
    if (errors.length) {
      throw new Error(
        `[okf] federation: ${id}: the child corpus fails its own validation — ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? ` (+${errors.length - 5})` : ""}`,
      )
    }
    const target = path.join(contentOut, id)
    await fs.rm(target, { recursive: true, force: true })
    await fs.mkdir(target, { recursive: true })
    for (const document of result.documents) {
      if (document.reserved) continue
      const source = await fs.readFile(path.join(bundle, document.path), "utf8")
      const destination = path.join(target, document.path)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, mountedNote(source, id))
    }
    for (const asset of await walk(bundle, { extensions: ASSET_EXTENSIONS })) {
      const destination = path.join(target, asset.relative)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.copyFile(asset.absolute, destination)
    }
    await fs.writeFile(path.join(target, "index.md"), mountIndex(id, consumer.branding, result.graph.stats))
    const graph = { ...result.graph, source_head: head }
    await fs.mkdir(path.join(artifactsOut, id), { recursive: true })
    await fs.writeFile(path.join(artifactsOut, id, "okf-graph.json"), `${JSON.stringify(graph, null, 2)}\n`)
    log(`[okf] federation: mounted ${id} ← ${graph.stats.notes} notes at ${String(head).slice(0, 7)} under /${id}/`)
    return compact({
      id,
      node: entry.node,
      repo: entry.repo,
      ref: entry.ref,
      head,
      remoteHead,
      mount: `/${id}`,
      display,
      notes: graph.stats.notes,
    })
  } finally {
    await fs.rm(bundle, { recursive: true, force: true })
  }
}

export interface MountOptions {
  log?: (line: string) => void
  cacheRoot?: string
  federation?: Federation
  content?: string
}

export async function mountSubgraphs(
  parentRoot: string,
  contentOut: string,
  artifactsOut: string,
  options: MountOptions = {},
): Promise<{ mounted: MountRecord[] }> {
  const log = options.log ?? console.log
  const root = path.resolve(parentRoot)
  const cacheRoot = path.resolve(options.cacheRoot ?? path.join(root, ".okf-federation-cache"))
  const federation = options.federation ?? (await federationOf(root))
  const entries = federation?.subgraphs ?? []
  if (!entries.length) return { mounted: [] }
  const consumer = await loadConsumerConfig(root)
  // The parent's own notes come from its repository, not from the site copy: the
  // copy may not exist yet, and the mount must never depend on a previous build.
  const problems = validateFederationConfig(
    federation,
    consumer.profile,
    await localSlugsOf(path.join(root, options.content ?? "content")),
  )
  if (problems.length) throw failure(problems)
  await fs.rm(artifactsOut, { recursive: true, force: true })
  await fs.mkdir(artifactsOut, { recursive: true })
  const mounted: MountRecord[] = []
  for (const entry of entries) {
    mounted.push(await mountOne(entry, { parentRoot: root, cacheRoot, contentOut, artifactsOut, log }))
  }
  await fs.writeFile(path.join(artifactsOut, "manifest.json"), `${JSON.stringify({ subgraphs: mounted }, null, 2)}\n`)
  return { mounted }
}
