import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { mergeProfile } from "./profile.ts"
import { BRANDING, PROFILE } from "./reference-profile.ts"
import type { Branding, OkfConfig, Profile, ProfileOverlay } from "./types.ts"

export const CONFIG_FILE_NAMES = ["okf.config.mjs", "okf.config.js"]

type ConfigModule = OkfConfig & { default?: OkfConfig }

/** The consumer's configuration module, merged: named exports win over `default`. */
export async function readModuleConfig(root: string): Promise<OkfConfig | null> {
  for (const name of CONFIG_FILE_NAMES) {
    const configPath = path.join(root, name)
    try {
      await fs.access(configPath)
    } catch {
      continue
    }
    const imported = (await import(pathToFileURL(configPath).href)) as ConfigModule
    const defaults =
      imported.default && typeof imported.default === "object" ? imported.default : {}
    return { ...defaults, ...imported }
  }
  return null
}

async function readExportedProfile(root: string): Promise<ProfileOverlay | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(root, "okf-profile.json"), "utf8")) as ProfileOverlay
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null
    throw error
  }
}

export interface ConsumerConfig {
  branding: Branding
  profile: Profile
}

export async function loadConsumerConfig(rootPath: string): Promise<ConsumerConfig> {
  const root = path.resolve(rootPath)
  const config = await readModuleConfig(root)
  const exportedProfile = config ? null : await readExportedProfile(root)
  return {
    branding: { ...BRANDING, ...(config?.branding ?? {}) },
    profile: mergeProfile(PROFILE, config?.profile ?? exportedProfile ?? {}),
  }
}
