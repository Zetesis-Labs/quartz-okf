import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { loadConsumerConfig } from "../lib/consumer-config.js"
import { exportBundle } from "../lib/exporter.js"
import { loadDocuments } from "../lib/files.js"
import { mergeProfile } from "../lib/profile.js"
import { PROFILE } from "../profile.js"

test("creates a deterministic conformant bundle and all machine exports", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-export-test-"))
  const repo = path.join(root, "repo")
  const output = path.join(root, "bundle")
  await fs.mkdir(path.join(repo, "service"), { recursive: true })
  await fs.mkdir(path.join(repo, "okf"), { recursive: true })
  await fs.writeFile(
    path.join(repo, "service", "service.md"),
    `---
type: service
title: Example service
description: A useful service.
tags: [gitops, fleet]
aliases: [service]
service_tier: edge
---

# Topology

* **Uses**: [[technology]]
`,
  )
  await fs.writeFile(
    path.join(repo, "technology.md"),
    "---\ntype: technology\ntitle: Technology\ndescription: Shared technology.\ntags: [gitops, fleet]\n---\n",
  )
  await fs.writeFile(path.join(repo, "README.md"), "# Repository\n")
  await fs.writeFile(
    path.join(repo, "okf", "state.json"),
    JSON.stringify({ last_maintained_head: "placeholder" }),
  )
  spawnSync("git", ["init", "-q"], { cwd: repo })
  spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: repo })
  spawnSync("git", ["config", "user.name", "Test"], { cwd: repo })
  spawnSync("git", ["add", "."], { cwd: repo })
  spawnSync("git", ["commit", "-qm", "docs: initial"], {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-07-17T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-07-17T00:00:00Z",
    },
  })
  const profile = mergeProfile(PROFILE, {
    propertyGroups: [
      {
        id: "service-runtime",
        appliesTo: ["service"],
        fields: [
          {
            source: "service_tier",
            graphPath: ["runtime", "tier"],
          },
        ],
      },
    ],
  })
  const result = await exportBundle(repo, output, { profile })
  const exported = await loadConsumerConfig(output)
  const documents = await loadDocuments(output, { profile: exported.profile })
  const errors = documents.flatMap((document) =>
    document.violations.filter((violation) => violation.level === "error"),
  )
  assert.deepEqual(errors, [])
  assert.equal(result.graph.stats.notes, 2)
  assert.equal(result.graph.stats.declaredEdges, 1)
  assert.deepEqual(result.graph.nodes[0].properties, { runtime: { tier: "edge" } })
  assert.equal(result.converted, 1)
  assert.match(await fs.readFile(path.join(output, "index.md"), "utf8"), /okf_version: "0.1"/)
  assert.match(await fs.readFile(path.join(output, "llms.txt"), "utf8"), /type=service/)
  assert.equal(JSON.parse(await fs.readFile(path.join(output, "okf-manifest.json"))).stale, true)
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(output, "okf-profile.json"))).propertyGroups,
    profile.propertyGroups,
  )
})
