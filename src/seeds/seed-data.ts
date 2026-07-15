export type UserRoleSlug = 'super-admin' | 'content-admin' | 'viewer'

export type UserSeed = {
  email: string
  password: string
  name: string
  roleSlug: UserRoleSlug
}

/**
 * Seed data for initial users
 * These users will be created on system initialization
 *
 * IMPORTANT: Change passwords after first login!
 */
export const USER_SEED_DATA: UserSeed[] = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    name: 'System Administrator',
    roleSlug: 'super-admin',
  },
  {
    email: 'content@example.com',
    password: 'content123',
    name: 'Content Administrator',
    roleSlug: 'content-admin',
  },
  {
    email: 'viewer@example.com',
    password: 'viewer123',
    name: 'Viewer User',
    roleSlug: 'viewer',
  },
]
