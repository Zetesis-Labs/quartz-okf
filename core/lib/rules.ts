import path from "node:path"
import { anchorSlug } from "./anchor.ts"
import { catalogsOf } from "./catalog.ts"
import { DEFAULT_RULE_LEVELS, PROFILE } from "./reference-profile.ts"
import { buildResolver } from "./resolver.ts"
import { fencedLineMask, parseBodyLinks, parseTopologyEdges } from "./topology.ts"
import type { Document, Frontmatter, Profile, RuleLevel, TopologyEdge, ValidatedDocument, Violation } from "./types.ts"

type Levels = Record<string, RuleLevel>

function violation(rule: string, message: string, configuredLevels: Levels, detail: { edge?: TopologyEdge } = {}): Violation | null {
  const level = configuredLevels[rule] ?? DEFAULT_RULE_LEVELS[rule] ?? "off"
  if (level === "off") return null
  return { level, rule, message, ...detail }
}

function missing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "")
}

function validatePropertyGroups(
  frontmatter: Frontmatter,
  profile: Profile,
  levels: Levels,
  add: (entry: Violation | null) => void,
): void {
  for (const group of profile.propertyGroups ?? []) {
    if (!(group.appliesTo ?? []).includes(frontmatter.type ?? "")) continue
    const problems: string[] = []
    for (const field of group.fields ?? []) {
      const value = frontmatter[field.source]
      if (missing(value)) {
        if (field.required) problems.push(`declare ${field.source}`)
        continue
      }
      if (field.type && typeof value !== field.type) {
        problems.push(`${field.source} must be ${field.type}`)
        continue
      }
      if (field.enum && !field.enum.includes(value)) {
        problems.push(`use ${field.source} from: ${field.enum.join(", ")}`)
      }
    }
    if (problems.length > 0) {
      add(
        violation(
          group.rule,
          `${group.label ?? group.id}: ${problems.join("; ")}`,
          levels,
        ),
      )
    }
  }
}

/** The anchors the note's own headings take: a row may not answer to one of them. */
function headingAnchorsOf(body: string): string[] {
  const lines = String(body).replaceAll("\r\n", "\n").split("\n")
  const fenced = fencedLineMask(lines)
  const anchors: string[] = []
  const occurrences = new Map<string, number>()
  for (const [index, line] of lines.entries()) {
    if (fenced[index]) continue
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/)
    if (!heading) continue
    const original = anchorSlug(heading[1])
    let anchor = original
    while (occurrences.has(anchor)) {
      const next = (occurrences.get(original) ?? 0) + 1
      occurrences.set(original, next)
      anchor = `${original}-${next}`
    }
    occurrences.set(anchor, 0)
    anchors.push(anchor)
  }
  return anchors
}

function rowDefaults(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item)]),
  )
}

export function isReserved(filePath: string): boolean {
  const name = path.posix.basename(String(filePath).replaceAll("\\", "/"))
  return name === "index.md" || name === "log.md"
}

export interface ValidateOptions {
  profile?: Profile
  ruleLevels?: Levels
}

function aliasesOf(frontmatter: Frontmatter): string[] {
  if (Array.isArray(frontmatter.aliases)) return frontmatter.aliases.map(String)
  return frontmatter.aliases ? [String(frontmatter.aliases)] : []
}

export function validateDocument(document: Document, options: ValidateOptions = {}): ValidatedDocument {
  const profile = options.profile ?? PROFILE
  const levels: Levels = { ...profile.ruleLevels, ...(options.ruleLevels ?? {}) }
  const violations: Violation[] = []
  const add = (entry: Violation | null): void => {
    if (entry) violations.push(entry)
  }
  const relativePath = String(document.path).replaceAll("\\", "/")
  const basename = path.posix.basename(relativePath, ".md")
  const directory = path.posix.basename(path.posix.dirname(relativePath))
  const reserved = document.reserved ?? isReserved(relativePath)

  if (document.parseError) {
    add(
      violation(
        "core/frontmatter-parse",
        document.parseError.message,
        levels,
      ),
    )
    return { ...document, reserved, edges: [], violations }
  }

  if (reserved) {
    if (
      path.posix.basename(relativePath) === "index.md" &&
      relativePath !== "index.md" &&
      document.frontmatter
    ) {
      add(
        violation(
          "core/index-frontmatter",
          "frontmatter is only permitted in the bundle-root index.md",
          levels,
        ),
      )
    }
    if (path.posix.basename(relativePath) === "log.md") {
      if (document.frontmatter) {
        add(violation("core/log-frontmatter", "log.md must not have frontmatter", levels))
      }
      for (const match of document.body.matchAll(/^##\s+(.+)$/gm)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(match[1].trim())) {
          add(
            violation(
              "core/log-date",
              `log date heading must be YYYY-MM-DD, got "${match[1].trim()}"`,
              levels,
            ),
          )
        }
      }
    }
    return { ...document, reserved, edges: [], violations }
  }

  const frontmatter: Frontmatter = document.frontmatter ?? {}
  if (typeof frontmatter.type !== "string" || frontmatter.type.trim() === "") {
    add(violation("core/type-required", "concept must have a non-empty type", levels))
  } else if (!profile.types.includes(frontmatter.type)) {
    add(
      violation(
        "profile/type-closed",
        `unknown type "${frontmatter.type}"; allowed: ${profile.types.join(", ")}`,
        levels,
      ),
    )
  }
  if (basename === directory && directory) {
    if (!aliasesOf(frontmatter).includes(basename)) {
      add(
        violation(
          "profile/folder-note-alias",
          `folder note must declare aliases: [${basename}]`,
          levels,
        ),
      )
    }
  }
  if (!frontmatter.title) {
    add(violation("hygiene/title-recommended", "title is recommended", levels))
  }
  if (!frontmatter.description) {
    add(violation("hygiene/description-recommended", "description is recommended", levels))
  }
  if (
    frontmatter.tags !== undefined &&
    (!Array.isArray(frontmatter.tags) ||
      frontmatter.tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(tag))))
  ) {
    add(
      violation(
        "hygiene/tags-shape",
        "tags must be a YAML list of lowercase kebab-case strings",
        levels,
      ),
    )
  }
  validatePropertyGroups(frontmatter, profile, levels, add)
  const edges = parseTopologyEdges(document.body, profile.topologyHeading)
  if (profile.bodyLinks) {
    for (const target of parseBodyLinks(document.body, profile.topologyHeading)) {
      edges.push({ label: profile.bodyLinks, target, fromBody: true })
    }
  }
  const catalog = catalogsOf(
    { id: document.id, body: document.body },
    {
      defaults: rowDefaults(frontmatter.okf_rows),
      edgeLabels: profile.edgeLabels,
      headingAnchors: headingAnchorsOf(document.body),
    },
  )
  for (const problem of catalog.problems) add(violation(problem.code, problem.message, levels))
  for (const type of new Set(catalog.rows.map((row) => row.type))) {
    if (!profile.types.includes(type)) {
      add(
        violation(
          "profile/type-closed",
          `unknown row type "${type}"; allowed: ${profile.types.join(", ")}`,
          levels,
        ),
      )
    }
  }
  const checkLabels = (candidates: TopologyEdge[]): void => {
    for (const edge of [...new Map(candidates.map((item) => [item.label, item])).values()]) {
      if (profile.edgeLabels.includes(edge.label)) continue
      add(
        violation(
          "profile/edge-label-closed",
          `unknown edge label "${edge.label}"; allowed: ${profile.edgeLabels.join(", ")}`,
          levels,
          { edge },
        ),
      )
    }
  }
  checkLabels([
    ...catalog.rows.flatMap((row) => row.edges),
    ...catalog.annotations.map((annotation) => ({ label: annotation.edge, target: annotation.ref })),
  ])
  checkLabels(edges)
  return { ...document, reserved, edges, violations, rows: catalog.rows, annotations: catalog.annotations }
}

export interface AnnotationProblem {
  path: string
  violation: Violation
}

/**
 * What only the whole corpus can answer about annotating tables: whether each one reaches
 * a node, and whether two of them write different values to the same property.
 */
export function validateAnnotations(documents: ValidatedDocument[], options: ValidateOptions = {}): AnnotationProblem[] {
  const profile = options.profile ?? PROFILE
  const levels: Levels = { ...profile.ruleLevels, ...(options.ruleLevels ?? {}) }
  const resolve = buildResolver(documents)
  const slugs = new Set<string>()
  for (const document of documents) {
    if (document.reserved || !document.frontmatter?.type) continue
    slugs.add(document.id)
    for (const row of document.rows ?? []) slugs.add(row.slug)
  }
  const taken = new Map<string, { value: unknown; path: string; table: number; row?: number }>()
  const problems: AnnotationProblem[] = []
  const report = (path: string, entry: Violation | null): void => {
    if (entry) problems.push({ path, violation: entry })
  }
  for (const document of documents) {
    for (const annotation of document.annotations ?? []) {
      const target = resolve(annotation.ref)
      if (!target || !slugs.has(target)) {
        report(
          document.path,
          violation(
            "catalog/ref-unresolved",
            `table ${annotation.table}${annotation.row ? `, row ${annotation.row}` : ""}: "${annotation.ref}" names no node of this corpus`,
            levels,
          ),
        )
        continue
      }
      const written = {
        ...annotation.properties,
        ...(annotation.description ? { description: annotation.description } : {}),
      }
      for (const [key, value] of Object.entries(written)) {
        const previous = taken.get(`${target}\n${key}`)
        if (previous && previous.value !== value) {
          report(
            document.path,
            violation(
              "catalog/property-conflict",
              `table ${annotation.table}${annotation.row ? `, row ${annotation.row}` : ""}: "${target}" already took ${key} = ${JSON.stringify(previous.value)} from ${previous.path}, table ${previous.table}${previous.row ? `, row ${previous.row}` : ""}; this table writes ${JSON.stringify(value)}`,
              levels,
            ),
          )
          continue
        }
        taken.set(`${target}\n${key}`, {
          value,
          path: document.path,
          table: annotation.table,
          row: annotation.row,
        })
      }
    }
  }
  return problems
}

function levelOf(rule: string, levels: Levels): RuleLevel {
  return levels[rule] ?? DEFAULT_RULE_LEVELS[rule] ?? "off"
}

export function validateDocuments(documents: Document[], options: ValidateOptions = {}): ValidatedDocument[] {
  const profile = options.profile ?? PROFILE
  const levels: Levels = { ...profile.ruleLevels, ...(options.ruleLevels ?? {}) }
  const validated = documents.map((document) => validateDocument(document, options))
  const unresolvedLevel = levelOf("hygiene/unresolved-edge", levels)
  if (unresolvedLevel !== "off") {
    const resolve = buildResolver(validated)
    for (const document of validated) {
      for (const edge of document.edges ?? []) {
        if (!resolve(edge.target)) {
          document.violations.push({
            level: unresolvedLevel,
            rule: "hygiene/unresolved-edge",
            message: `unresolved topology target "${edge.target}"`,
            edge,
          })
        }
      }
    }
  }
  const knowledgeLevel = levelOf("hygiene/knowledge-edges-recommended", levels)
  if (knowledgeLevel !== "off") {
    const resolve = buildResolver(validated)
    const linked = new Set<string>()
    for (const document of validated) {
      for (const edge of document.edges ?? []) {
        const target = resolve(edge.target)
        if (target) linked.add(target)
      }
    }
    for (const document of validated) {
      const type = document.frontmatter?.type
      if (
        !document.reserved &&
        (document.edges ?? []).length === 0 &&
        typeof type === "string" &&
        profile.types.includes(type) &&
        !profile.structuralTypes.includes(type) &&
        !linked.has(document.id)
      ) {
        document.violations.push({
          level: knowledgeLevel,
          rule: "hygiene/knowledge-edges-recommended",
          message:
            "knowledge note is isolated (no Topology edges in either direction); link its subjects with About/Affects",
        })
      }
    }
  }
  for (const problem of validateAnnotations(validated, options)) {
    const document = validated.find((item) => item.path === problem.path)
    document?.violations.push(problem.violation)
  }
  const redundantLevel = levelOf("hygiene/redundant-inverse", levels)
  const inverseLabels = profile.inverseLabels ?? {}
  if (redundantLevel !== "off" && Object.keys(inverseLabels).length > 0) {
    const resolve = buildResolver(validated)
    const declared = new Set<string>()
    for (const document of validated) {
      for (const edge of document.edges ?? []) {
        const target = resolve(edge.target)
        if (target) declared.add(`${document.id}\n${edge.label}\n${target}`)
      }
    }
    for (const document of validated) {
      for (const edge of document.edges ?? []) {
        const inverse = inverseLabels[edge.label]
        const target = resolve(edge.target)
        if (!inverse || !target) continue
        if (declared.has(`${target}\n${inverse}\n${document.id}`)) {
          document.violations.push({
            level: redundantLevel,
            rule: "hygiene/redundant-inverse",
            message: `edge "${edge.label}: ${target}" is also declared as "${inverse}" on the target; declare relations once — the mirror is derived`,
            edge,
          })
        }
      }
    }
  }
  return validated
}
