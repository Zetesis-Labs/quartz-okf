import fs from "node:fs/promises"
import path from "node:path"
import { parseFrontmatter } from "./frontmatter.ts"
import { conceptId } from "./resolver.ts"
import { isReserved, validateDocuments } from "./rules.ts"
import type { Document, Profile, RuleLevel, ValidatedDocument } from "./types.ts"

export const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".claude",
  ".codex",
  ".agents",
  ".devcontainer",
  "node_modules",
])

export interface WalkedFile {
  absolute: string
  relative: string
}

export async function walk(
  root: string,
  options: { extensions?: Set<string> | null } = {},
): Promise<WalkedFile[]> {
  const results: WalkedFile[] = []
  const extensions = options.extensions ?? null
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).replaceAll("\\", "/")
      if (entry.isDirectory()) {
        if (
          !EXCLUDED_DIRECTORIES.has(entry.name) &&
          relative !== "okf/content" &&
          relative !== "okf/skills"
        ) {
          await visit(absolute)
        }
      } else if (
        entry.isFile() &&
        entry.name !== "CLAUDE.md" &&
        (!extensions || extensions.has(path.extname(entry.name).toLowerCase()))
      ) {
        results.push({ absolute, relative })
      }
    }
  }
  await visit(root)
  return results
}

export interface LoadOptions {
  validate?: boolean
  profile?: Profile
  ruleLevels?: Record<string, RuleLevel>
}

export async function loadDocuments(root: string, options: LoadOptions & { validate: false }): Promise<Document[]>
export async function loadDocuments(root: string, options?: LoadOptions): Promise<ValidatedDocument[]>
export async function loadDocuments(
  root: string,
  options: LoadOptions = {},
): Promise<Document[] | ValidatedDocument[]> {
  const files = await walk(root, { extensions: new Set([".md"]) })
  const documents: Document[] = []
  for (const file of files) {
    const source = await fs.readFile(file.absolute, "utf8")
    const parsed = parseFrontmatter(source)
    const reserved = isReserved(file.relative)
    documents.push({
      id: conceptId(file.relative),
      path: file.relative,
      source,
      body: parsed.body,
      frontmatter: parsed.data,
      parseError:
        parsed.error && !(reserved && parsed.error.message === "missing frontmatter")
          ? parsed.error
          : null,
      reserved,
    })
  }
  return options.validate === false ? documents : validateDocuments(documents, options)
}

export async function emptyDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true })
  for (const entry of await fs.readdir(directory)) {
    await fs.rm(path.join(directory, entry), { recursive: true, force: true })
  }
}
