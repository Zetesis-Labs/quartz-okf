import assert from "node:assert/strict"
import test from "node:test"
import { buildResolver } from "../lib/resolver.ts"

function note(id, aliases = []) {
  return {
    id,
    path: `${id}.md`,
    reserved: false,
    frontmatter: { type: "concept", aliases },
  }
}

test("resolves exact ids, explicit aliases, and unique short names", () => {
  const resolve = buildResolver([
    note("docs/technologies/tailscale", ["tailnet"]),
    note("tl-pizarro/pizarro", ["pizarro"]),
  ])
  assert.equal(resolve("docs/technologies/tailscale"), "docs/technologies/tailscale")
  assert.equal(resolve("tailnet"), "docs/technologies/tailscale")
  assert.equal(resolve("tailscale"), "docs/technologies/tailscale")
  assert.equal(resolve("pizarro"), "tl-pizarro/pizarro")
})

test("folder notes resolve under both pipeline spellings", () => {
  // Export pipeline keeps the authored path (dir/name/name); site pipelines
  // collapse the folder note to dir/name. Both spellings must resolve to the
  // document id whichever shape the corpus was loaded from.
  const exportShaped = buildResolver([note("vps-escohotado/web/web", ["web"])])
  assert.equal(exportShaped("vps-escohotado/web/web"), "vps-escohotado/web/web")
  assert.equal(exportShaped("vps-escohotado/web"), "vps-escohotado/web/web")

  const siteShaped = buildResolver([note("vps-escohotado/web", ["web"])])
  assert.equal(siteShaped("vps-escohotado/web"), "vps-escohotado/web")
  assert.equal(siteShaped("vps-escohotado/web/web"), "vps-escohotado/web")
})

test("does not guess when short names or aliases are ambiguous", () => {
  const resolve = buildResolver([
    note("one/FIRST_STEPS", ["start"]),
    note("two/FIRST_STEPS", ["start"]),
  ])
  assert.equal(resolve("FIRST_STEPS"), null)
  assert.equal(resolve("start"), null)
  assert.equal(resolve("one/FIRST_STEPS"), "one/FIRST_STEPS")
})

const CATALOG_DOCS = [
  {
    id: "standards/arm",
    path: "standards/arm.md",
    frontmatter: { type: "report" },
    rows: [
      { id: "AC001", anchor: "ac001", slug: "standards/arm#ac001" },
      { id: "BC002 Curriculum Planning", anchor: "bc002-curriculum-planning", slug: "standards/arm#bc002-curriculum-planning" },
    ],
  },
  { id: "tools/okf", path: "tools/okf.md", frontmatter: { type: "tool" } },
]

test("resolves a row by its qualified slug, by note#ID and by its bare id", () => {
  const resolve = buildResolver(CATALOG_DOCS)
  assert.equal(resolve("standards/arm#ac001"), "standards/arm#ac001")
  assert.equal(resolve("standards/arm#AC001"), "standards/arm#ac001")
  assert.equal(resolve("arm#AC001"), "standards/arm#ac001")
  assert.equal(resolve("AC001"), "standards/arm#ac001")
  assert.equal(resolve("standards/arm#BC002 Curriculum Planning"), "standards/arm#bc002-curriculum-planning")
})

test("a fragment that no row answers to falls back to the note", () => {
  const resolve = buildResolver(CATALOG_DOCS)
  assert.equal(resolve("standards/arm#some-heading"), "standards/arm")
  assert.equal(resolve("missing#AC001"), null)
})

test("a bare id claimed by two catalogs is ambiguous, and the qualified forms still resolve", () => {
  const resolve = buildResolver([
    ...CATALOG_DOCS,
    {
      id: "standards/other",
      path: "standards/other.md",
      frontmatter: { type: "report" },
      rows: [{ id: "AC001", anchor: "ac001", slug: "standards/other#ac001" }],
    },
  ])
  assert.equal(resolve("AC001"), null)
  assert.equal(resolve("standards/arm#AC001"), "standards/arm#ac001")
  assert.equal(resolve("standards/other#AC001"), "standards/other#ac001")
})
