import { spawnSync } from "node:child_process"

function git(repo, args, fallback = "", trim = true) {
  const result = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  return result.status === 0 ? (trim ? result.stdout.trim() : result.stdout) : fallback
}

export function gitHead(repo) {
  return git(repo, ["rev-parse", "HEAD"], "unknown")
}

export function gitRevisionExists(repo, revision) {
  if (!revision) return false
  const result = spawnSync("git", ["-C", repo, "cat-file", "-e", `${revision}^{commit}`], {
    stdio: "ignore",
  })
  return result.status === 0
}

export function gitIsDirty(repo) {
  return git(repo, ["status", "--porcelain"], "") !== ""
}

export function gitStatusPaths(repo) {
  return git(repo, ["status", "--porcelain"], "", false)
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1))
}

export function gitFilesChangedSince(repo, fromHead, toHead = "HEAD") {
  if (!fromHead || fromHead === "unknown") return []
  return git(repo, ["diff", "--name-only", `${fromHead}..${toHead}`])
    .split("\n")
    .filter(Boolean)
}

export function gitTimestamp(repo, filePath) {
  return (
    git(repo, ["log", "-1", "--format=%cI", "--", filePath]) ||
    git(repo, ["show", "-s", "--format=%cI", "HEAD"]) ||
    "1970-01-01T00:00:00Z"
  )
}

export function gitLog(repo, limit = 100) {
  const field = "\u001f"
  const record = "\u001e"
  const raw = git(repo, [
    "log",
    `-${limit}`,
    "--date=short",
    `--format=%ad${field}%h${field}%s${record}`,
    "--",
    "*.md",
  ])
  return raw
    .split(record)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [date, hash, subject] = entry.split(field)
      return { date, hash, subject }
    })
}

export function gitTrackedFiles(repo) {
  const raw = git(repo, ["ls-files", "-z"], null, false)
  if (raw === null) return null
  return new Set(raw.split("\0").filter(Boolean))
}

export function gitChangedFiles(repo, fromHead, toHead = "HEAD") {
  if (!fromHead || fromHead === "unknown") return []
  const raw = git(repo, ["diff", "--name-status", `${fromHead}..${toHead}`])
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t")
      return { status, paths }
    })
}
