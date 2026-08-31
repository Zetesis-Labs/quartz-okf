import { spawnSync } from "node:child_process"

function run(repo: string, args: string[], trim = true): string | null {
  const result = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.status !== 0) return null
  return trim ? result.stdout.trim() : result.stdout
}

export function gitHead(repo: string): string {
  return run(repo, ["rev-parse", "HEAD"]) ?? "unknown"
}

export function gitRevisionExists(repo: string, revision: string | null | undefined): boolean {
  if (!revision) return false
  const result = spawnSync("git", ["-C", repo, "cat-file", "-e", `${revision}^{commit}`], {
    stdio: "ignore",
  })
  return result.status === 0
}

export function gitIsDirty(repo: string): boolean {
  return (run(repo, ["status", "--porcelain"]) ?? "") !== ""
}

export function gitStatusPaths(repo: string): string[] {
  return (run(repo, ["status", "--porcelain"], false) ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1))
    .filter((item): item is string => Boolean(item))
}

export function gitFilesChangedSince(repo: string, fromHead: string | null | undefined, toHead = "HEAD"): string[] {
  if (!fromHead || fromHead === "unknown") return []
  return (run(repo, ["diff", "--name-only", `${fromHead}..${toHead}`]) ?? "")
    .split("\n")
    .filter(Boolean)
}

export function gitTimestamp(repo: string, filePath: string): string {
  return (
    run(repo, ["log", "-1", "--format=%cI", "--", filePath]) ||
    run(repo, ["show", "-s", "--format=%cI", "HEAD"]) ||
    "1970-01-01T00:00:00Z"
  )
}

export interface GitLogEntry {
  date: string
  hash: string
  subject: string
}

export function gitLog(repo: string, limit = 100): GitLogEntry[] {
  const field = ""
  const record = ""
  const raw =
    run(repo, [
      "log",
      `-${limit}`,
      "--date=short",
      `--format=%ad${field}%h${field}%s${record}`,
      "--",
      "*.md",
    ]) ?? ""
  return raw
    .split(record)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [date, hash, subject] = entry.split(field)
      return { date, hash, subject }
    })
}

export function gitTrackedFiles(repo: string): Set<string> | null {
  const raw = run(repo, ["ls-files", "-z"], false)
  if (raw === null) return null
  return new Set(raw.split("\0").filter(Boolean))
}

export interface GitChange {
  status: string
  paths: string[]
}

export function gitChangedFiles(repo: string, fromHead: string | null | undefined, toHead = "HEAD"): GitChange[] {
  if (!fromHead || fromHead === "unknown") return []
  const raw = run(repo, ["diff", "--name-status", `${fromHead}..${toHead}`]) ?? ""
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t")
      return { status, paths }
    })
}
