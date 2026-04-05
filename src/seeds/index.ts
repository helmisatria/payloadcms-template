import type { Payload } from 'payload'
import { seedUsers } from './01-users'

/**
 * Main seed orchestrator - runs all collection seeds in proper dependency order
 */
export const seed = async (payload: Payload): Promise<void> => {
  payload.logger.info('🚀 Starting seed process...')

  try {
    // Seed users with roles
    payload.logger.info('\n👥 USER SEEDING')
    const users = await seedUsers(payload)

    if (users.failed.length > 0) {
      payload.logger.warn('\n⚠️ Seeding completed with errors.')
    } else {
      payload.logger.info('\n🎉 All seeds completed successfully!')
    }

    payload.logger.info(`📊 Summary:
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
