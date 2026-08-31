import assert from "node:assert/strict"
import test from "node:test"
import { CATALOGUES, KEYS, panelWording, resolveLocale } from "../lib/i18n.ts"

test("every catalogue answers exactly the keys the panel renders", () => {
  for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
    assert.deepEqual(Object.keys(catalogue).sort(), [...KEYS].sort(), locale)
  }
})

test("the site's locale picks the catalogue by its language", () => {
  assert.deepEqual(resolveLocale("es-ES"), { locale: "es", problem: null })
  assert.deepEqual(resolveLocale("en-US"), { locale: "en", problem: null })
  assert.deepEqual(resolveLocale("es"), { locale: "es", problem: null })
})

test("a locale with no catalogue falls back to English and says so", () => {
  const { locale, problem } = resolveLocale("de-DE")
  assert.equal(locale, "en")
  assert.match(problem ?? "", /de-DE/)
})

test("no declared locale is not a problem: English is the default", () => {
  assert.deepEqual(resolveLocale(undefined), { locale: "en", problem: null })
})

test("the wording travels resolved, so the client script carries no English of its own", () => {
  const { wording, problems } = panelWording("es")
  assert.deepEqual(problems, [])
  assert.equal(wording["panel.title"], "Radio de impacto")
  assert.equal(wording["panel.relations"], "Relaciones")
  assert.deepEqual(Object.keys(wording).sort(), [...KEYS].sort())
})

test("a consumer may override one word without restating the catalogue", () => {
  const { wording, problems } = panelWording("es", { "panel.title": "Impacto" })
  assert.equal(wording["panel.title"], "Impacto")
  assert.equal(wording["panel.relations"], "Relaciones", "the rest of the catalogue stays")
  assert.deepEqual(problems, [])
})

// The patch this replaces failed by matching nothing and saying nothing; an unknown key
// must not do the same.
test("an override of a key the panel does not render is named, not ignored", () => {
  const { problems } = panelWording("en", { "panel.tittle": "Typo" })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /panel\.tittle/)
})
