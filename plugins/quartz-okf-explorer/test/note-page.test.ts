import assert from "node:assert/strict"
import test from "node:test"
import { resolveNotePage } from "../lib/note-page.ts"

const origin = "https://notes.example"

function reader(pages) {
  const calls = []
  return {
    calls,
    read: async (url) => {
      calls.push(url)
      const page = pages[url]
      if (!page) throw new Error("HTTP 404")
      return { page: page.article ?? "alias", url: page.url ?? url, refresh: page.refresh ?? null }
    },
  }
}

test("an ordinary note is read once and keeps its requested fragment", async () => {
  const r = reader({ [`${origin}/note`]: { article: "content" } })
  assert.deepEqual(await resolveNotePage(`${origin}/note#entry`, r.read), { page: "content", fragment: "entry" })
  assert.deepEqual(r.calls, [`${origin}/note`])
})

test("a folder alias resolves its relative refresh before reading the article", async () => {
  const r = reader({
    [`${origin}/collection`]: { refresh: "0; url=./collection/" },
    [`${origin}/collection/`]: { article: "folder content" },
  })
  assert.deepEqual(await resolveNotePage(`${origin}/collection`, r.read), { page: "folder content", fragment: "" })
  assert.deepEqual(r.calls, [`${origin}/collection`, `${origin}/collection/`])
})

test("relative redirects use the final HTTP response URL", async () => {
  const r = reader({
    [`${origin}/old`]: { url: `${origin}/nested/alias`, refresh: '0; URL="./page/"' },
    [`${origin}/nested/page/`]: { article: "nested content" },
  })
  assert.equal((await resolveNotePage(`${origin}/old`, r.read)).page, "nested content")
})

test("an explicit fragment survives a chain and overrides the redirect default", async () => {
  const r = reader({
    [`${origin}/alias`]: { refresh: "0; url=/middle" },
    [`${origin}/middle`]: { refresh: "0; url=/catalog/#default" },
    [`${origin}/catalog/`]: { article: "catalog" },
  })
  assert.equal((await resolveNotePage(`${origin}/alias#row%201`, r.read)).fragment, "row%201")
  assert.equal((await resolveNotePage(`${origin}/alias`, r.read)).fragment, "default")
})

test("a cyclic redirect fails without repeating a fetch", async () => {
  const r = reader({
    [`${origin}/a`]: { refresh: "0; url=/b" },
    [`${origin}/b`]: { refresh: "0; url=/a" },
  })
  await assert.rejects(resolveNotePage(`${origin}/a`, r.read), /redirect loop/i)
  assert.equal(r.calls.length, 2)
})

test("redirect traversal stops after five hops", async () => {
  let calls = 0
  await assert.rejects(resolveNotePage(`${origin}/0`, async (url) => {
    calls++
    return { page: "alias", url, refresh: `0; url=/${calls}` }
  }), /too many.*redirects/i)
  assert.equal(calls, 6)
})

test("redirects cannot fetch a different origin or execute a script URL", async () => {
  for (const target of ["https://elsewhere.example/page", "//elsewhere.example/page", "javascript:alert(1)"]) {
    const r = reader({ [`${origin}/alias`]: { refresh: `0; url=${target}` } })
    await assert.rejects(resolveNotePage(`${origin}/alias`, r.read), /unsupported.*redirect/i)
    assert.equal(r.calls.length, 1)
  }
})

test("a missing destination remains a visible HTTP failure", async () => {
  const r = reader({ [`${origin}/alias`]: { refresh: "0; url=/missing" } })
  await assert.rejects(resolveNotePage(`${origin}/alias`, r.read), /HTTP 404/)
})
