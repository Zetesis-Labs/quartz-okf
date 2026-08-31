import assert from "node:assert/strict"
import test from "node:test"
import { explorerConfig } from "../lib/emit-config.js"

const opts = { graphInput: "static/okf-graph.json", modes: [{ id: "full", label: "Full", edges: "*" }] }

test("the config carries the consumer's vocabulary and the site's language", () => {
  const { config, problems } = explorerConfig(opts, "en-US")
  assert.equal(config.graphUrl, "/static/okf-graph.json")
  assert.equal(config.locale, "en")
  assert.equal(config.wording["search.placeholder"], "Search notes…")
  assert.equal(config.title, "Knowledge graph")
  assert.deepEqual(config.modes, opts.modes)
  assert.deepEqual(config.hud, { surfaces: "flat", tokens: {} })
  assert.deepEqual(problems, [])
})

test("the consumer's locale beats the site's and an unsupported one is reported", () => {
  assert.equal(explorerConfig({ ...opts, locale: "es-ES" }, "en-US").config.locale, "es")
  assert.equal(explorerConfig(opts, "es").config.title, "Grafo de conocimiento")
  const { config, problems } = explorerConfig({ ...opts, locale: "fr-FR" }, "es-ES")
  assert.equal(config.locale, "en")
  assert.equal(problems.length, 1)
  assert.match(problems[0], /fr-FR/)
})

test("wording overrides apply to known keys and unknown keys are named", () => {
  const { config, problems } = explorerConfig({ ...opts, wording: { "search.placeholder": "Find", bogus: "x" } }, "en")
  assert.equal(config.wording["search.placeholder"], "Find")
  assert.equal(problems.length, 1)
  assert.match(problems[0], /bogus/)
})

test("the title falls back from title to accessTitle to the catalogue", () => {
  assert.equal(explorerConfig({ ...opts, title: "T", accessTitle: "A" }, "en").config.title, "T")
  assert.equal(explorerConfig({ ...opts, accessTitle: "A" }, "en").config.title, "A")
  assert.equal(explorerConfig({ ...opts, accessTitle: "A" }, "en").config.accessTitle, "A")
  assert.equal(explorerConfig(opts, "en").config.accessTitle, "Knowledge graph")
})

test("hud surfaces accept flat or glass and tokens pass through; anything else is reported", () => {
  const ok = explorerConfig({ ...opts, hud: { surfaces: "glass", tokens: { "--accent": "#f00" } } }, "en")
  assert.deepEqual(ok.config.hud, { surfaces: "glass", tokens: { "--accent": "#f00" } })
  const bad = explorerConfig({ ...opts, hud: { surfaces: "neon" } }, "en")
  assert.equal(bad.config.hud.surfaces, "flat")
  assert.match(bad.problems[0], /neon/)
})
