import assert from "node:assert/strict"
import test from "node:test"
import { buildResolver } from "../lib/resolver.js"

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
