import assert from "node:assert/strict"
import test from "node:test"
import { PLUGINS, buildPlan } from "../lib/build-plan.ts"
import type { BuildLayout } from "../lib/build-plan.ts"

const layout = (overrides: Partial<BuildLayout> = {}): BuildLayout => ({
  root: "/repo",
  toolkit: "/cache/toolkit-abc",
  cacheRoot: "/cache",
  cache: "/cache/quartz-def",
  inputs: {
    quartzConfig: "/repo/quartz.config.yaml",
    okfConfig: "/repo/okf.config.mjs",
    quartzTs: "/repo/okf/quartz.ts",
    customScss: null,
    staticDir: null,
    content: "/repo/content",
  },
  config: {},
  federation: false,
  canFederate: true,
  ...overrides,
})

const labels = (steps: { label: string }[]) => steps.map((step) => step.label)
const codes = (problems: { code: string }[]) => problems.map((problem) => problem.code)
const at = (steps: { label: string }[], label: string) => steps.findIndex((step) => step.label === label)

test("the standard recipe assembles, builds and publishes, in that order", () => {
  const { steps, problems } = buildPlan(layout())
  assert.deepEqual(problems, [])
  assert.deepEqual(labels(steps), [
    "config",
    "toolkit",
    "corpus",
    "dates",
    "plugin install",
    "build",
    "publish",
  ])
})

// The corpus is assembled outside its repository, so the site's date plugin finds no git
// and falls back to a modification time the copy had just reset to now.
test("the assembled corpus is dated from its own history, after everything is in place", () => {
  const { steps } = buildPlan(layout({ federation: true }))
  const dates = steps[at(steps, "dates")]
  assert.deepEqual(dates.actions, [{ kind: "stamp", content: "/cache/quartz-def/content" }])
  assert.ok(at(steps, "dates") > at(steps, "federation"), "the mounted notes are dated too")
  assert.ok(at(steps, "dates") < at(steps, "build"))
})

test("the toolkit's own plugins are the toolkit's business, not a list the consumer keeps", () => {
  const { steps } = buildPlan(layout())
  const toolkit = steps[at(steps, "toolkit")]
  for (const plugin of PLUGINS) {
    assert.ok(
      toolkit.actions.some((action) => action.kind === "copy" && action.to === `/cache/quartz-def/${plugin}`),
      `${plugin} is assembled`,
    )
    assert.ok(
      toolkit.actions.some((action) => action.kind === "remove" && action.path === `/cache/quartz-def/${plugin}`),
      `${plugin}'s previous copy is purged`,
    )
  }
  // The contract and its shim resolve `../../lib` the same way they do in the tree.
  assert.ok(toolkit.actions.some((a) => a.kind === "copy" && a.from === "/cache/toolkit-abc/core/lib" && a.to === "/cache/quartz-def/lib"))
  assert.ok(toolkit.actions.some((a) => a.kind === "copy" && a.from === "/cache/toolkit-abc/core/profile.js"))
})

// A stale `dist/` copied from a working tree is installed as-is, and the site is built
// with the previous plugin while every log line says it was rebuilt.
test("no plugin build output travels with the sources", () => {
  const { steps } = buildPlan(layout())
  const actions = steps[at(steps, "toolkit")].actions
  for (const plugin of PLUGINS) {
    const copied = actions.findIndex((a) => a.kind === "copy" && a.to === `/cache/quartz-def/${plugin}`)
    const purged = actions.findIndex((a) => a.kind === "remove" && a.path === `/cache/quartz-def/${plugin}/dist`)
    assert.ok(purged > copied, `${plugin}'s dist is purged after the copy`)
    assert.ok(actions.some((a) => a.kind === "remove" && a.path === `/cache/quartz-def/${plugin}/node_modules`), plugin)
  }
})

// A stale plugin link is used as-is by Quartz, and a stale transpilation cache serves
// sources that were just replaced: both fail silently, with a site that builds.
test("the stale plugin links and the transpilation cache are purged before installing", () => {
  const { steps } = buildPlan(layout())
  const install = steps[at(steps, "plugin install")]
  for (const plugin of PLUGINS) {
    assert.ok(install.actions.some((a) => a.kind === "remove" && a.path === `/cache/quartz-def/.quartz/plugins/${plugin}`), plugin)
  }
  assert.ok(install.actions.some((a) => a.kind === "remove" && a.path === "/cache/quartz-def/.quartz-cache"))
  assert.ok(install.actions.some((a) => a.kind === "run" && a.args.includes("--from-config")))
})

// Quartz currently exits zero after reporting that one or more plugin builds failed. The
// toolkit must treat that summary as fatal or it can publish a site without a component.
test("a plugin build failure reported by Quartz fails the toolkit build", () => {
  const { steps } = buildPlan(layout())
  const action = steps[at(steps, "plugin install")].actions.find(
    (candidate) => candidate.kind === "run" && candidate.args.includes("--from-config"),
  )

  assert.equal(action?.kind, "run")
  if (action?.kind === "run") assert.match(action.failOnOutput ?? "", /failed/)
})

test("the corpus comes from the declared directory", () => {
  const { steps } = buildPlan(layout())
  const corpus = steps[at(steps, "corpus")]
  assert.ok(corpus.actions.some((a) => a.kind === "remove" && a.path === "/cache/quartz-def/content"))
  assert.ok(corpus.actions.some((a) => a.kind === "copy" && a.from === "/repo/content" && a.to === "/cache/quartz-def/content"))
})

test("a consumer may sweep the whole repository instead, with the harness's collector", () => {
  const { steps } = buildPlan(layout({ config: { content: { collect: true } }, inputs: { ...layout().inputs, content: null } }))
  const corpus = steps[at(steps, "corpus")]
  const collect = corpus.actions.find((a) => a.kind === "run")
  assert.equal(collect?.command, "bash")
  assert.deepEqual(collect?.args, ["/cache/toolkit-abc/harness/collect-content.sh", "/repo", "/cache/quartz-def/content"])
})

test("a corpus that is neither a directory nor a sweep is a problem, not an empty site", () => {
  const { problems } = buildPlan(layout({ inputs: { ...layout().inputs, content: null } }))
  assert.deepEqual(codes(problems), ["build/no-corpus"])
})

test("the styles and statics of the consumer travel only when it has them", () => {
  const without = buildPlan(layout()).steps[at(buildPlan(layout()).steps, "toolkit")]
  assert.ok(!without.actions.some((a) => a.kind === "copy" && a.to.includes("custom.scss")))

  const inputs = { ...layout().inputs, customScss: "/repo/quartz/styles/custom.scss", staticDir: "/repo/quartz/static" }
  const { steps } = buildPlan(layout({ inputs }))
  const corpus = steps[at(steps, "corpus")]
  assert.ok(corpus.actions.some((a) => a.kind === "copy" && a.to === "/cache/quartz-def/quartz/styles/custom.scss"))
  assert.ok(corpus.actions.some((a) => a.kind === "copy" && a.to === "/cache/quartz-def/quartz/static"))
})

test("federation runs when it is declared, against the assembled corpus", () => {
  const { steps, problems } = buildPlan(layout({ federation: true }))
  assert.deepEqual(problems, [])
  const federate = steps[at(steps, "federation")]
  const run = federate.actions.find((a) => a.kind === "run")
  assert.equal(run?.command, "node")
  assert.deepEqual(run?.args, [
    "/cache/toolkit-abc/core/bin/okf-federate.js",
    "/repo",
    "/cache/quartz-def/content",
    "/cache/quartz-def/okf-federation",
    "--cache",
    "/cache/federation",
  ])
  assert.ok(at(steps, "federation") > at(steps, "corpus"), "the children mount into the assembled corpus")
  assert.ok(at(steps, "federation") < at(steps, "build"))
})

test("without a declared federation nothing is mounted", () => {
  assert.equal(at(buildPlan(layout()).steps, "federation"), -1)
})

// The CERN build once emitted no graph at all because a pinned toolkit could not
// federate and said nothing.
test("a toolkit that cannot federate says so by name instead of building a smaller site in silence", () => {
  const { steps, problems } = buildPlan(layout({ federation: true, canFederate: false }))
  assert.equal(at(steps, "federation"), -1)
  assert.deepEqual(codes(problems), ["build/no-federate"])
  assert.match(problems[0].message, /okf-federate/)
})

test("each seam runs the consumer's commands where the pipeline actually opens", () => {
  const hooks = {
    prepare: ["python3 scripts/indexes.py"],
    content: ["python3 okf/linker.py"],
    assemble: ["python3 okf/i18n.py"],
    install: ["python3 okf/note-properties.py"],
    postBuild: ["cp okf/_redirects public/"],
  }
  const { steps } = buildPlan(layout({ config: { hooks } }))
  assert.deepEqual(labels(steps), [
    "prepare",
    "config",
    "toolkit",
    "assemble",
    "corpus",
    "content",
    "dates",
    "plugin install",
    "install",
    "build",
    "publish",
    "postBuild",
  ])
  const prepare = steps[0].actions[0]
  assert.equal(prepare.kind, "hook")
  assert.equal(prepare.kind === "hook" && prepare.command, "python3 scripts/indexes.py")
  assert.equal(prepare.kind === "hook" && prepare.cwd, "/repo")
  const assemble = steps[at(steps, "assemble")].actions[0]
  assert.equal(assemble.kind === "hook" && assemble.cwd, "/cache/quartz-def", "an assemble hook patches the assembled toolkit")
})

test("a seam with no commands adds no step", () => {
  const { steps } = buildPlan(layout({ config: { hooks: { postBuild: [] } } }))
  assert.equal(at(steps, "postBuild"), -1)
})

test("publishing replaces the previous site and serving skips it", () => {
  const publish = buildPlan(layout()).steps[at(buildPlan(layout()).steps, "publish")]
  assert.ok(publish.actions.some((a) => a.kind === "remove" && a.path === "/repo/public"))
  assert.ok(publish.actions.some((a) => a.kind === "copy" && a.from === "/cache/quartz-def/public" && a.to === "/repo/public"))

  const { steps } = buildPlan(layout({ serve: true }))
  assert.equal(at(steps, "publish"), -1)
  const build = steps[at(steps, "build")].actions.find((a) => a.kind === "run")
  assert.ok(build?.args.includes("--serve"))
})

test("a missing configuration file is named, one problem per file", () => {
  const inputs = { ...layout().inputs, quartzConfig: null, quartzTs: null }
  const { problems } = buildPlan(layout({ inputs }))
  assert.deepEqual(codes(problems), ["build/no-config", "build/no-config"])
  assert.match(problems[0].message, /quartz\.config\.yaml/)
  assert.match(problems[1].message, /quartz\.ts/)
})
