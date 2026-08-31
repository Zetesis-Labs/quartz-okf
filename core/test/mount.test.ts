import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import {
  childCacheDir,
  mountIndex,
  mountSubgraphs,
  mountedNote,
  rewriteBundleLinks,
} from "../lib/mount.ts"

const ID = "it-governance"

test("rewrites the bundle's file links as site URLs under the mount, leaving external and static ones alone", () => {
  const source = [
    "See [GMS](/identity/gms.md) and [missing](/nowhere.md).",
    "External [site](https://example.org/x) and protocol-relative [cdn](//cdn.example/x).",
    "![diagram](/static/diagram.png) ![local](/identity/diagram.png)",
    `Already [mounted](/${ID}/identity/sso).`,
  ].join("\n")
  assert.equal(
    rewriteBundleLinks(source, ID),
    [
      `See [GMS](/${ID}/identity/gms) and [missing](/${ID}/nowhere).`,
      "External [site](https://example.org/x) and protocol-relative [cdn](//cdn.example/x).",
      `![diagram](/static/diagram.png) ![local](/${ID}/identity/diagram.png)`,
      `Already [mounted](/${ID}/identity/sso).`,
    ].join("\n"),
  )
})

test("a mounted note keeps its frontmatter and body, marked with its subgraph", () => {
  const note = `---\ntype: service\ntitle: "SSO"\nvisibility: open\n---\n\nUses [GMS](/identity/gms).\n\n# Topology\n\n* **Uses**: [GMS](/identity/gms)\n`
  const mounted = mountedNote(note, ID)
  assert.match(mounted, /^---\n/)
  assert.match(mounted, /\ntype: service\n/)
  assert.match(mounted, /\nokf_federated: it-governance\n/)
  assert.match(mounted, /\[GMS\]\(\/it-governance\/identity\/gms\)/)
  assert.equal((mounted.match(/# Topology/g) || []).length, 1)
})

test("the mount index names the child and links its explorer entry", () => {
  const index = mountIndex(ID, { indexTitle: "CERN IT Governance · Knowledge Graph", bundleTitle: "CERN IT" }, { notes: 274 })
  assert.match(index, /^---\n/)
  assert.match(index, /title: "CERN IT Governance · Knowledge Graph"/)
  assert.match(index, /274/)
  assert.match(index, /\/static\/explorer\?graph=it-governance/)
})

test("child checkouts are cached per id and ref", () => {
  assert.equal(childCacheDir("/cache", ID, "abc123"), path.join("/cache", "it-governance-abc123"))
})

// ---- integration: a real child repository on disk --------------------------------------

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

async function makeChildRepo(root, { brokenNote = false } = {}) {
  await fs.mkdir(path.join(root, "content", "identity"), { recursive: true })
  await fs.writeFile(
    path.join(root, "okf.config.mjs"),
    `export const branding = { site: "Child", bundleTitle: "Child bundle", indexTitle: "Child · Graph" }
export const profile = {
  types: ["service", "policy"],
  edgeLabels: ["Authorizes", "Governs"],
  inverseLabels: {},
  propertyGroups: [{
    id: "visibility", rule: "visibility-valid", appliesTo: ["service", "policy"],
    fields: [{ source: "visibility", graphPath: ["visibility"], type: "string", enum: ["open", "internal"] }],
  }],
  ruleLevels: { "visibility-valid": "error" },
}
export const explorer = {
  typeColors: { service: "#10b981", policy: "#ef4444" },
  typeLabels: { service: "Service / System" },
  edgeColors: { Authorizes: "#6366f1" },
  modes: [{ id: "full", label: "Full view", edges: "*" }],
  layout: { charge: -40 },
}
`,
  )
  await fs.writeFile(
    path.join(root, "content", "identity", "sso.md"),
    `---\ntype: service\ntitle: "SSO"\ndescription: "Single sign-on."\ntags: [identity]\nvisibility: open\n---\n\nSSO fronts [[identity/gms]].\n\n# Topology\n\n* **Authorizes**: [[identity/gms]]\n`,
  )
  await fs.writeFile(
    path.join(root, "content", "identity", "gms.md"),
    `---\ntype: service\ntitle: "GMS"\ndescription: "Groups."\ntags: [identity]\nvisibility: internal\n---\n\nGroups management.\n`,
  )
  if (brokenNote) {
    await fs.writeFile(
      path.join(root, "content", "broken.md"),
      `---\ntype: spaceship\ntitle: "Broken"\ndescription: "Wrong type."\ntags: [x]\n---\n\nNope.\n`,
    )
  }
  await fs.writeFile(path.join(root, "content", "index.md"), "---\ntitle: Child\n---\n\nHome.\n")
  git(root, "init", "-q", "-b", "main")
  git(root, "-c", "user.email=t@example.org", "-c", "user.name=t", "add", "-A")
  git(root, "-c", "user.email=t@example.org", "-c", "user.name=t", "commit", "-q", "-m", "child corpus")
  return git(root, "rev-parse", "HEAD")
}

async function makeParent(root, entry) {
  await fs.mkdir(path.join(root, "content", "topics"), { recursive: true })
  await fs.writeFile(
    path.join(root, "okf.config.mjs"),
    `export const federation = { subgraphs: [${JSON.stringify(entry)}] }\n`,
  )
  await fs.writeFile(
    path.join(root, "content", "topics", "it-governance.md"),
    `---\ntype: graph\ntitle: "IT governance"\n---\n\nPortal.\n`,
  )
}

test("mounts a local child repository: notes under the id, artifacts with graph, head and display", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-mount-"))
  const childRoot = path.join(root, "child")
  const head = await makeChildRepo(childRoot)
  const parentRoot = path.join(root, "parent")
  await makeParent(parentRoot, {
    node: "topics/it-governance",
    repo: "../child",
    preview: { property: "visibility", equals: "open" },
  })
  const contentOut = path.join(root, "site", "content")
  const artifactsOut = path.join(root, "site", "okf-federation")
  const log = []
  const result = await mountSubgraphs(parentRoot, contentOut, artifactsOut, {
    cacheRoot: path.join(root, "cache"),
    log: (line) => log.push(line),
  })

  const sso = await fs.readFile(path.join(contentOut, ID, "identity", "sso.md"), "utf8")
  assert.match(sso, /\nokf_federated: it-governance\n/)
  assert.match(sso, /\[identity\/gms\]\(\/it-governance\/identity\/gms\)/)
  assert.equal(await fs.readFile(path.join(contentOut, ID, "identity", "gms.md"), "utf8").then((s) => /okf_federated/.test(s)), true)
  await assert.rejects(fs.access(path.join(contentOut, ID, "log.md")))
  const index = await fs.readFile(path.join(contentOut, ID, "index.md"), "utf8")
  assert.match(index, /Child · Graph/)

  const manifest = JSON.parse(await fs.readFile(path.join(artifactsOut, "manifest.json"), "utf8"))
  assert.equal(manifest.subgraphs.length, 1)
  const entry = manifest.subgraphs[0]
  assert.equal(entry.id, ID)
  assert.equal(entry.node, "topics/it-governance")
  assert.equal(entry.head, head)
  assert.equal(entry.mount, `/${ID}`)
  assert.equal(entry.remoteHead, undefined)
  assert.deepEqual(entry.source, { kind: "path", path: childRoot })
  assert.deepEqual(entry.display.typeColors, { service: "#10b981", policy: "#ef4444" })
  assert.deepEqual(entry.display.modes, [{ id: "full", label: "Full view", edges: "*" }])
  assert.equal("layout" in entry.display, false)

  const graph = JSON.parse(await fs.readFile(path.join(artifactsOut, ID, "okf-graph.json"), "utf8"))
  assert.equal(graph.source_head, head)
  assert.deepEqual(
    graph.nodes.map((node) => [node.slug, node.properties?.visibility]),
    [["identity/gms", "internal"], ["identity/sso", "open"]],
  )
  assert.equal(graph.edges.length, 1)
  assert.deepEqual(result.mounted.map((item) => item.id), [ID])
  assert.equal(log.some((line) => /mounted it-governance ← 2 notes/.test(line)), true, log.join("\n"))
})

test("mounts a remote child by cloning it at the pinned ref into the cache and records the remote head", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-mount-"))
  const childRoot = path.join(root, "child")
  const head = await makeChildRepo(childRoot)
  const parentRoot = path.join(root, "parent")
  await makeParent(parentRoot, {
    node: "topics/it-governance",
    repo: `file://${childRoot}`,
    ref: head,
    preview: { property: "visibility", equals: "open" },
  })
  const cacheRoot = path.join(root, "cache")
  await mountSubgraphs(parentRoot, path.join(root, "site", "content"), path.join(root, "site", "okf-federation"), {
    cacheRoot,
    log: () => {},
  })
  await fs.access(path.join(childCacheDir(cacheRoot, ID, head), "okf.config.mjs"))
  const manifest = JSON.parse(await fs.readFile(path.join(root, "site", "okf-federation", "manifest.json"), "utf8"))
  assert.equal(manifest.subgraphs[0].head, head)
  assert.equal(manifest.subgraphs[0].remoteHead, head)
  assert.deepEqual(manifest.subgraphs[0].source, { kind: "git", repo: `file://${childRoot}`, ref: head })
})

async function makeChildDirectory(root) {
  await makeChildRepo(root)
  await fs.rm(path.join(root, ".git"), { recursive: true, force: true })
}

test("a corpus directory inside the parent's repository mounts by path at the parent's own head", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-mount-"))
  const parentRoot = path.join(root, "parent")
  const childRoot = path.join(parentRoot, "subgraphs", "it")
  await makeChildDirectory(childRoot)
  await makeParent(parentRoot, {
    node: "topics/it-governance",
    path: "subgraphs/it",
    preview: { property: "visibility", equals: "open" },
  })
  git(parentRoot, "init", "-q", "-b", "main")
  git(parentRoot, "-c", "user.email=t@example.org", "-c", "user.name=t", "add", "-A")
  git(parentRoot, "-c", "user.email=t@example.org", "-c", "user.name=t", "commit", "-q", "-m", "one repository")
  const parentHead = git(parentRoot, "rev-parse", "HEAD")
  const artifactsOut = path.join(root, "site", "okf-federation")
  const result = await mountSubgraphs(parentRoot, path.join(root, "site", "content"), artifactsOut, {
    cacheRoot: path.join(root, "cache"),
    log: () => {},
  })
  const entry = result.mounted[0]
  assert.deepEqual(entry.source, { kind: "path", path: childRoot })
  assert.equal(entry.head, parentHead)
  assert.equal(entry.remoteHead, undefined)
  assert.equal(entry.ref, undefined)
  assert.equal(entry.notes, 2)
  const graph = JSON.parse(await fs.readFile(path.join(artifactsOut, ID, "okf-graph.json"), "utf8"))
  assert.equal(graph.source_head, parentHead)
})

test("a corpus directory outside any repository mounts by path with no head", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-mount-"))
  const childRoot = path.join(root, "child")
  await makeChildDirectory(childRoot)
  const parentRoot = path.join(root, "parent")
  await makeParent(parentRoot, {
    node: "topics/it-governance",
    path: "../child",
    preview: { property: "visibility", equals: "open" },
  })
  const result = await mountSubgraphs(parentRoot, path.join(root, "site", "content"), path.join(root, "site", "okf-federation"), {
    cacheRoot: path.join(root, "cache"),
    log: () => {},
  })
  const entry = result.mounted[0]
  assert.deepEqual(entry.source, { kind: "path", path: childRoot })
  assert.equal("head" in entry, false)
  assert.equal(entry.notes, 2)
})

test("a child that fails its own validation is not mounted; the failure names the file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-mount-"))
  await makeChildRepo(path.join(root, "child"), { brokenNote: true })
  const parentRoot = path.join(root, "parent")
  await makeParent(parentRoot, {
    node: "topics/it-governance",
    repo: "../child",
    preview: { property: "visibility", equals: "open" },
  })
  await assert.rejects(
    mountSubgraphs(parentRoot, path.join(root, "site", "content"), path.join(root, "site", "okf-federation"), {
      cacheRoot: path.join(root, "cache"),
      log: () => {},
    }),
    /it-governance.*broken\.md.*type-closed/s,
  )
})

test("a parent without a federation block mounts nothing and writes no artifacts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-mount-"))
  await fs.mkdir(path.join(root, "parent"), { recursive: true })
  await fs.writeFile(path.join(root, "parent", "okf.config.mjs"), "export const profile = {}\n")
  const result = await mountSubgraphs(path.join(root, "parent"), path.join(root, "content"), path.join(root, "artifacts"), {
    cacheRoot: path.join(root, "cache"),
    log: () => {},
  })
  assert.deepEqual(result.mounted, [])
  await assert.rejects(fs.access(path.join(root, "artifacts", "manifest.json")))
})
