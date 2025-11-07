import type { Payload } from 'payload'
import { seedUsers } from './01-users'

/**
 * Main seed orchestrator - runs all collection seeds in proper dependency order
 */
export const seed = async (payload: Payload): Promise<void> => {
  payload.logger.info('🚀 Starting seed process for Bapenda Mimika...')

  try {
    // Seed users with roles
    payload.logger.info('\n👥 USER SEEDING')
    const users = await seedUsers(payload)

    payload.logger.info('\n🎉 All seeds completed successfully!')
    payload.logger.info(`📊 Summary:
    - Users: ${users.length}
    `)
  } catch (error) {
    payload.logger.error(
      `💥 Seed process failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  }
}
