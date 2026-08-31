import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const toolkit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const types = path.join(toolkit, "core", "lib", "types.ts")
const tsc = path.join(toolkit, "node_modules", ".bin", "tsc")

async function typecheck(config: string): Promise<{ status: number | null; output: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-config-types-"))
  const file = path.join(root, "okf.config.ts")
  await fs.writeFile(file, `import type { OkfConfig } from ${JSON.stringify(types)}\n${config}`)
  const result = spawnSync(
    tsc,
    ["--noEmit", "--strict", "--module", "nodenext", "--moduleResolution", "nodenext", "--allowImportingTsExtensions", "--target", "es2022", "--skipLibCheck", file],
    { encoding: "utf8" },
  )
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

test("a consumer configuration that satisfies OkfConfig type-checks", async () => {
  const clean = await typecheck(`
export const profile = { types: ["service"], edgeLabels: ["Uses"] }
export const federation = { subgraphs: [{ node: "topics/it", path: "subgraphs/it", preview: { property: "visibility", equals: "open" } }] }
export default { profile, federation } satisfies OkfConfig
`)
  assert.equal(clean.status, 0, clean.output)
})

test("a wrong value type fails, naming the field", async () => {
  const wrong = await typecheck(`export default { profile: { types: [1] } } satisfies OkfConfig\n`)
  assert.notEqual(wrong.status, 0)
  assert.match(wrong.output, /okf\.config\.ts\(2,/)
  assert.match(wrong.output, /types/)
})

test("a misspelt key fails, naming the key", async () => {
  const wrong = await typecheck(`export default { federatoin: { subgraphs: [] } } satisfies OkfConfig\n`)
  assert.notEqual(wrong.status, 0)
  assert.match(wrong.output, /okf\.config\.ts\(2,/)
  assert.match(wrong.output, /federatoin/)
})
