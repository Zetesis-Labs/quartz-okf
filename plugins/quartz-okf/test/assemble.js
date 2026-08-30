import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

// The plugin imports the contract as `../../lib/index.js`: it only resolves inside the
// layout the build harness assembles (lib/, profile.js and quartz-okf/ side by side in
// the Quartz root). Tests import it from that same layout, so what they exercise is
// what consumers run.
export async function assemblePlugin() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-plugin-layout-"))
  // The Quartz root is an ESM package; without this marker Node reads lib/ as CommonJS.
  await fs.writeFile(path.join(root, "package.json"), '{ "type": "module" }\n')
  await fs.cp(path.join(repoRoot, "core", "lib"), path.join(root, "lib"), { recursive: true })
  await fs.copyFile(path.join(repoRoot, "core", "profile.js"), path.join(root, "profile.js"))
  await fs.cp(path.join(repoRoot, "plugins", "quartz-okf"), path.join(root, "quartz-okf"), {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}test`),
  })
  return import(pathToFileURL(path.join(root, "quartz-okf", "dist", "index.js")).href)
}
