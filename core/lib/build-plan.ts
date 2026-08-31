import type { BuildConfig, Problem, Seam } from "./types.ts"

/** The plugins this toolkit ships; a consumer never lists them. */
export const PLUGINS = ["quartz-okf", "quartz-okf-explorer", "quartz-okf-panels", "quartz-graph-okf"] as const

export type BuildAction =
  | { kind: "remove"; path: string }
  | { kind: "copy"; from: string; to: string }
  | { kind: "run"; command: string; args: string[]; cwd: string }
  | { kind: "hook"; seam: Seam; command: string; cwd: string }

export interface BuildStep {
  label: string
  actions: BuildAction[]
}

/** Where everything is. The shell resolves these; a path is null when the file is absent. */
export interface BuildLayout {
  root: string
  toolkit: string
  /** The consumer's cache directory; the assembled Quartz and the federation cache live under it. */
  cacheRoot: string
  /** The assembled Quartz for the pinned engine. */
  cache: string
  inputs: {
    quartzConfig: string | null
    okfConfig: string | null
    quartzTs: string | null
    customScss: string | null
    staticDir: string | null
    content: string | null
  }
  config: BuildConfig
  federation: boolean
  canFederate: boolean
  serve?: boolean
}

export interface BuildPlan {
  steps: BuildStep[]
  problems: Problem[]
}

const join = (...parts: string[]) => parts.join("/")
const basename = (file: string) => file.slice(file.lastIndexOf("/") + 1)
const problem = (id: string, code: string, message: string): Problem => ({ id, code, message })

function seamStep(seam: Seam, config: BuildConfig, cwd: string): BuildStep[] {
  const commands = config.hooks?.[seam] ?? []
  if (commands.length === 0) return []
  return [{ label: seam, actions: commands.map((command) => ({ kind: "hook" as const, seam, command, cwd })) }]
}

function configStep(layout: BuildLayout): BuildStep {
  const files = [layout.inputs.quartzConfig, layout.inputs.okfConfig, layout.inputs.quartzTs].filter(
    (file): file is string => file !== null,
  )
  return {
    label: "config",
    actions: [
      ...files.map((file) => ({ kind: "copy" as const, from: file, to: join(layout.cache, basename(file)) })),
      { kind: "copy", from: join(layout.toolkit, "harness/quartz.lock.json"), to: join(layout.cache, "quartz.lock.json") },
    ],
  }
}

function toolkitStep(layout: BuildLayout): BuildStep {
  const targets = ["lib", "profile.js", ...PLUGINS]
  return {
    label: "toolkit",
    actions: [
      ...targets.map((target) => ({ kind: "remove" as const, path: join(layout.cache, target) })),
      { kind: "copy", from: join(layout.toolkit, "core/lib"), to: join(layout.cache, "lib") },
      { kind: "copy", from: join(layout.toolkit, "core/profile.js"), to: join(layout.cache, "profile.js") },
      ...PLUGINS.flatMap((plugin) => [
        { kind: "copy" as const, from: join(layout.toolkit, "plugins", plugin), to: join(layout.cache, plugin) },
        // Quartz uses a `dist/` it finds as-is; one left over from another build would
        // be installed instead of the sources just copied.
        { kind: "remove" as const, path: join(layout.cache, plugin, "dist") },
        { kind: "remove" as const, path: join(layout.cache, plugin, "node_modules") },
      ]),
    ],
  }
}

function corpusStep(layout: BuildLayout): BuildStep {
  const content = join(layout.cache, "content")
  const gather: BuildAction = layout.inputs.content
    ? { kind: "copy", from: layout.inputs.content, to: content }
    : { kind: "run", command: "bash", args: [join(layout.toolkit, "harness/collect-content.sh"), layout.root, content], cwd: layout.root }
  return {
    label: "corpus",
    actions: [
      { kind: "remove", path: content },
      gather,
      ...(layout.inputs.customScss
        ? [{ kind: "copy" as const, from: layout.inputs.customScss, to: join(layout.cache, "quartz/styles/custom.scss") }]
        : []),
      ...(layout.inputs.staticDir
        ? [{ kind: "copy" as const, from: layout.inputs.staticDir, to: join(layout.cache, "quartz/static") }]
        : []),
    ],
  }
}

function federationStep(layout: BuildLayout): BuildStep {
  const artifacts = join(layout.cache, "okf-federation")
  return {
    label: "federation",
    actions: [
      { kind: "remove", path: artifacts },
      {
        kind: "run",
        command: "node",
        args: [
          join(layout.toolkit, "core/bin/okf-federate.js"),
          layout.root,
          join(layout.cache, "content"),
          artifacts,
          "--cache",
          join(layout.cacheRoot, "federation"),
        ],
        cwd: layout.root,
      },
    ],
  }
}

// Quartz reuses a plugin already linked in `.quartz/plugins` and a transpilation cache
// that does not notice the sources underneath it changed: both would serve the previous
// toolkit while reporting a clean build.
function installStep(layout: BuildLayout): BuildStep {
  return {
    label: "plugin install",
    actions: [
      ...PLUGINS.map((plugin) => ({ kind: "remove" as const, path: join(layout.cache, ".quartz/plugins", plugin) })),
      { kind: "remove", path: join(layout.cache, ".quartz-cache") },
      { kind: "run", command: "npx", args: ["quartz", "plugin", "install", "--from-config", "--concurrency", "2"], cwd: layout.cache },
    ],
  }
}

function buildStep(layout: BuildLayout): BuildStep {
  const args = ["quartz", "build", "--concurrency", "1", ...(layout.serve ? ["--serve"] : [])]
  return { label: "build", actions: [{ kind: "run", command: "npx", args, cwd: layout.cache }] }
}

function publishStep(layout: BuildLayout): BuildStep {
  const site = join(layout.root, "public")
  return {
    label: "publish",
    actions: [
      { kind: "remove", path: site },
      { kind: "copy", from: join(layout.cache, "public"), to: site },
    ],
  }
}

function layoutProblems(layout: BuildLayout): Problem[] {
  const required: [string | null, string][] = [
    [layout.inputs.quartzConfig, "quartz.config.yaml"],
    [layout.inputs.okfConfig, "okf.config.mjs"],
    [layout.inputs.quartzTs, "okf/quartz.ts"],
  ]
  return [
    ...required
      .filter(([file]) => file === null)
      .map(([, name]) => problem(name, "build/no-config", `${name} is missing: the site would build against the reference profile, not this corpus`)),
    ...(layout.inputs.content === null && !layout.config.content?.collect
      ? [problem("content", "build/no-corpus", "no corpus: declare `build.content.dir` or `build.content.collect`")]
      : []),
    ...(layout.federation && !layout.canFederate
      ? [problem("federation", "build/no-federate", "this corpus declares subgraphs and the pinned toolkit has no core/bin/okf-federate.js: the site would publish without them")]
      : []),
  ]
}

/** The recipe: what to assemble, in which order, for this consumer and this toolkit. */
export function buildPlan(layout: BuildLayout): BuildPlan {
  const problems = layoutProblems(layout)
  if (problems.length > 0) return { steps: [], problems }
  const { config, root, cache } = layout
  return {
    problems,
    steps: [
      ...seamStep("prepare", config, root),
      configStep(layout),
      toolkitStep(layout),
      ...seamStep("assemble", config, cache),
      corpusStep(layout),
      ...seamStep("content", config, root),
      ...(layout.federation ? [federationStep(layout)] : []),
      installStep(layout),
      ...seamStep("install", config, cache),
      buildStep(layout),
      ...(layout.serve ? [] : [publishStep(layout)]),
      ...(layout.serve ? [] : seamStep("postBuild", config, root)),
    ],
  }
}
