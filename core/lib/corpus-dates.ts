/**
 * Where every note of a build's corpus came from, so the site can publish the date the
 * note was last written instead of the minute the build copied it.
 *
 * The corpus is assembled outside its repository, so the site's date plugin finds no git
 * there and falls back to the filesystem — which the copy had just reset to now.
 */

export interface MountSource {
  id: string
  /** Absolute directory of the mounted corpus; its notes live under `content/`. */
  path: string
}

export interface SourceLookup {
  /** The repository the corpus belongs to. */
  root: string
  /** Absolute corpus directory, or null when the whole repository was swept. */
  contentDir: string | null
  mounts: MountSource[]
}

/**
 * `git log --format=%at --name-status -M`: a timestamp, a blank line, then a status and a
 * path per file. A rename with no edit (`R100`) is not a change to the note — it carries
 * the date across, so moving a corpus does not re-date every note in it.
 */
export function parseGitDates(output: string): Map<string, number> {
  const dates = new Map<string, number>()
  const movedFrom = new Map<string, string>()
  let timestamp: number | null = null
  for (const line of output.split("\n")) {
    if (line.trim() === "") continue
    if (/^\d{9,}$/.test(line.trim())) {
      timestamp = Number(line.trim())
      continue
    }
    if (timestamp === null) continue
    const [status, ...paths] = line.split("\t")
    if (status === "R100" && paths.length === 2) {
      if (!movedFrom.has(paths[1])) movedFrom.set(paths[1], paths[0])
      continue
    }
    // `git log` walks from the newest commit down, so the first date a path gets is its last.
    const file = paths[paths.length - 1]
    if (file && !dates.has(file)) dates.set(file, timestamp)
  }
  for (const start of movedFrom.keys()) {
    if (dates.has(start)) continue
    const seen = new Set<string>([start])
    let cursor = start
    while (movedFrom.has(cursor)) {
      cursor = movedFrom.get(cursor) as string
      if (seen.has(cursor)) break
      seen.add(cursor)
      const found = dates.get(cursor)
      if (found !== undefined) {
        dates.set(start, found)
        break
      }
    }
  }
  return dates
}

/** The files a note in the assembled corpus may have been copied from, best first. */
export function sourcePathsFor(relative: string, lookup: SourceLookup): string[] {
  const mount = lookup.mounts.find((entry) => relative === entry.id || relative.startsWith(`${entry.id}/`))
  if (mount) return [`${mount.path}/content/${relative.slice(mount.id.length + 1)}`]
  if (lookup.contentDir) return [`${lookup.contentDir}/${relative}`]
  const swept = `${lookup.root}/${relative}`
  if (!relative.endsWith("index.md")) return [swept]
  return [swept, `${lookup.root}/${relative.replace(/index\.md$/, "README.md")}`]
}
