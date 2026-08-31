import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { OkfEmitter } from "../src/index.ts"

function note(slug, frontmatter = {}, body = "") {
  return {
    data: {
      slug,
      filePath: `content/${slug}.md`,
      frontmatter: { title: slug, description: `About ${slug}.`, tags: ["fixture"], ...frontmatter },
    },
    value: body,
  }
}

async function emitSite(files, options = {}, configuration = {}) {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "okf-emitter-"))
  const directory = path.join(output, "content")
  await fs.mkdir(directory, { recursive: true })
  const context = {
    argv: { output, directory },
    cfg: { configuration: { pageTitle: "Fixture site", ...configuration } },
  }
  const emitter = OkfEmitter({ emitRaw: false, ...options })
  const emitted = await emitter.emit(context, files.map((file) => [null, file]))
  const read = async (relative) =>
    JSON.parse(await fs.readFile(path.join(output, relative), "utf8"))
  return { output, emitted, read, graph: await read("static/okf-graph.json") }
}

const SITE = [
  note("services/api", { type: "service" }, "# Topology\n\n* **Uses**: [[technology/runtime]]\n"),
  note("technology/runtime", { type: "technology" }),
]

test("publishes the site's canonical origin as baseUrl with an https scheme", async () => {
  const { graph } = await emitSite(SITE, {}, { baseUrl: "cern.zetesis.xyz" })
  assert.equal(graph.baseUrl, "https://cern.zetesis.xyz")
  assert.equal(graph.site, "Fixture site")
})

test("keeps an explicit scheme and drops trailing slashes from baseUrl", async () => {
  const { graph } = await emitSite(SITE, {}, { baseUrl: "http://localhost:8080/" })
  assert.equal(graph.baseUrl, "http://localhost:8080")
})

test("records the corpus commit handed in by the harness as source_head", async () => {
  process.env.OKF_SOURCE_HEAD = "abc1234567"
  try {
    const { graph } = await emitSite(SITE)
    assert.equal(graph.source_head, "abc1234567")
  } finally {
    delete process.env.OKF_SOURCE_HEAD
  }
  const explicit = await emitSite(SITE, { sourceHead: "fedcba" })
  assert.equal(explicit.graph.source_head, "fedcba")
  const none = await emitSite(SITE)
  assert.equal(none.graph.source_head, undefined)
})

test("emits no baseUrl when the site declares none", async () => {
  const { graph } = await emitSite(SITE)
  assert.equal("baseUrl" in graph, false)
  assert.equal(graph.stats.notes, 2)
  assert.equal(graph.stats.edges, 2)
})

// ---- federation -------------------------------------------------------------------

const PARENT_PROFILE = {
  types: ["unit", "graph", "service", "technology", "concept"],
  edgeLabels: ["Contains", "Part of"],
  inverseLabels: { Contains: "Part of", "Part of": "Contains" },
}
const ID = "it-governance"
const PARENT_SITE = [
  note("cern", { type: "unit" }, "# Topology\n\n* **Contains**: [[topics/it-governance]]\n"),
  note("topics/it-governance", { type: "graph" }),
]
// Notes the mount step wrote under the id: they belong to the child's vocabulary, so the
// parent must neither validate them (policy is not a parent type) nor graph them itself.
const MOUNTED = [
  note(`${ID}/identity/sso`, { type: "service", okf_federated: ID, visibility: "open" }),
  note(`${ID}/security/oc5`, { type: "policy", okf_federated: ID, visibility: "internal" }),
]
const CHILD = {
  schema: "okf-graph/v1",
  site: "CERN IT Governance",
  baseUrl: "https://cern.zetesis.xyz",
  source_head: "def4567890",
  stats: { notes: 2, edges: 0 },
  nodes: [
    { slug: "identity/sso", title: "SSO", type: "service", tags: [], path: "identity/sso.md",
      properties: { visibility: "open" } },
    { slug: "security/oc5", title: "OC5", type: "policy", tags: [], path: "security/oc5.md",
      properties: { visibility: "internal" } },
  ],
  edges: [],
  unresolved: [],
}
const DISPLAY = { typeColors: { policy: "#ef4444" }, typeLabels: { policy: "Policy / Circular" } }
const REPO = "https://github.com/example/child-graph"
const FEDERATION = {
  subgraphs: [{ node: "topics/it-governance", repo: REPO, ref: "def4567890", preview: { property: "visibility", equals: "open" } }],
}

async function writeArtifacts(output, entries) {
  const dir = path.join(output, "okf-federation")
  await fs.mkdir(path.join(dir, ID), { recursive: true })
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ subgraphs: entries.map(({ graph: _g, ...rest }) => rest) }))
  for (const entry of entries) {
    await fs.writeFile(path.join(dir, entry.id, "okf-graph.json"), JSON.stringify(entry.graph))
  }
}

const MANIFEST_ENTRY = {
  id: ID, node: "topics/it-governance", repo: REPO, ref: "def4567890", head: "def4567890",
  mount: `/${ID}`, display: DISPLAY, notes: 2, graph: CHILD,
}

async function emitFederated(entries, options = {}, configuration = { baseUrl: "cern-graph.example" }) {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "okf-emitter-"))
  const directory = path.join(output, "content")
  await fs.mkdir(directory, { recursive: true })
  if (entries) await writeArtifacts(output, entries)
  const context = { argv: { output, directory }, cfg: { configuration: { pageTitle: "Fixture site", ...configuration } } }
  const emitter = OkfEmitter({ emitRaw: false, profile: PARENT_PROFILE, federation: FEDERATION, ...options })
  const emitted = await emitter.emit(context, [...PARENT_SITE, ...MOUNTED].map((file) => [null, file]))
  const read = async (relative) => JSON.parse(await fs.readFile(path.join(output, relative), "utf8"))
  return { output, emitted, read, graph: await read("static/okf-graph.json") }
}

function capture(method) {
  const lines = []
  const original = console[method]
  console[method] = (...args) => lines.push(args.join(" "))
  return { lines, restore: () => { console[method] = original } }
}

test("federates the mounted child from the build artifacts and republishes its graph same-origin", async () => {
  const log = capture("log")
  try {
    const { graph, read, emitted } = await emitFederated([MANIFEST_ENTRY])
    const portal = graph.nodes.find((node) => node.slug === "topics/it-governance")
    assert.equal(portal.subgraph.previewed, 1)
    assert.equal(portal.subgraph.source_head, "def4567890")
    assert.equal(portal.subgraph.mount, `/${ID}`)
    const federated = graph.nodes.filter((node) => node.federated)
    assert.deepEqual(federated.map((node) => node.url), [`/${ID}/identity/sso`])
    assert.equal(graph.nodes.some((node) => !node.federated && node.slug.startsWith(`${ID}/`)), false)
    assert.equal(graph.stats.notes, 3)
    assert.equal(graph.stats.federatedEdges, 2)
    assert.deepEqual(graph.display, { typeColors: DISPLAY.typeColors, typeLabels: DISPLAY.typeLabels, edgeColors: {} })

    const copy = await read(`static/okf-subgraphs/${ID}.json`)
    assert.deepEqual(copy.federatedFrom, { site: "https://cern-graph.example", node: "topics/it-governance", title: "Fixture site" })
    assert.deepEqual(copy.nodes.map((node) => node.url), [`/${ID}/identity/sso`, `/${ID}/security/oc5`])
    assert.deepEqual(copy.display, DISPLAY)
    assert.equal(emitted.some((file) => file.endsWith(`okf-subgraphs/${ID}.json`)), true)
    assert.equal(
      log.lines.some((line) => line.includes("[okf] federation: it-governance ← 2 notes, 1 previewed (def4567)")),
      true,
      log.lines.join("\n"),
    )
  } finally {
    log.restore()
  }
})

test("mounted notes are not validated against the parent profile even in strict mode", async () => {
  const { graph } = await emitFederated([MANIFEST_ENTRY], { strict: true })
  assert.equal(graph.nodes.filter((node) => node.type === "policy").length, 0)
})

test("a configuration problem fails a strict build naming the subgraph", async () => {
  await assert.rejects(
    emitFederated([MANIFEST_ENTRY], {
      federation: { subgraphs: [{ ...FEDERATION.subgraphs[0], id: ID, node: "topics/nope" }] },
    }),
    /federation.*\[federation\/node-unknown\].*it-governance/,
  )
})

test("a declared child without mount artifacts fails a strict build pointing at okf-federate", async () => {
  await assert.rejects(emitFederated(null), /federation.*it-governance.*okf-federate/)
})

test("without artifacts in a non-strict build the portal is emitted empty with a named warning", async () => {
  const warn = capture("warn")
  try {
    const { graph, output } = await emitFederated(null, { strict: false })
    const portal = graph.nodes.find((node) => node.slug === "topics/it-governance")
    assert.equal(portal.subgraph.previewed, 0)
    assert.equal(graph.nodes.some((node) => node.federated), false)
    await assert.rejects(fs.access(path.join(output, `static/okf-subgraphs/${ID}.json`)))
    assert.equal(warn.lines.some((line) => /federation\/child-unreachable.*it-governance/.test(line)), true, warn.lines.join("\n"))
  } finally {
    warn.restore()
  }
})

test("a remote that moved past the pinned ref is reported as a warning", async () => {
  const warn = capture("warn")
  try {
    await emitFederated([{ ...MANIFEST_ENTRY, remoteHead: "0123456789" }])
    assert.equal(warn.lines.some((line) => /federation\/ref-behind.*it-governance.*def4567890.*0123456789/.test(line)), true, warn.lines.join("\n"))
  } finally {
    warn.restore()
  }
})
