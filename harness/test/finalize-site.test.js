import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { finalizeSite } from "../finalize-site.js"

test("injects a markdown alternate link when a raw counterpart exists", async () => {
  const publicDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "okf-site-test-"))
  await fs.mkdir(path.join(publicDirectory, "raw", "notes"), { recursive: true })
  await fs.mkdir(path.join(publicDirectory, "notes"), { recursive: true })
  await fs.writeFile(path.join(publicDirectory, "raw", "notes", "example.md"), "# Raw\n")
  await fs.writeFile(
    path.join(publicDirectory, "notes", "example.html"),
    "<html><head><title>Example</title></head><body></body></html>",
  )
  assert.equal(await finalizeSite(publicDirectory), 1)
  const html = await fs.readFile(path.join(publicDirectory, "notes", "example.html"), "utf8")
  assert.match(
    html,
    /<link rel="alternate" type="text\/markdown" href="\/raw\/notes\/example\.md">/,
  )
})
