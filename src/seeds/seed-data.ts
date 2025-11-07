export type UserRole = 'admin' | 'content-admin' | 'viewer'

export type UserSeed = {
  email: string
  password: string
  name: string
  role: UserRole
}

/**
 * Seed data for initial users
 * These users will be created on system initialization
 *
 * IMPORTANT: Change passwords after first login!
 */
export const USER_SEED_DATA: UserSeed[] = [
  {
    email: 'admin@mimika.go.id',
    password: 'Admin@Mimika2025!',
    name: 'Admin Bapenda Mimika',
    role: 'admin',
  },
  {
    email: 'content@mimika.go.id',
    password: 'Content@Mimika2025!',
    name: 'Content Admin Bapenda Mimika',
    role: 'content-admin',
  },
  {
    email: 'viewer@mimika.go.id',
    password: 'Viewer@Mimika2025!',
    name: 'Viewer Bapenda Mimika',
    role: 'viewer',
  },
]
