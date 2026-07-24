export { FeedViewType } from "@follow-app/client-sdk"
export enum Routes {
  Timeline = "/timeline",
  Discover = "/discover",
}

export enum UserRole {
  Admin = "admin",
  PreProTrial = "pre_pro_trial",
  Free = "free",
  /**
   * @deprecated
   * @see UserRole.Free
   */
  // TODO: remove this
  Trial = "trial",
  Pro = "pro",
  Plus = "plus",
}

export const UserRoleName: Record<UserRole, string> = {
  [UserRole.Admin]: "Admin",
  [UserRole.PreProTrial]: "Pro Preview Trial",
  [UserRole.Free]: "Free",
  /**
   * @deprecated
   * @see UserRole.Free
   */
  [UserRole.Trial]: "Free",
  [UserRole.Pro]: "Pro",
  [UserRole.Plus]: "Plus",
} as const

export const isFreeRole = (role?: UserRole | null) => {
  return role
    ? role === UserRole.Free || role === UserRole.Trial || role === UserRole.PreProTrial
    : true
}

/**
 * Whether the role receives "paid" UI treatment (pro badge, avatar ring, gated
 * paid settings). `PreProTrial` counts as paid here — it is a Pro *preview* —
 * so this is intentionally NOT the negation of `isFreeRole`, which treats
 * `PreProTrial` as free for entitlement gating (e.g. translation prefetch).
 * A null/undefined role is not paid.
 */
export const isPaidRole = (role?: UserRole | null) => {
  return !!role && role !== UserRole.Free && role !== UserRole.Trial
}
