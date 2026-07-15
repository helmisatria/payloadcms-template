import type { Payload } from 'payload'
import { seedRoles } from './00-roles'
import { seedUsers } from './01-users'

/**
 * Main seed orchestrator - runs all collection seeds in proper dependency order
 */
export const seed = async (payload: Payload): Promise<void> => {
  payload.logger.info('🚀 Starting seed process...')

  try {
    payload.logger.info('\n🔐 ROLE SEEDING')
    const roles = await seedRoles(payload)

    // Seed users after their relationship targets exist.
    payload.logger.info('\n👥 USER SEEDING')
    const users = await seedUsers(payload, roles)

    if (users.failed.length > 0) {
      payload.logger.warn('\n⚠️ Seeding completed with errors.')
    } else {
      payload.logger.info('\n🎉 All seeds completed successfully!')
    }

    payload.logger.info(`📊 Summary:
    - Roles processed: ${roles.size}
    - Users processed: ${users.created.length}
    - Existing users: ${users.existing.length}
    - Failed users: ${users.failed.length}
    `)

    if (users.failed.length > 0) {
      payload.logger.warn(`Failed user emails: ${users.failed.join(', ')}`)
    }
  } catch (error) {
    payload.logger.error(
      `💥 Seed process failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  }
}
