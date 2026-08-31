import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { checkFloor } from "../bin/floor.js"

const shim = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "okf-export.js")

test("checkFloor names the floor and the version found when Node is too old", () => {
  const problem = checkFloor("20.18.3")
  assert.match(String(problem), /Node >= 22\.18/)
  assert.match(String(problem), /20\.18\.3/)
  assert.notEqual(checkFloor("22.17.9"), null)
  assert.notEqual(checkFloor("21.7.0"), null)
})

test("checkFloor is silent from 22.18 on, on every later major", () => {
  for (const version of ["22.18.0", "22.22.3", "23.0.0", "24.13.0"]) assert.equal(checkFloor(version), null, version)
})

test("a CLI shim refuses an old Node with the message, before touching any TypeScript", () => {
  const fake = `Object.defineProperty(process.versions, "node", { value: "20.18.3" }); await import(${JSON.stringify(pathToFileURL(shim).href)})`
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", fake], { encoding: "utf8" })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /Node >= 22\.18/)
  assert.match(result.stderr, /20\.18\.3/)
})

test("on a supported Node the shim reaches the CLI: no arguments prints its usage", () => {
  const result = spawnSync(process.execPath, [shim], { encoding: "utf8" })
  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stderr, /usage: okf-export/)
})
