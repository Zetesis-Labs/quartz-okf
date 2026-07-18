import fs from "node:fs/promises"
import path from "node:path"
import { PROFILE } from "../profile.js"
import { buildGraph, buildResolver, convertWikilinks } from "./index.js"
import { emptyDirectory, loadDocuments, walk } from "./files.js"
import {
  gitFilesChangedSince,
  gitHead,
  gitIsDirty,
  gitLog,
  gitRevisionExists,
  gitStatusPaths,
  gitTimestamp,
  gitTrackedFiles,
} from "./git.js"
import { parseFrontmatter, stringifyFrontmatter, withFrontmatter } from "./frontmatter.js"

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"])

// Generic defaults: the machinery must not mention any specific consumer.
// A consumer overrides these through options.branding.
const DEFAULT_BRANDING = Object.freeze({
  site: undefined,
  bundleTitle: "Knowledge bundle",
  indexTitle: "Knowledge bundle",
})

function titleFromPath(filePath) {
  return path
    .posix.basename(filePath, ".md")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

async function readState(repo) {
  try {
    return JSON.parse(await fs.readFile(path.join(repo, "okf/state.json"), "utf8"))
  } catch {
    return {}
  }
}

async function copyAssets(repo, output) {
  for (const asset of await walk(repo, { extensions: ASSET_EXTENSIONS })) {
    const destination = path.join(output, asset.relative)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(asset.absolute, destination)
  }
}

function groupByDirectory(files) {
  const groups = new Map()
  for (const file of files) {
    const directory = path.posix.dirname(file)
    if (!groups.has(directory)) groups.set(directory, [])
    groups.get(directory).push(file)
  }
  return groups
}

function makeIndex(directory, concepts, directories, root = false, branding = DEFAULT_BRANDING) {
  const title = root ? branding.indexTitle : titleFromPath(directory)
  const lines = [`# ${title}`, ""]
  if (directories.length) {
    lines.push("# Directories", "")
    for (const child of directories.sort()) {
      lines.push(`* [${titleFromPath(child)}](${path.posix.basename(child)}/)`)
    }
    lines.push("")
  }
  if (concepts.length) {
    lines.push("# Concepts", "")
    for (const concept of concepts.sort((left, right) => left.path.localeCompare(right.path))) {
      const relative = path.posix.relative(directory === "." ? "" : directory, concept.path)
      const titleValue = concept.frontmatter?.title ?? titleFromPath(concept.path)
      const description = concept.frontmatter?.description
      lines.push(`* [${titleValue}](${relative})${description ? ` — ${description}` : ""}`)
    }
    lines.push("")
  }
  const body = `${lines.join("\n").trim()}\n`
  if (!root) return body
  return `---\nokf_version: "${PROFILE.okfVersion}"\nokf_profile: "${PROFILE.id}"\n---\n\n${body}`
}

function makeLog(entries) {
  const lines = ["# Bundle Update Log", ""]
  let currentDate = null
  for (const entry of entries) {
    if (entry.date !== currentDate) {
      currentDate = entry.date
      lines.push(`## ${currentDate}`, "")
    }
    lines.push(`* **Update**: \`${entry.hash}\` — ${entry.subject}`)
  }
  if (!entries.length) lines.push("## 1970-01-01", "", "* **Initialization**: No git history available.")
  return `${lines.join("\n").trim()}\n`
}

function makeLlms(documents, graph, branding = DEFAULT_BRANDING) {
  const lines = [
    `# ${branding.bundleTitle}`,
    "",
    `> OKF ${graph.okf_version}; profile ${graph.okf_profile}; ${graph.stats.notes} typed concepts and ${graph.stats.edges} typed topology edges.`,
    "",
  ]
  const typed = documents
    .filter((document) => !document.reserved && document.frontmatter?.type)
    .sort((left, right) => left.id.localeCompare(right.id))
  const entry = (document) => {
    const title = document.frontmatter.title ?? titleFromPath(document.path)
    const description = document.frontmatter.description
    return `- [${title}](/${document.path}): type=${document.frontmatter.type}${description ? ` — ${description}` : ""}`
  }
  for (const document of typed.filter((item) => !item.frontmatter.okf_generated_frontmatter)) {
    lines.push(entry(document))
  }
  const imported = typed.filter((item) => item.frontmatter.okf_generated_frontmatter)
  if (imported.length) {
    lines.push("", "## Imported documentation", "")
    lines.push(
      "> Files without authored OKF frontmatter; metadata below is generated, not curated.",
      "",
    )
    for (const document of imported) lines.push(entry(document))
  }
  return `${lines.join("\n")}\n`
}

function makeLlmsFull(documents, graph, branding = DEFAULT_BRANDING) {
  const lines = [
    `# ${branding.bundleTitle} — full corpus`,
    "",
    `> OKF ${graph.okf_version}; profile ${graph.okf_profile}; ${graph.stats.notes} typed concepts inline. Generated for LLM ingestion; the authoritative source is the repository.`,
    "",
  ]
  const typed = documents
    .filter((document) => !document.reserved && document.frontmatter?.type)
    .sort((left, right) => left.id.localeCompare(right.id))
  for (const document of typed) {
    const title = document.frontmatter.title ?? titleFromPath(document.path)
    lines.push(`# ${title}`, "")
    lines.push(`> path: ${document.path} · type: ${document.frontmatter.type}`, "")
    lines.push(document.body.trim(), "")
    lines.push("---", "")
  }
  return `${lines.join("\n")}\n`
}

export async function exportBundle(repoPath, outputPath, options = {}) {
  const repo = path.resolve(repoPath)
  const output = path.resolve(outputPath)
  if (output === repo || repo.startsWith(`${output}${path.sep}`)) {
    throw new Error("output must not contain the repository")
  }
  const branding = { ...DEFAULT_BRANDING, ...(options.branding ?? {}) }
  await emptyDirectory(output)
  const state = await readState(repo)
  const sourceHead = gitHead(repo)
  const dirty = gitIsDirty(repo)
  const lastMaintainedHead = state.last_maintained_head ?? null
  const documentationOnly = (filePath) =>
    filePath.endsWith(".md") ||
    filePath.startsWith("okf/") ||
    filePath.startsWith(".github/") ||
    filePath.startsWith(".codex/") ||
    filePath.startsWith(".agents/")
  const changesSinceMaintenance = gitFilesChangedSince(repo, lastMaintainedHead)
  const dirtyPaths = gitStatusPaths(repo)
  const stale =
    !gitRevisionExists(repo, lastMaintainedHead) ||
    changesSinceMaintenance.some((filePath) => !documentationOnly(filePath)) ||
    dirtyPaths.some((filePath) => !documentationOnly(filePath))
  const tracked = sourceHead === "unknown" ? null : gitTrackedFiles(repo)
  const untrackedInBundle = []
  const sourceFiles = await walk(repo, { extensions: new Set([".md"]) })
  const exportedPaths = []

  for (const file of sourceFiles) {
    if (file.relative === "README.md") continue
    if (path.posix.basename(file.relative) === "index.md") continue
    if (tracked && !tracked.has(file.relative)) {
      if (options.trackedOnly) continue
      untrackedInBundle.push(file.relative)
    }
    const destination = path.join(output, file.relative)
    const source = await fs.readFile(file.absolute, "utf8")
    const parsed = parseFrontmatter(source)
    const additions = parsed.data?.timestamp ? {} : { timestamp: gitTimestamp(repo, file.relative) }
    const fallback = {
      type: "concept",
      title: titleFromPath(file.relative),
      description: `Repository documentation imported from ${file.relative}.`,
      tags: ["documentation", "fleet"],
      okf_generated_frontmatter: true,
    }
    const content = withFrontmatter(source, additions, fallback)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, content)
    exportedPaths.push(file.relative)
  }

  await copyAssets(repo, output)
  let documents = await loadDocuments(output)
  const graphDocuments = documents
  const resolve = buildResolver(documents)
  let converted = 0
  let unresolvedLinks = 0
  for (const document of documents.filter((item) => !item.reserved)) {
    const convertedDocument = convertWikilinks(document.source, (target) => {
      const id = resolve(target)
      return id ? `${id}.md` : null
    })
    converted += convertedDocument.converted
    unresolvedLinks += convertedDocument.unresolved
    if (convertedDocument.content !== document.source) {
      await fs.writeFile(path.join(output, document.path), convertedDocument.content)
    }
  }

  documents = await loadDocuments(output)
  const byDirectory = groupByDirectory(exportedPaths)
  const allDirectories = new Set(["."])
  for (const file of exportedPaths) {
    let directory = path.posix.dirname(file)
    while (directory && directory !== ".") {
      allDirectories.add(directory)
      directory = path.posix.dirname(directory)
    }
  }
  for (const directory of [...allDirectories].sort()) {
    const concepts = documents.filter(
      (document) => !document.reserved && path.posix.dirname(document.path) === directory,
    )
    const children = [...allDirectories].filter(
      (candidate) => candidate !== directory && path.posix.dirname(candidate) === directory,
    )
    const index = makeIndex(directory, concepts, children, directory === ".", branding)
    const destination = path.join(output, directory === "." ? "index.md" : directory, directory === "." ? "" : "index.md")
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, index)
  }
  await fs.writeFile(path.join(output, "log.md"), makeLog(gitLog(repo)))

  documents = await loadDocuments(output)
  const graph = buildGraph(graphDocuments, {
    sourceHead,
    lastMaintainedHead,
    stale,
    site: options.site ?? branding.site,
  })
  const manifest = {
    okf_version: PROFILE.okfVersion,
    okf_profile: PROFILE.id,
    schema: PROFILE.graphSchema,
    source_head: sourceHead,
    last_export_head: sourceHead,
    last_maintained_head: lastMaintainedHead,
    dirty,
    stale,
    changes_since_maintenance: changesSinceMaintenance,
    dirty_paths: dirtyPaths,
    untracked_in_bundle: untrackedInBundle,
    generated_at: gitTimestamp(repo, "."),
    stats: graph.stats,
  }
  if (untrackedInBundle.length) {
    console.warn(
      `[okf] warning: ${untrackedInBundle.length} untracked file(s) included in the bundle ` +
        `(--include-untracked lets local drafts leak): ${untrackedInBundle.join(", ")}`,
    )
  }
  await fs.writeFile(path.join(output, "okf-graph.json"), `${JSON.stringify(graph, null, 2)}\n`)
  await fs.writeFile(path.join(output, "okf-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.writeFile(path.join(output, "llms.txt"), makeLlms(documents, graph, branding))
  await fs.writeFile(path.join(output, "llms-full.txt"), makeLlmsFull(documents, graph, branding))
  return { output, graph, manifest, documents, converted, unresolvedLinks }
}
