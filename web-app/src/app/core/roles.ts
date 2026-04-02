/** Access level constants matching server-side role hierarchy. */
export const Role = {
  TRAINEE: 1,
  TRAINER: 2,
  MANAGER: 3,
  ADMIN: 4,
} as const;

export type RoleLevel = typeof Role[keyof typeof Role];
