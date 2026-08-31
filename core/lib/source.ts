import { isRemoteRepo, subgraphId } from "./federation.ts"
import type { CorpusSource, Problem, SubgraphEntry } from "./types.ts"

export interface ResolvedSource {
  source: CorpusSource | null
  problems: Problem[]
}

/**
 * Where a mounted corpus comes from, as the consumer wrote it: `path` — a corpus directory
 * in this code — or `repo` + `ref` — a git repository at a commit. A local path in `repo`
 * is the 001 spelling of `path` and normalises to it without a word. Exactly one of the
 * two; `ref` only matters for git.
 */
export function sourceOf(entry: Partial<SubgraphEntry>, id: string = subgraphId(entry) || "(unnamed)"): ResolvedSource {
  const problem = (code: string, message: string): ResolvedSource => ({
    source: null,
    problems: [{ id, code, message: `${id}: ${message}` }],
  })
  const hasPath = Boolean(entry.path)
  const hasRepo = Boolean(entry.repo)
  if (hasPath && hasRepo) return problem("federation/source-ambiguous", "declare either `path` or `repo`, not both")
  if (!hasPath && !hasRepo) {
    return problem(
      "federation/source-required",
      "declare where the corpus comes from: `path` (a directory in this code) or `repo` + `ref` (a git repository at a commit)",
    )
  }
  if (hasPath) return { source: { kind: "path", path: String(entry.path) }, problems: [] }
  const repo = String(entry.repo)
  if (!isRemoteRepo(repo)) return { source: { kind: "path", path: repo }, problems: [] }
  if (!entry.ref) return problem("federation/ref-required", `pin the commit of ${repo} in \`ref\``)
  return { source: { kind: "git", repo, ref: String(entry.ref) }, problems: [] }
}
