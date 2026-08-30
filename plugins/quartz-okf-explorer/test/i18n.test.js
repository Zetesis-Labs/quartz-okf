import assert from "node:assert/strict"
import test from "node:test"
import { CATALOGUES, makeT, resolveLocale, translator } from "../lib/i18n.js"

test("both catalogues answer to the same keys", () => {
  assert.deepEqual(Object.keys(CATALOGUES.es).sort(), Object.keys(CATALOGUES.en).sort())
  assert.ok(Object.keys(CATALOGUES.en).length > 30)
})

test("resolveLocale maps a Quartz locale to a catalogue and names what it could not honour", () => {
  assert.deepEqual(resolveLocale("en-US"), { locale: "en", problem: null })
  assert.deepEqual(resolveLocale("es-ES"), { locale: "es", problem: null })
  assert.deepEqual(resolveLocale("es"), { locale: "es", problem: null })
  assert.equal(resolveLocale("fr-FR").locale, "en")
  assert.match(resolveLocale("fr-FR").problem, /fr-FR/)
  assert.deepEqual(resolveLocale(undefined), { locale: "en", problem: null })
})

test("makeT applies overrides on known keys and reports the unknown ones", () => {
  const { t, catalogue, problems } = makeT("en", { "search.placeholder": "Find a note", "nope.key": "x" })
  assert.equal(t("search.placeholder"), "Find a note")
  assert.equal(catalogue["search.placeholder"], "Find a note")
  assert.equal("nope.key" in catalogue, false)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /nope\.key/)
})

test("t fills variables with the template syntax and throws on an unknown engine key", () => {
  const { t } = makeT("es")
  assert.equal(t("stats", { nodes: 1, links: 2 }), "1 nodo · 2 enlaces")
  assert.equal(t("trail.back", { graph: "Raíz" }), "Volver a Raíz")
  assert.throws(() => t("does.not.exist"), /does\.not\.exist/)
  assert.throws(() => makeT("xx"), /xx/)
})

test("translator builds t from a catalogue object, as the browser receives it", () => {
  const t = translator({ "a.b": "{n|one|many}" })
  assert.equal(t("a.b", { n: 3 }), "3 many")
  assert.throws(() => t("zz"), /zz/)
})
