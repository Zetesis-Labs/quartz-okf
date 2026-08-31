#!/usr/bin/env node
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { buildPlan } from "../build-plan.ts"
import { CONFIG_FILE_NAMES, readModuleConfig } from "../consumer-config.ts"
import { walk } from "../files.ts"
import { gitHead } from "../git.ts"
import type { BuildAction, BuildLayout } from "../build-plan.ts"

function usage(): never {
  console.error("usage: okf-build <repo> [--cache <dir>] [--serve] [--no-verify]")
  process.exit(2)
}

const args = process.argv.slice(2)
const serve = args.includes("--serve")
const skipVerify = args.includes("--no-verify")
let cacheOption: string | undefined
const positional: string[] = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--cache") cacheOption = args[++index]
  else if (!args[index].startsWith("--")) positional.push(args[index])
}
if (positional.length > 1) usage()

const toolkit = path.resolve(import.meta.dirname, "../../..")
const root = path.resolve(positional[0] ?? ".")
const cacheRoot = path.resolve(
  cacheOption ?? path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), `${path.basename(root)}-okf`),
)

const fail = (message: string): never => {
  console.error(`[okf] ${message}`)
  process.exit(1)
}

async function firstExisting(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

const quartzRef = (await fs.readFile(path.join(toolkit, "harness/quartz.ref"), "utf8")).trim()
const cache = path.join(cacheRoot, `quartz-${quartzRef}`)
const npmCache = path.join(cacheRoot, "npm-cache")

const sourceHead = gitHead(root)
const site = serve ? path.join(cache, "public") : path.join(root, "public")
const environment = {
  ...process.env,
  npm_config_cache: npmCache,
  OKF_ROOT: root,
  OKF_TOOLKIT: toolkit,
  OKF_CACHE: cache,
  OKF_CONTENT: path.join(cache, "content"),
  OKF_PUBLIC: site,
  OKF_SOURCE_HEAD: sourceHead,
}

function run(command: string, commandArgs: string[], cwd: string, label: string, shell = false): void {
  const result = spawnSync(command, commandArgs, { cwd, env: environment, stdio: "inherit", shell })
  if (result.error) fail(`${label}: ${command} could not be started (${result.error.message})`)
  if (result.status !== 0) fail(`${label}: \`${shell ? command : [command, ...commandArgs].join(" ")}\` exited with ${result.status}`)
}

/** The pinned engine, downloaded once per SHA and installed once per download. */
async function ensureQuartz(): Promise<void> {
  if (!(await firstExisting([path.join(cache, "package.json")]))) {
    console.log(`[okf] downloading quartz ${quartzRef.slice(0, 7)}`)
    await fs.mkdir(cache, { recursive: true })
    run(
      `curl -fsSL "https://github.com/jackyzha0/quartz/archive/${quartzRef}.tar.gz" | tar xz --strip-components=1 -C "${cache}"`,
      [],
      cacheRoot,
      "quartz",
      true,
    )
  }
  if (!(await firstExisting([path.join(cache, "node_modules")]))) {
    run("npm", ["ci", "--silent"], cache, "quartz dependencies")
  }
}

const countFiles = async (directory: string): Promise<number> => (await walk(directory, { extensions: null })).length

async function copy(from: string, to: string, label: string): Promise<void> {
  try {
    await fs.access(from)
  } catch {
    fail(`${label}: ${from} does not exist`)
  }
  await fs.mkdir(path.dirname(to), { recursive: true })
  await fs.cp(from, to, { recursive: true, force: true })
  const source = await fs.stat(from)
  if (!source.isDirectory()) return
  const [before, after] = await Promise.all([countFiles(from), countFiles(to)])
  // Two names that differ only in case collapse into one on a case-insensitive
  // filesystem: the copy succeeds and the site quietly loses pages.
  if (after < before) {
    console.warn(`[okf] warning: ${label}: ${before - after} of ${before} files collapsed copying to ${to} (a case-insensitive filesystem?)`)
  }
}

async function execute(action: BuildAction, label: string): Promise<void> {
  if (action.kind === "remove") return void (await fs.rm(action.path, { recursive: true, force: true }))
  if (action.kind === "copy") return copy(action.from, action.to, label)
  if (action.kind === "run") return run(action.command, action.args, action.cwd, label)
  console.log(`[okf] ${action.seam}: ${action.command}`)
  return run(action.command, [], action.cwd, `${action.seam} hook`, true)
}

const config = await readModuleConfig(root)
const build = config?.build ?? {}
const collect = build.content?.collect === true

const layout: BuildLayout = {
  root,
  toolkit,
  cacheRoot,
  cache,
  inputs: {
    quartzConfig: await firstExisting([path.join(root, "quartz.config.yaml"), path.join(root, "okf/quartz.config.yaml")]),
    okfConfig: await firstExisting(CONFIG_FILE_NAMES.map((name) => path.join(root, name))),
    quartzTs: await firstExisting([path.join(root, "okf/quartz.ts"), path.join(root, "quartz.ts")]),
    customScss: await firstExisting([path.join(root, "quartz/styles/custom.scss")]),
    staticDir: await firstExisting([path.join(root, "quartz/static")]),
    content: collect ? null : await firstExisting([path.join(root, build.content?.dir ?? "content")]),
  },
  config: build,
  federation: Boolean(config?.federation?.subgraphs?.length),
  canFederate: (await firstExisting([path.join(toolkit, "core/bin/okf-federate.js")])) !== null,
  serve,
}

const { steps, problems } = buildPlan(layout)
if (problems.length > 0) {
  for (const item of problems) console.error(`[okf] ${item.code} — ${item.message}`)
  process.exit(1)
}

await ensureQuartz()

for (const step of steps) {
  for (const action of step.actions) await execute(action, step.label)
}

if (serve || skipVerify) process.exit(0)

const verify = spawnSync(process.execPath, [path.join(toolkit, "core/bin/okf-verify.js"), root, "--site", site], {
  cwd: root,
  env: environment,
  stdio: "inherit",
})
process.exit(verify.status ?? 1)
