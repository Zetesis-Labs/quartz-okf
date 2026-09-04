import assert from "node:assert/strict"
import test from "node:test"
import { anchorSlug } from "../lib/anchor.ts"

// Characterization of `github-slugger`, the package Quartz applies to `[[note#Heading]]`
// and to heading ids. These outputs were read off that package; a row anchor that
// differed from them would be a link landing nowhere. Quartz trims the heading before
// slugging it, and so does this.
test("anchorSlug reproduces the anchors Quartz derives for headings", () => {
  assert.equal(anchorSlug("AC001"), "ac001")
  assert.equal(anchorSlug("BC002 Curriculum Planning"), "bc002-curriculum-planning")
  assert.equal(anchorSlug("DE161"), "de161")
  assert.equal(anchorSlug("Área de Learning (L2)"), "área-de-learning-l2")
  assert.equal(anchorSlug("AP-01_x"), "ap-01_x")
  assert.equal(anchorSlug("**AC001**"), "ac001")
  assert.equal(anchorSlug("AC 001"), "ac-001")
})

test("anchorSlug keeps letters, numbers, marks, hyphens and underscores; drops the rest", () => {
  assert.equal(anchorSlug("ISO/IEC 27001: A.5"), "isoiec-27001-a5")
  assert.equal(anchorSlug("§ 4.2 — Ámbito"), "-42--ámbito")
  assert.equal(anchorSlug("niño/Niño"), "niñoniño")
  assert.equal(anchorSlug("a  b"), "a--b")
  assert.equal(anchorSlug("  padded  "), "padded")
})

test("anchorSlug returns an empty string when nothing survives", () => {
  assert.equal(anchorSlug("***"), "")
  assert.equal(anchorSlug(""), "")
  assert.equal(anchorSlug("   "), "")
})
