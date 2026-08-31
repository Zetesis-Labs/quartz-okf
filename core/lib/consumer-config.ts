import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { BRANDING, PROFILE } from "../profile.js"
import { mergeProfile } from "./profile.js"

async function readModuleConfig(root) {
  for (const name of ["okf.config.mjs", "okf.config.js"]) {
    const configPath = path.join(root, name)
    try {
      await fs.access(configPath)
    } catch {
      continue
    }
    const imported = await import(pathToFileURL(configPath).href)
    const defaults =
      imported.default && typeof imported.default === "object" ? imported.default : {}
    return { ...defaults, ...imported }
  }
  return null
}

async function readExportedProfile(root) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, "okf-profile.json"), "utf8"))
  } catch (error) {
    if (error?.code === "ENOENT") return null
    throw error
  }
}

export async function loadConsumerConfig(rootPath) {
  const root = path.resolve(rootPath)
  const config = await readModuleConfig(root)
  const exportedProfile = config ? null : await readExportedProfile(root)
  return {
    branding: { ...BRANDING, ...(config?.branding ?? {}) },
    profile: mergeProfile(PROFILE, config?.profile ?? exportedProfile ?? {}),
  }
}
