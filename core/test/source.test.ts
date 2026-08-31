import assert from "node:assert/strict"
import test from "node:test"
import { sourceOf } from "../lib/source.ts"

const preview = { property: "visibility", equals: "open" }
const codes = (items: { code: string }[]) => items.map((item) => item.code)

test("a corpus in this code is a path source; ref is not needed", () => {
  const { source, problems } = sourceOf({ node: "topics/it", path: "subgraphs/it", preview })
  assert.deepEqual(source, { kind: "path", path: "subgraphs/it" })
  assert.deepEqual(problems, [])
})

test("a git repository at a commit is a git source", () => {
  const { source, problems } = sourceOf({ node: "topics/it", repo: "https://github.com/x/it", ref: "abc123", preview })
  assert.deepEqual(source, { kind: "git", repo: "https://github.com/x/it", ref: "abc123" })
  assert.deepEqual(problems, [])
})

test("a local path written in repo (the 001 spelling) is a path source, without a warning", () => {
  for (const repo of ["../child", "/abs/child", "subgraphs/child"]) {
    const { source, problems } = sourceOf({ node: "topics/it", repo, ref: "ignored", preview })
    assert.deepEqual(source, { kind: "path", path: repo }, repo)
    assert.deepEqual(problems, [], repo)
  }
})

test("neither path nor repo, or both, are named problems with the subgraph id", () => {
  const none = sourceOf({ node: "topics/it", preview })
  assert.equal(none.source, null)
  assert.deepEqual(codes(none.problems), ["federation/source-required"])
  assert.match(none.problems[0].message, /^it: .*`path`.*`repo`/)

  const both = sourceOf({ node: "topics/it", path: "subgraphs/it", repo: "https://github.com/x/it", ref: "a", preview })
  assert.equal(both.source, null)
  assert.deepEqual(codes(both.problems), ["federation/source-ambiguous"])
})

test("a git source without a ref is a problem naming the repository", () => {
  const { source, problems } = sourceOf({ node: "topics/it", repo: "https://github.com/x/it", preview })
  assert.equal(source, null)
  assert.deepEqual(codes(problems), ["federation/ref-required"])
  assert.match(problems[0].message, /github\.com\/x\/it/)
})
