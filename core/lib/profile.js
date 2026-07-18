import { PROFILE } from "../profile.js"

export function mergeProfile(base = PROFILE, overlay = {}) {
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
