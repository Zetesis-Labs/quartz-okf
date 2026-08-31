import { PROFILE } from "./reference-profile.ts"
import type { Profile, ProfileOverlay } from "./types.ts"

export function mergeProfile(base: Profile = PROFILE, overlay: ProfileOverlay | null = {}): Profile {
  return {
    ...base,
    ...(overlay ?? {}),
    ruleLevels: {
      ...(base.ruleLevels ?? {}),
      ...(overlay?.ruleLevels ?? {}),
    },
    propertyGroups: overlay?.propertyGroups ?? base.propertyGroups ?? [],
  }
}
