import assert from "node:assert/strict"
import test from "node:test"
import { parseFrontmatter, stringifyFrontmatter, withFrontmatter } from "../lib/frontmatter.js"

test("parses OKF frontmatter shapes", () => {
  const parsed = parseFrontmatter(`---
type: service
title: "A service: production"
tags: [gitops, fleet]
aliases:
  - service-a
enabled: true
---

# Body
`)
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.data, {
    type: "service",
    title: "A service: production",
    tags: ["gitops", "fleet"],
    aliases: ["service-a"],
    enabled: true,
  })
  assert.match(parsed.body, /^# Body/)
})

test("reports malformed and duplicate frontmatter", () => {
  assert.match(parseFrontmatter("---\ntype service\n---\n").error.message, /invalid YAML/)
  assert.match(
    parseFrontmatter("---\ntype: service\ntype: component\n---\n").error.message,
    /duplicate key/,
  )
})

test("adds deterministic fields without losing the body", () => {
  const source = "---\ntype: concept\ntags: [fleet]\n---\n\nHello\n"
  const updated = withFrontmatter(source, { timestamp: "2026-07-17T00:00:00Z" })
  const parsed = parseFrontmatter(updated)
  assert.equal(parsed.data.timestamp, "2026-07-17T00:00:00Z")
  assert.deepEqual(parsed.data.tags, ["fleet"])
  assert.equal(parsed.body, "Hello\n")
  assert.match(stringifyFrontmatter(parsed.data), /timestamp: "2026-07-17T00:00:00Z"/)
})
