import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { assemblePlugin } from "./assemble.js"

const { OkfEmitter } = await assemblePlugin()

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
const PARENT_SITE = [
  note("cern", { type: "unit" }, "# Topology\n\n* **Contains**: [[topics/it-governance]]\n"),
  note("topics/it-governance", { type: "graph" }),
]
const CHILD_URL = "https://cern.zetesis.xyz/static/okf-graph.json"
const CHILD = {
  schema: "okf-graph/v1",
  site: "CERN IT Governance",
  baseUrl: "https://cern.zetesis.xyz",
  source_head: "def4567890",
  stats: { notes: 2, edges: 0 },
  nodes: [
    { slug: "identity/sso", title: "SSO", type: "service", tags: [], path: "identity/sso.md",
      properties: { visibility: "open" } },
    { slug: "security/oc5", title: "OC5", type: "concept", tags: [], path: "security/oc5.md",
      properties: { visibility: "internal" } },
  ],
  edges: [],
  unresolved: [],
}
const FEDERATION = {
  subgraphs: [{ node: "topics/it-governance", graph: CHILD_URL, preview: { property: "visibility", equals: "open" } }],
}
const fetchChild = async (location) => {
  if (location !== CHILD_URL) throw new Error(`unexpected ${location}`)
  return structuredClone(CHILD)
}

function capture(method) {
  const lines = []
  const original = console[method]
  console[method] = (...args) => lines.push(args.join(" "))
  return { lines, restore: () => { console[method] = original } }
}

test("federates a fetched child into the graph and republishes it same-origin", async () => {
  const log = capture("log")
  try {
    const { graph, read, emitted } = await emitSite(
      PARENT_SITE,
      { profile: PARENT_PROFILE, federation: FEDERATION, fetchBundle: fetchChild },
      { baseUrl: "cern-graph.example" },
    )
    const portal = graph.nodes.find((node) => node.slug === "topics/it-governance")
    assert.equal(portal.subgraph.previewed, 1)
    assert.equal(portal.subgraph.source_head, "def4567890")
    const federated = graph.nodes.filter((node) => node.federated)
    assert.deepEqual(federated.map((node) => node.url), ["https://cern.zetesis.xyz/identity/sso"])
    assert.equal(graph.stats.federatedEdges, 2)

    const copy = await read("static/okf-subgraphs/it-governance.json")
    assert.deepEqual(copy.federatedFrom, {
      site: "https://cern-graph.example",
      node: "topics/it-governance",
      title: "Fixture site",
    })
    assert.deepEqual(copy.nodes.map((node) => node.url), [
      "https://cern.zetesis.xyz/identity/sso",
      "https://cern.zetesis.xyz/security/oc5",
    ])
    assert.equal(emitted.some((file) => file.endsWith("okf-subgraphs/it-governance.json")), true)
    assert.equal(
      log.lines.some((line) => line.includes("[okf] federation: it-governance ← 2 notes, 1 previewed (def4567)")),
      true,
      log.lines.join("\n"),
    )
  } finally {
    log.restore()
  }
})

test("reads a relative child location from the content directory", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "okf-emitter-"))
  const directory = path.join(output, "content")
  await fs.mkdir(path.join(directory, "subgraphs"), { recursive: true })
  await fs.writeFile(path.join(directory, "subgraphs", "it.json"), JSON.stringify(CHILD))
  const context = { argv: { output, directory }, cfg: { configuration: { pageTitle: "P" } } }
  const emitter = OkfEmitter({
    emitRaw: false,
    profile: PARENT_PROFILE,
    federation: { subgraphs: [{ ...FEDERATION.subgraphs[0], graph: "subgraphs/it.json" }] },
  })
  await emitter.emit(context, PARENT_SITE.map((file) => [null, file]))
  const graph = JSON.parse(await fs.readFile(path.join(output, "static/okf-graph.json"), "utf8"))
  assert.equal(graph.stats.federatedNodes, 1)
})

test("a configuration problem fails a strict build naming the subgraph", async () => {
  await assert.rejects(
    emitSite(PARENT_SITE, {
      profile: PARENT_PROFILE,
      federation: { subgraphs: [{ ...FEDERATION.subgraphs[0], id: "it-governance", node: "topics/nope" }] },
      fetchBundle: fetchChild,
    }),
    /federation.*\[federation\/node-unknown\].*it-governance/,
  )
})

test("an unreachable child fails a strict build naming id and location", async () => {
  await assert.rejects(
    emitSite(PARENT_SITE, {
      profile: PARENT_PROFILE,
      federation: FEDERATION,
      fetchBundle: async () => { throw new Error("HTTP 503") },
    }),
    /federation.*it-governance.*okf-graph\.json.*HTTP 503/,
  )
})

test("an unreachable child in a non-strict build leaves an empty portal and a named warning", async () => {
  const warn = capture("warn")
  try {
    const { graph, output } = await emitSite(PARENT_SITE, {
      profile: PARENT_PROFILE,
      federation: FEDERATION,
      strict: false,
      fetchBundle: async () => { throw new Error("HTTP 503") },
    })
    const portal = graph.nodes.find((node) => node.slug === "topics/it-governance")
    assert.equal(portal.subgraph.previewed, 0)
    assert.equal(graph.nodes.some((node) => node.federated), false)
    await assert.rejects(fs.access(path.join(output, "static/okf-subgraphs/it-governance.json")))
    assert.equal(warn.lines.some((line) => /federation\/child-unreachable.*it-governance.*HTTP 503/.test(line)), true, warn.lines.join("\n"))
  } finally {
    warn.restore()
  }
})
