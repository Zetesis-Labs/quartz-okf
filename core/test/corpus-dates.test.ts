import assert from "node:assert/strict"
import test from "node:test"
import { parseGitDates, sourcePathsFor } from "../lib/corpus-dates.ts"
import type { SourceLookup } from "../lib/corpus-dates.ts"

const lookup = (overrides: Partial<SourceLookup> = {}): SourceLookup => ({
  root: "/repo",
  contentDir: "/repo/content",
  mounts: [],
  ...overrides,
})

test("the newest commit of each file wins, and one commit dates every file it touched", () => {
  const dates = parseGitDates(["1700000200", "", "M\ta.md", "A\tb.md", "", "1700000100", "", "M\ta.md", "A\tc.md", ""].join("\n"))
  assert.deepEqual([...dates.entries()].sort(), [
    ["a.md", 1700000200],
    ["b.md", 1700000200],
    ["c.md", 1700000100],
  ])
})

// Moving a corpus into a subdirectory rewrote nothing: the notes must keep the date they
// were written, or every note in the site is dated the day of the move.
test("a pure move carries the date across, a move that also edited does not", () => {
  const moved = parseGitDates(
    ["1700000900", "", "R100\told/a.md\tnew/a.md", "R080\told/b.md\tnew/b.md", "", "1700000100", "", "M\told/a.md", "M\told/b.md", ""].join("\n"),
  )
  assert.equal(moved.get("new/a.md"), 1700000100, "the move alone did not change the note")
  assert.equal(moved.get("new/b.md"), 1700000900, "the move rewrote it, so it is a change")
})

test("a note edited after being moved keeps the date of the edit", () => {
  const dates = parseGitDates(
    ["1700000900", "", "M\tnew/a.md", "", "1700000500", "", "R100\told/a.md\tnew/a.md", "", "1700000100", "", "M\told/a.md", ""].join("\n"),
  )
  assert.equal(dates.get("new/a.md"), 1700000900)
})

test("a chain of moves walks back to the last time the note was actually written", () => {
  const dates = parseGitDates(
    ["1700000900", "", "R100\tb.md\tc.md", "", "1700000500", "", "R100\ta.md\tb.md", "", "1700000100", "", "A\ta.md", ""].join("\n"),
  )
  assert.equal(dates.get("c.md"), 1700000100)
})

test("an empty log is an empty map, not a crash", () => {
  assert.equal(parseGitDates("").size, 0)
  assert.equal(parseGitDates("\n\n").size, 0)
})

test("a note copied from the corpus directory came from that directory", () => {
  assert.deepEqual(sourcePathsFor("compute/batch.md", lookup()), ["/repo/content/compute/batch.md"])
})

// The sweep publishes a folder's README as its index: the date of the page is the date of
// the file that was actually written.
test("a swept corpus looks in the repository, and an index may have been a README", () => {
  const swept = lookup({ contentDir: null })
  assert.deepEqual(sourcePathsFor("docs/guide.md", swept), ["/repo/docs/guide.md"])
  assert.deepEqual(sourcePathsFor("docs/index.md", swept), ["/repo/docs/index.md", "/repo/docs/README.md"])
  assert.deepEqual(sourcePathsFor("index.md", swept), ["/repo/index.md", "/repo/README.md"])
})

test("a mounted note came from its own corpus, wherever that corpus lives", () => {
  const federated = lookup({ mounts: [{ id: "it-governance", path: "/repo/subgraphs/it" }] })
  assert.deepEqual(sourcePathsFor("it-governance/compute/batch.md", federated), ["/repo/subgraphs/it/content/compute/batch.md"])
  // The mount's own index is written by the toolkit, not by the child: nothing to date.
  assert.deepEqual(sourcePathsFor("it-governance/index.md", federated), ["/repo/subgraphs/it/content/index.md"])
  // A note of the parent that merely starts with the same letters is not a mounted note.
  assert.deepEqual(sourcePathsFor("it-governance-notes/x.md", federated), ["/repo/content/it-governance-notes/x.md"])
})

test("without a corpus directory and without mounts there is nothing to look up", () => {
  assert.deepEqual(sourcePathsFor("a.md", lookup({ contentDir: null, root: "/repo" })), ["/repo/a.md"])
})
